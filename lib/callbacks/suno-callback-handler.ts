import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

import { transitionMusicGenerationStatusByTaskId, updateMusicGenerationByTaskId } from '@/lib/music-db';
import { createGenerationError } from '@/lib/generation-errors-db';
import { addUserCredits } from '@/lib/user-db';
import { downloadFromUrl, isManagedAssetUrl, uploadAudioFile, uploadCoverImage } from '@/lib/r2-storage';
import { query } from '@/lib/db-query-builder';
import { getMusicCredits, getFeatureCredits, FeatureKey } from '@/lib/credits-config';
import { MusicType } from '@/types/music';
import { submitExplorePageToIndexNow } from '@/lib/indexnow';
import { resolveLyricsTitle } from '@/lib/lyrics-title';
import {
  createCallbackEvent,
  markCallbackEventFailed,
  markCallbackEventProcessed,
  markCallbackEventProcessing,
} from '@/lib/callback-events-db';

// Cache for processed tasks to handle idempotency
const processedTasks = new Map<string, number>();
const processingTasks = new Map<string, number>();
const CALLBACK_IDEMPOTENCY_TTL_MS = 30 * 60 * 1000;
const RECORD_INFO_RECONCILE_SOURCE_LABELS = new Set([
  'generate',
  'upload-cover',
  'upload-extend',
  'upload-vocals',
  'upload-instrumental',
  'upload-mashup',
]);

function isActiveTaskKey(cache: Map<string, number>, key: string, ttlMs: number): boolean {
  const timestamp = cache.get(key);
  if (!timestamp) return false;
  if (Date.now() - timestamp > ttlMs) {
    cache.delete(key);
    return false;
  }
  return true;
}

export interface NormalizedKieCallback {
  code: number;
  msg?: string;
  taskId?: string;
  callbackType?: string;
  tracks: any[];
  errorMessage?: string;
  raw: any;
}

type JsonRecord = Record<string, any>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function tryParseJsonValue<T = unknown>(value: T): T | unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  const seemsJson =
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'));
  if (!seemsJson) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function asJsonRecord(value: unknown): JsonRecord {
  const parsed = tryParseJsonValue(value);
  return isJsonRecord(parsed) ? parsed : {};
}

function toFiniteNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeCallbackType(rawValue: unknown): string | undefined {
  if (typeof rawValue !== 'string') return undefined;
  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'text' || normalized === 'first' || normalized === 'complete') {
    return normalized;
  }
  if (normalized.includes('complete')) return 'complete';
  if (normalized.includes('first')) return 'first';
  if (normalized.includes('text')) return 'text';
  return normalized;
}

function normalizeErrorCodeToken(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

async function recordIncompleteProcessError(params: {
  taskId: string;
  callbackType?: string;
  code: number;
  sourceLabel: string;
  callbackId: string;
  reason?: string;
}) {
  const { taskId, callbackType, code, sourceLabel, callbackId, reason } = params;

  try {
    const musicResult = await query(
      'SELECT id, user_id FROM music WHERE task_id = $1 LIMIT 1',
      [taskId]
    );

    const musicId = musicResult.rows[0]?.id as string | undefined;
    const userId = musicResult.rows[0]?.user_id as string | undefined;

    if (!musicId || !userId) {
      console.warn(
        `[CALLBACK-${callbackId}] Skip generation_errors insert for incomplete callback: music row not found for taskId=${taskId}`
      );
      return;
    }

    const callbackTypeToken = normalizeErrorCodeToken(callbackType, 'UNKNOWN');
    const sourceToken = normalizeErrorCodeToken(sourceLabel, 'UNKNOWN');
    const codeToken = Number.isFinite(code) ? String(code) : 'UNKNOWN';
    const compactSource = sourceToken.slice(0, 12) || 'UNKNOWN';
    const compactCallbackType = callbackTypeToken.slice(0, 12) || 'UNKNOWN';
    const reasonCode = `CB_INCOMP_${compactSource}_${compactCallbackType}_${codeToken}`.slice(0, 50);
    const reasonMessage = `Callback processor returned false. source=${sourceLabel}, callbackType=${callbackType || 'unknown'}, code=${code}, taskId=${taskId}, reason=${reason || 'onprocess_false'}`;

    const duplicateResult = await query(
      `SELECT id
       FROM generation_errors
       WHERE error_type = 'music_generation'
         AND reference_id = $1
         AND error_code = $2
         AND created_at >= NOW() - INTERVAL '24 hours'
       LIMIT 1`,
      [musicId, reasonCode]
    );

    if (duplicateResult.rows.length > 0) {
      console.log(
        `[CALLBACK-${callbackId}] Skip duplicate incomplete callback error: ${reasonCode}`
      );
      return;
    }

    await query(
      `INSERT INTO generation_errors (
        user_id, error_type, reference_id, error_code, error_message
      ) VALUES ($1, 'music_generation', $2, $3, $4)`,
      [userId, musicId, reasonCode, reasonMessage]
    );

    console.warn(
      `[CALLBACK-${callbackId}] Recorded incomplete callback generation error: ${reasonCode}`
    );
  } catch (error) {
    console.error(
      `[CALLBACK-${callbackId}] Failed to record incomplete callback generation error:`,
      error
    );
  }
}

function shouldAttemptRecordInfoReconcile(params: {
  sourceLabel: string;
  taskId: string;
  code: number;
  callbackType?: string;
}): boolean {
  const { sourceLabel, taskId, code, callbackType } = params;
  if (!taskId || typeof taskId !== 'string') return false;
  if (!Number.isFinite(code) || code !== 200) return false;
  if (callbackType === 'error') return false;
  return RECORD_INFO_RECONCILE_SOURCE_LABELS.has(sourceLabel);
}

type RecordInfoBuildResult = {
  normalized: NormalizedKieCallback | null;
  reason: string;
  trackCount: number;
};

function mapRecordInfoTrackToCallbackTrack(rawTrack: unknown): Record<string, unknown> | null {
  const track = asJsonRecord(rawTrack);
  const id = typeof track.id === 'string' ? track.id.trim() : '';
  if (!id) return null;

  const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

  return {
    id,
    audio_url: asString(track.audio_url || track.audioUrl),
    stream_audio_url: asString(track.stream_audio_url || track.streamAudioUrl),
    image_url: asString(track.image_url || track.imageUrl),
    prompt: asString(track.prompt),
    model_name: asString(track.model_name || track.modelName),
    title: asString(track.title),
    tags: asString(track.tags),
    createTime: asString(track.createTime || track.create_time),
    duration: toFiniteNumber(track.duration) ?? null,
    source_audio_url: asString(track.source_audio_url || track.sourceAudioUrl),
    source_stream_audio_url: asString(track.source_stream_audio_url || track.sourceStreamAudioUrl),
    source_image_url: asString(track.source_image_url || track.sourceImageUrl),
  };
}

async function buildNormalizedCallbackFromRecordInfo(taskId: string, callbackId: string): Promise<RecordInfoBuildResult> {
  const apiKey = process.env.KIE_API_KEY;
  const baseUrl = process.env.KIE_API_BASE_URL || 'https://api.kie.ai';

  if (!apiKey) {
    return {
      normalized: null,
      reason: 'missing_kie_api_key',
      trackCount: 0,
    };
  }

  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const recordInfoUrl = `${normalizedBaseUrl}/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`;

  let response: Response;
  try {
    response = await fetch(recordInfoUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
  } catch (error) {
    console.warn(`[CALLBACK-${callbackId}] Record-info request failed:`, error);
    return {
      normalized: null,
      reason: 'record_info_request_failed',
      trackCount: 0,
    };
  }

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    console.warn(
      `[CALLBACK-${callbackId}] Record-info response not ok: ${response.status} ${response.statusText} ${details}`
    );
    return {
      normalized: null,
      reason: `record_info_http_${response.status}`,
      trackCount: 0,
    };
  }

  let recordPayload: unknown;
  try {
    recordPayload = await response.json();
  } catch (error) {
    console.warn(`[CALLBACK-${callbackId}] Record-info JSON parse failed:`, error);
    return {
      normalized: null,
      reason: 'record_info_invalid_json',
      trackCount: 0,
    };
  }

  const root = asJsonRecord(recordPayload);
  const data = asJsonRecord(root.data);
  const responseNode = asJsonRecord(data.response);
  const resolvedTaskId =
    (typeof data.taskId === 'string' && data.taskId.trim()) ||
    (typeof data.task_id === 'string' && data.task_id.trim()) ||
    (typeof responseNode.taskId === 'string' && responseNode.taskId.trim()) ||
    (typeof responseNode.task_id === 'string' && responseNode.task_id.trim()) ||
    taskId;

  const sunoDataCandidates: unknown[] = [
    responseNode.sunoData,
    responseNode.data,
    data.sunoData,
    data.data,
  ];
  let rawTracks: unknown[] = [];
  for (const candidate of sunoDataCandidates) {
    if (Array.isArray(candidate)) {
      rawTracks = candidate;
      break;
    }
  }

  const mappedTracks = rawTracks
    .map((track) => mapRecordInfoTrackToCallbackTrack(track))
    .filter((track): track is Record<string, unknown> => Boolean(track));

  if (mappedTracks.length === 0) {
    return {
      normalized: null,
      reason: 'record_info_no_tracks',
      trackCount: 0,
    };
  }

  const inferredCallbackType = inferCallbackTypeFromTracks(mappedTracks) || 'complete';
  const rootCode = toFiniteNumber(root.code);
  const syntheticPayload = {
    code: Number.isFinite(rootCode) ? (rootCode as number) : 200,
    msg: typeof root.msg === 'string' ? root.msg : 'Reconciled from record-info',
    data: {
      callbackType: inferredCallbackType,
      task_id: resolvedTaskId,
      data: mappedTracks,
    },
  };

  const normalized = normalizeKieCallback(syntheticPayload, {
    defaultCallbackType: inferredCallbackType,
  });

  return {
    normalized,
    reason: 'ok',
    trackCount: mappedTracks.length,
  };
}

type RecordInfoReconcileResult = {
  recovered: boolean;
  reason: string;
  trackCount: number;
};

async function tryRecoverWithRecordInfo(params: {
  sourceLabel: string;
  taskId: string;
  code: number;
  callbackType?: string;
  callbackId: string;
  onProcess: (callback: NormalizedKieCallback, callbackId: string) => Promise<boolean> | boolean;
}): Promise<RecordInfoReconcileResult> {
  const { sourceLabel, taskId, code, callbackType, callbackId, onProcess } = params;

  if (!shouldAttemptRecordInfoReconcile({ sourceLabel, taskId, code, callbackType })) {
    return {
      recovered: false,
      reason: 'reconcile_not_applicable',
      trackCount: 0,
    };
  }

  const buildResult = await buildNormalizedCallbackFromRecordInfo(taskId, callbackId);
  if (!buildResult.normalized) {
    return {
      recovered: false,
      reason: buildResult.reason,
      trackCount: buildResult.trackCount,
    };
  }

  const replayCallbackId = `${callbackId}_recordinfo`;
  const replayProcessed = await onProcess(buildResult.normalized, replayCallbackId);

  if (!replayProcessed) {
    return {
      recovered: false,
      reason: 'record_info_replay_onprocess_false',
      trackCount: buildResult.trackCount,
    };
  }

  console.log(
    `[CALLBACK-${callbackId}] Record-info reconcile succeeded for task ${taskId} with ${buildResult.trackCount} tracks`
  );

  return {
    recovered: true,
    reason: 'record_info_replayed',
    trackCount: buildResult.trackCount,
  };
}

function extractTracksFromPayload(root: JsonRecord, data: JsonRecord, payload: JsonRecord): any[] {
  const candidates: unknown[] = [
    data.data,
    data.tracks,
    data.output,
    data.result,
    payload.data,
    payload.tracks,
    root.tracks,
    root.data,
  ];

  for (const candidate of candidates) {
    const parsedCandidate = tryParseJsonValue(candidate);
    if (Array.isArray(parsedCandidate)) {
      return parsedCandidate;
    }
    if (isJsonRecord(parsedCandidate)) {
      const nestedArrayCandidates = [
        parsedCandidate.data,
        parsedCandidate.tracks,
        parsedCandidate.output,
        parsedCandidate.result,
      ];
      for (const nestedCandidate of nestedArrayCandidates) {
        const parsedNested = tryParseJsonValue(nestedCandidate);
        if (Array.isArray(parsedNested)) {
          return parsedNested;
        }
      }
    }
  }

  return [];
}

function inferCallbackTypeFromTracks(tracks: any[]): string | undefined {
  if (!Array.isArray(tracks) || tracks.length === 0) return undefined;

  const allAudioReady = tracks.every((track: any) =>
    typeof track?.audio_url === 'string' && track.audio_url.trim() !== ''
  );
  if (allAudioReady) return 'complete';

  const hasFirstSignals = tracks.some((track: any) =>
    (typeof track?.duration === 'number' && Number.isFinite(track.duration)) ||
    (typeof track?.audio_url === 'string' && track.audio_url.trim() !== '')
  );
  if (hasFirstSignals) return 'first';

  return 'text';
}

export function normalizeKieCallback(
  callbackData: any,
  options?: { defaultCallbackType?: string }
): NormalizedKieCallback {
  const root = asJsonRecord(callbackData);
  const payload = asJsonRecord(root.payload);
  const data = asJsonRecord(root.data);
  const nestedData = asJsonRecord(data.data);

  const code = toFiniteNumber(
    root.code ??
    data.code ??
    payload.code ??
    nestedData.code
  ) ?? Number.NaN;

  const msg =
    root.msg ||
    root.message ||
    data.msg ||
    data.message ||
    payload.msg ||
    payload.message;
  const taskId =
    data?.task_id ||
    data?.taskId ||
    root?.task_id ||
    root?.taskId ||
    payload?.task_id ||
    payload?.taskId ||
    nestedData?.task_id ||
    nestedData?.taskId;

  const callbackTypeRaw =
    data?.callbackType ??
    data?.status ??
    root?.callbackType ??
    root?.status ??
    payload?.callbackType ??
    payload?.status ??
    options?.defaultCallbackType;
  let callbackType = normalizeCallbackType(callbackTypeRaw);

  const tracks = extractTracksFromPayload(root, data, payload);

  const knownCallbackTypes = new Set(['text', 'first', 'complete']);
  if (code === 200 && !knownCallbackTypes.has(callbackType || '')) {
    callbackType = inferCallbackTypeFromTracks(tracks) || callbackType;
  }

  const errorMessage = (code !== 200
    ? (
      msg ||
      data?.error_message ||
      payload?.error_message ||
      root?.error_message ||
      nestedData?.error_message
    )
    : (
      data?.error_message ||
      payload?.error_message ||
      root?.error_message ||
      nestedData?.error_message
    )) || undefined;

  return {
    code,
    msg,
    taskId,
    callbackType,
    tracks,
    errorMessage,
    raw: root,
  };
}

export async function handleKieCallback(
  request: NextRequest,
  options: {
    sourceLabel: string;
    onProcess: (callback: NormalizedKieCallback, callbackId: string) => Promise<boolean> | boolean;
    defaultCallbackType?: string;
    enableIdempotency?: boolean;
  }
) {
  const startTime = Date.now();
  const sourceLabel = options.sourceLabel || 'default';
  const callbackId = `${sourceLabel}_callback_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  console.log(`[CALLBACK-${callbackId}] Suno callback received (${sourceLabel})`);

  try {
    const rawBody = await request.text();
    let callbackData: any = {};
    if (rawBody.trim().length > 0) {
      try {
        callbackData = JSON.parse(rawBody);
      } catch {
        const params = new URLSearchParams(rawBody);
        if (params.size > 0 && (params.has('task_id') || params.has('taskId') || params.has('code'))) {
          callbackData = Object.fromEntries(params.entries());
        } else {
          const invalidBodyResponse = NextResponse.json(
            {
              success: false,
              error: 'Invalid callback payload: body is not valid JSON',
              processedAt: new Date().toISOString(),
            },
            { status: 400 }
          );
          invalidBodyResponse.headers.set('Access-Control-Allow-Origin', '*');
          invalidBodyResponse.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
          invalidBodyResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          return invalidBodyResponse;
        }
      }
    }
    const payloadTracks = Array.isArray(callbackData?.data?.data)
      ? callbackData.data.data.length
      : (Array.isArray(callbackData?.data) ? callbackData.data.length : 0);
    console.log(
      `[CALLBACK-${callbackId}] Payload summary: taskId=${callbackData?.data?.task_id || callbackData?.task_id || callbackData?.taskId || 'unknown'}, code=${callbackData?.code ?? 'unknown'}, callbackType=${normalizeCallbackType(callbackData?.data?.callbackType || callbackData?.callbackType) || 'unknown'}, tracks=${payloadTracks}`
    );
    const normalized = normalizeKieCallback(callbackData, {
      defaultCallbackType: options.defaultCallbackType,
    });

    const { code, taskId, callbackType, tracks } = normalized;
    if (!taskId || typeof taskId !== 'string') {
      console.error(`[CALLBACK-${callbackId}] Invalid callback payload: missing task_id/taskId`);
      const invalidResponse = NextResponse.json(
        {
          success: false,
          error: 'Invalid callback payload: missing task_id/taskId',
          callbackType,
          processedAt: new Date().toISOString(),
        },
        { status: 400 }
      );
      invalidResponse.headers.set('Access-Control-Allow-Origin', '*');
      invalidResponse.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      invalidResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return invalidResponse;
    }

    if (!Number.isFinite(code)) {
      console.error(`[CALLBACK-${callbackId}] Invalid callback payload: missing/invalid code`);
      const invalidResponse = NextResponse.json(
        {
          success: false,
          error: 'Invalid callback payload: missing/invalid code',
          taskId,
          callbackType,
          processedAt: new Date().toISOString(),
        },
        { status: 400 }
      );
      invalidResponse.headers.set('Access-Control-Allow-Origin', '*');
      invalidResponse.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      invalidResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return invalidResponse;
    }

    let callbackEventId: string | undefined;
    try {
      const hashSource = rawBody.trim().length > 0 ? rawBody : JSON.stringify(callbackData || {});
      const payloadHash = createHash('sha256').update(hashSource).digest('hex');
      const callbackEventResult = await createCallbackEvent({
        provider: 'kie',
        sourceLabel,
        taskId,
        callbackType: callbackType || null,
        code,
        payload: callbackData,
        payloadHash,
      });

      if (callbackEventResult.enabled) {
        callbackEventId = callbackEventResult.eventId;
      }

      if (callbackEventResult.enabled && !callbackEventResult.accepted) {
        console.log(
          `[CALLBACK-${callbackId}] Duplicate callback ignored by callback_events gate: taskId=${taskId}, status=${callbackEventResult.duplicateStatus || 'unknown'}`
        );
        return NextResponse.json({
          success: true,
          message: 'Duplicate callback ignored',
          taskId,
          callbackType,
          processedAt: new Date().toISOString(),
        });
      }
    } catch (eventError) {
      console.warn(`[CALLBACK-${callbackId}] Failed to persist callback event (fallback to legacy path):`, eventError);
    }

    const idempotencyEnabled = options.enableIdempotency !== false;
    const taskKey = taskId ? `${taskId}_${callbackType || 'unknown'}_${code}_${sourceLabel}` : undefined;
    const completedKey = taskId ? `${taskId}_completed` : undefined;

    console.log(`[CALLBACK-${callbackId}] Processing callback: ${taskId}, code: ${code}`);

    if (idempotencyEnabled && taskKey) {
      if (isActiveTaskKey(processedTasks, taskKey, CALLBACK_IDEMPOTENCY_TTL_MS)) {
        // 对 complete 回调做状态旁路：若 DB 还不是 complete，允许重放，避免历史脏 key 永久阻断修复
        if (taskId && callbackType === 'complete') {
          try {
            const statusResult = await query(
              'SELECT status FROM music WHERE task_id = $1 LIMIT 1',
              [taskId]
            );
            const currentStatus = statusResult.rows[0]?.status;
            if (currentStatus !== 'complete') {
              console.warn(
                `[CALLBACK-${callbackId}] complete callback idempotency bypassed because DB status is ${currentStatus || 'unknown'}`
              );
              processedTasks.delete(taskKey);
            } else {
              console.log(`[CALLBACK-${callbackId}] Already processed`);
              return NextResponse.json({
                success: true,
                message: 'Already processed',
                taskId: taskId,
                callbackType: callbackType,
                processedAt: new Date().toISOString()
              });
            }
          } catch (statusCheckError) {
            console.warn(`[CALLBACK-${callbackId}] Failed to check DB status for idempotency bypass:`, statusCheckError);
            // 状态查询异常时优先允许继续处理，避免误拦截外部重试修复
            processedTasks.delete(taskKey);
          }
        } else {
          console.log(`[CALLBACK-${callbackId}] Already processed`);
          return NextResponse.json({
            success: true,
            message: 'Already processed',
            taskId: taskId,
            callbackType: callbackType,
            processedAt: new Date().toISOString()
          });
        }
      }

      if (isActiveTaskKey(processingTasks, taskKey, CALLBACK_IDEMPOTENCY_TTL_MS)) {
        console.log(`[CALLBACK-${callbackId}] Processing in progress`);
        return NextResponse.json({
          success: true,
          message: 'Processing in progress',
          taskId: taskId,
          callbackType: callbackType,
          processedAt: new Date().toISOString()
        });
      }

      if (code === 200 && tracks.length > 0) {
        const allAudioReady = tracks.every((track: any) =>
          track.audio_url && track.audio_url.trim() !== ''
        );

        if (allAudioReady && completedKey && isActiveTaskKey(processedTasks, completedKey, CALLBACK_IDEMPOTENCY_TTL_MS)) {
          console.log(`[CALLBACK-${callbackId}] Already completed`);
          return NextResponse.json({
            success: true,
            message: 'Already completed',
            taskId: taskId,
            processedAt: new Date().toISOString()
          });
        }
      }
    }

    const response = NextResponse.json({
      status: 'received'
    });

    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    setImmediate(async () => {
      let processedSuccessfully = false;
      let failureReason: string | undefined;
      try {
        if (callbackEventId) {
          await markCallbackEventProcessing(callbackEventId);
        }

        if (idempotencyEnabled && taskKey) {
          processingTasks.set(taskKey, Date.now());
        }

        processedSuccessfully = await options.onProcess(normalized, callbackId);

        if (!processedSuccessfully) {
          const reconcileResult = await tryRecoverWithRecordInfo({
            sourceLabel,
            taskId,
            code,
            callbackType,
            callbackId,
            onProcess: options.onProcess,
          });

          if (reconcileResult.recovered) {
            processedSuccessfully = true;
            console.log(
              `[CALLBACK-${callbackId}] Marked as processed after record-info reconcile (${reconcileResult.trackCount} tracks)`
            );
          } else {
            console.warn(
              `[CALLBACK-${callbackId}] Record-info reconcile skipped/failed: ${reconcileResult.reason}`
            );
            failureReason = `reconcile_failed:${reconcileResult.reason}`;
            await recordIncompleteProcessError({
              taskId,
              callbackType,
              code,
              sourceLabel,
              callbackId,
              reason: reconcileResult.reason,
            });
          }
        }

        if (idempotencyEnabled && taskKey) {
          if (processedSuccessfully) {
            processedTasks.set(taskKey, Date.now());
            console.log(`[CALLBACK-${callbackId}] Marked callback as processed: ${taskKey}`);
          } else {
            if (!failureReason) {
              failureReason = 'onprocess_false';
            }
            console.warn(`[CALLBACK-${callbackId}] Callback not marked as processed (failed/incomplete): ${taskKey}`);
          }
        }
      } catch (processError) {
        failureReason = processError instanceof Error ? processError.message : 'async_processor_exception';
        console.error(`[CALLBACK-${callbackId}] Async callback processor threw error:`, processError);
      } finally {
        if (callbackEventId) {
          try {
            if (processedSuccessfully) {
              await markCallbackEventProcessed(callbackEventId);
            } else {
              await markCallbackEventFailed(callbackEventId, failureReason || 'callback_not_processed');
            }
          } catch (eventStatusError) {
            console.error(`[CALLBACK-${callbackId}] Failed to update callback_events status:`, eventStatusError);
          }
        }

        if (idempotencyEnabled && taskKey) {
          processingTasks.delete(taskKey);
        }
      }
    });

    return response;
  } catch (error) {
    console.error(`[CALLBACK-${callbackId}] Callback processing error:`, error);

    const errorResponse = NextResponse.json(
      {
        error: 'Internal server error',
        success: false,
        processedAt: new Date().toISOString()
      },
      { status: 500 }
    );

    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    errorResponse.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return errorResponse;
  } finally {
    const duration = Date.now() - startTime;
    console.log(`[CALLBACK-${callbackId}] Request handled in ${duration}ms`);
  }
}

export async function reconcileMusicTaskFromRecordInfo(
  taskId: string,
  sourceLabel: string = 'cron-reconcile'
): Promise<{ success: boolean; reason: string; trackCount: number }> {
  const callbackId = `${sourceLabel}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  if (!taskId || typeof taskId !== 'string') {
    return {
      success: false,
      reason: 'invalid_task_id',
      trackCount: 0,
    };
  }

  const buildResult = await buildNormalizedCallbackFromRecordInfo(taskId, callbackId);
  if (!buildResult.normalized) {
    return {
      success: false,
      reason: buildResult.reason,
      trackCount: buildResult.trackCount,
    };
  }

  const processed = await processCallbackAsync(buildResult.normalized, callbackId);
  if (!processed) {
    await recordIncompleteProcessError({
      taskId,
      callbackType: buildResult.normalized.callbackType,
      code: buildResult.normalized.code,
      sourceLabel,
      callbackId,
      reason: `${sourceLabel}_onprocess_false`,
    });
  }

  return {
    success: processed,
    reason: processed ? 'reconciled' : 'reconcile_onprocess_false',
    trackCount: buildResult.trackCount,
  };
}

const clampTitle = (value?: string | null, fallback = 'Untitled') => {
  const normalized = (value || '').toString().trim();
  const safe = normalized.length > 0 ? normalized : fallback;
  return safe.length > 255 ? safe.slice(0, 255) : safe;
};

const UPLOAD_DERIVED_MUSIC_TYPES: MusicType[] = [
  'upload_cover',
  'upload_extend',
  'upload_mashup',
  'upload_vocal',
  'upload_melody',
];

const isUploadDerivedMusicType = (musicType: MusicType | null | undefined) => {
  if (!musicType) return false;
  return UPLOAD_DERIVED_MUSIC_TYPES.includes(musicType);
};

const upsertLyrics = async (
  musicId: string,
  title: string | null | undefined,
  content: string,
  callbackId: string
) => {
  const normalized = (content || '').trim();
  if (!normalized) return;
  const lyricsTitle = resolveLyricsTitle(title, normalized);
  try {
    const existing = await query(
      'SELECT id, content FROM lyrics WHERE music_id = $1',
      [musicId]
    );
    if (existing.rows.length > 0) {
      const existingContent = (existing.rows[0]?.content || '').toString().trim();
      if (existingContent.length > 0) {
        return;
      }
      await query(
        'UPDATE lyrics SET title = $1, content = $2 WHERE music_id = $3',
        [lyricsTitle, normalized, musicId]
      );
    } else {
      await query(
        'INSERT INTO lyrics (music_id, title, content) VALUES ($1, $2, $3)',
        [musicId, lyricsTitle, normalized]
      );
    }
  } catch (lyricsError) {
    console.error(`[CALLBACK-${callbackId}] Failed to upsert lyrics:`, lyricsError);
  }
};

type TrackAlignmentState = {
  tracksBySunoId: Map<string, string>;
  unboundTrackIds: string[];
};

function isUniqueViolationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { code?: string }).code === '23505';
}

async function findTrackIdByMusicAndSunoId(
  musicGenerationId: string,
  sunoTrackId: string
): Promise<string | null> {
  const existingTrack = await query<{ id: string }>(
    `SELECT id
     FROM tracks
     WHERE music_id = $1
       AND suno_track_id = $2
       AND (is_deleted IS NULL OR is_deleted = FALSE)
     ORDER BY updated_at DESC
     LIMIT 1`,
    [musicGenerationId, sunoTrackId]
  );

  return existingTrack.rows[0]?.id || null;
}

function normalizeTrackDuration(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function loadTrackAlignmentState(musicGenerationId: string): Promise<TrackAlignmentState> {
  const existingTracksQuery = await query(
    `SELECT id, suno_track_id
     FROM tracks
     WHERE music_id = $1
       AND (is_deleted IS NULL OR is_deleted = FALSE)
     ORDER BY created_at ASC, id ASC`,
    [musicGenerationId]
  );

  const tracksBySunoId = new Map<string, string>();
  const unboundTrackIds: string[] = [];

  for (const row of existingTracksQuery.rows as Array<{ id: string; suno_track_id: string | null }>) {
    const sunoTrackId = typeof row.suno_track_id === 'string' ? row.suno_track_id.trim() : '';
    if (sunoTrackId) {
      tracksBySunoId.set(sunoTrackId, row.id);
    } else {
      unboundTrackIds.push(row.id);
    }
  }

  return { tracksBySunoId, unboundTrackIds };
}

async function resolveTrackRecordId(params: {
  musicGenerationId: string;
  sunoTrackId: string;
  streamAudioUrl?: string | null;
  trackTitle: string;
  duration?: number | null;
  isPublished?: boolean;
  alignmentState: TrackAlignmentState;
}): Promise<string> {
  const {
    musicGenerationId,
    sunoTrackId,
    streamAudioUrl,
    trackTitle,
    duration = null,
    isPublished = false,
    alignmentState,
  } = params;

  const existingTrackId = alignmentState.tracksBySunoId.get(sunoTrackId);
  if (existingTrackId) {
    return existingTrackId;
  }

  if (alignmentState.unboundTrackIds.length > 0) {
    const unboundTrackId = alignmentState.unboundTrackIds.shift() as string;
    try {
      await query(
        `UPDATE tracks SET
          suno_track_id = $1,
          stream_audio_url = COALESCE(NULLIF($2, ''), stream_audio_url),
          title = COALESCE(NULLIF($3, ''), title),
          duration = COALESCE($4, duration),
          updated_at = NOW()
        WHERE id = $5`,
        [
          sunoTrackId,
          streamAudioUrl || '',
          trackTitle,
          duration,
          unboundTrackId,
        ]
      );
    } catch (error) {
      if (!isUniqueViolationError(error)) {
        throw error;
      }
      const existingTrackId = await findTrackIdByMusicAndSunoId(musicGenerationId, sunoTrackId);
      if (existingTrackId) {
        alignmentState.tracksBySunoId.set(sunoTrackId, existingTrackId);
        return existingTrackId;
      }
      throw error;
    }
    alignmentState.tracksBySunoId.set(sunoTrackId, unboundTrackId);
    return unboundTrackId;
  }

  let createdTrack;
  try {
    createdTrack = await query(
      `INSERT INTO tracks (
        music_id, suno_track_id, stream_audio_url, title, duration, is_published, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id`,
      [
        musicGenerationId,
        sunoTrackId,
        streamAudioUrl || null,
        trackTitle,
        duration,
        isPublished,
      ]
    );
  } catch (error) {
    if (!isUniqueViolationError(error)) {
      throw error;
    }
    const existingTrackId = await findTrackIdByMusicAndSunoId(musicGenerationId, sunoTrackId);
    if (!existingTrackId) {
      throw error;
    }
    alignmentState.tracksBySunoId.set(sunoTrackId, existingTrackId);
    return existingTrackId;
  }

  const createdTrackId = createdTrack.rows[0]?.id;
  if (!createdTrackId) {
    throw new Error(`Failed to create track for suno_track_id=${sunoTrackId}`);
  }

  alignmentState.tracksBySunoId.set(sunoTrackId, createdTrackId);
  return createdTrackId;
}

/**
 * 重试数据库操作的辅助函数
 * @param operation 要执行的数据库操作
 * @param maxRetries 最大重试次数
 * @param callbackId 回调ID用于日志
 * @param operationName 操作名称用于日志
 */
async function retryDatabaseOperation(
  operation: () => Promise<void>,
  maxRetries: number,
  callbackId: string,
  operationName: string
): Promise<void> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await operation();
      if (attempt > 1) {
        console.log(`[CALLBACK-${callbackId}] ${operationName} succeeded on attempt ${attempt}/${maxRetries}`);
      }
      return; // 成功，退出
    } catch (error) {
      lastError = error as Error;
      console.error(`[CALLBACK-${callbackId}] ${operationName} failed on attempt ${attempt}/${maxRetries}:`, error);
      
      if (attempt < maxRetries) {
        // 指数退避：1s, 2s, 4s, 8s, 16s
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 16000);
        console.log(`[CALLBACK-${callbackId}] Retrying ${operationName} in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  // 所有重试都失败了
  console.error(`[CALLBACK-${callbackId}] ${operationName} failed after ${maxRetries} attempts`);
  throw new Error(`Database operation failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
}

// Handle Suno API callbacks
export async function handleSunoCallback(request: NextRequest, source: string) {
  return handleKieCallback(request, {
    sourceLabel: source || 'default',
    onProcess: (callback, callbackId) => {
      return processCallbackAsync(callback, callbackId);
    }
  });
}

// 添加OPTIONS方法支持CORS预检请求
export async function OPTIONS(_request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

/**
 * 处理音乐生成回调的核心函数
 * 功能：接收KIE AI的回调通知，处理不同类型的回调（text/first/complete），
 * 存储数据到数据库和R2
 */
async function processCallbackAsync(callback: NormalizedKieCallback, callbackId: string) {
  const asyncStartTime = Date.now();
  console.log(`[CALLBACK-${callbackId}] Starting async processing`);
  let taskId: string | undefined;

  try {
    // 1. 解析回调数据
    const { code, taskId: parsedTaskId, callbackType: rawCallbackType, tracks, msg, raw } = callback;
    taskId = parsedTaskId;
    console.log(
      `[CALLBACK-${callbackId}] Async summary: taskId=${taskId || 'unknown'}, code=${code}, callbackType=${rawCallbackType || 'unknown'}, tracks=${tracks.length}, status=${raw?.data?.status || 'unknown'}, msg=${msg || raw?.msg || ''}`
    );

    if (!taskId) {
      console.error(`[CALLBACK-${callbackId}] Missing taskId in callback payload`);
      return false;
    }
    const taskIdValue = taskId;

    // 2. 识别回调类型并处理
    let callbackType = rawCallbackType;

    if (code === 200 && Array.isArray(tracks) && tracks.length > 0 && !callbackType) {
      callbackType = inferCallbackTypeFromTracks(tracks);
      if (callbackType) {
        console.log(`[CALLBACK-${callbackId}] Inferred callbackType=${callbackType} from payload shape`);
      }
    }

    if (code === 200 && Array.isArray(tracks)) {
      console.log(`[CALLBACK-${callbackId}] Processing ${tracks.length} tracks`);

      // 4. 根据不同的回调类型处理
      if (callbackType === 'text') {
        console.log(`[CALLBACK-${callbackId}] TEXT callback`);

        // 4.1 text回调：只存储数据到数据库
        // 使用第一个track的元数据更新数据库（除了audio_url以外的所有值）
        const primaryTrack = tracks[0] || {};

        // 4.1.1 查询music记录获取type和现有title
        const musicGenQuery = await query(
          'SELECT id, type, title, prompt, status FROM music WHERE task_id = $1',
          [taskId]
        );

        if (musicGenQuery.rows.length === 0) {
          console.error(`[CALLBACK-${callbackId}] No music record found for taskId: ${taskId}`);
          return false;
        }

        const musicRecord = musicGenQuery.rows[0];
        const musicGenerationId = musicRecord.id;
        const musicType = musicRecord.type as MusicType;
        const existingTitle = musicRecord.title;
        const promptFallback = musicRecord.prompt;
        const currentMusicStatus = typeof musicRecord.status === 'string' ? musicRecord.status : 'generating';
        const trimmedExistingTitle = (existingTitle || '').trim();
        const hasUserProvidedTitle = trimmedExistingTitle.length > 0;

        // 4.1.2 更新音乐生成记录的元数据
        const styleFromTags = typeof primaryTrack.tags === 'string' ? primaryTrack.tags : undefined;

        // 使用接口返回的标题，如果没有则使用默认值
        const extractedTitle = clampTitle(
          typeof primaryTrack.title === 'string' ? primaryTrack.title : undefined,
          'Untitled'
        );

        // 构建更新对象，只包含有值的字段
        if (
          currentMusicStatus === 'first' ||
          currentMusicStatus === 'complete' ||
          currentMusicStatus === 'error'
        ) {
          console.log(
            `[CALLBACK-${callbackId}] TEXT callback ignored because current status is ${currentMusicStatus}`
          );
          return true;
        }

        const metadataPatch: any = {};

        // 对于 upload 类型或用户自定义标题，保持原始标题；否则采用 text 回调标题
        if (isUploadDerivedMusicType(musicType)) {
          console.log(`[CALLBACK-${callbackId}] Upload type detected (${musicType}), preserving user title: ${existingTitle}`);
        } else if (!hasUserProvidedTitle) {
          metadataPatch.title = extractedTitle;
        } else {
          console.log(`[CALLBACK-${callbackId}] User provided custom title (${trimmedExistingTitle}), skipping API title`);
        }
        if (typeof styleFromTags === 'string' && styleFromTags.trim()) {
          metadataPatch.tags = styleFromTags;
        }

        try {
          // 实际执行数据库更新操作（状态只允许前进，避免乱序回调回退状态）
          const transitionResult = await transitionMusicGenerationStatusByTaskId(
            taskId as string,
            'text',
            metadataPatch
          );
          if (!transitionResult.updated) {
            console.log(
              `[CALLBACK-${callbackId}] TEXT callback skipped because transition is not allowed from current status`
            );
            return true;
          }
          console.log(
            `[CALLBACK-${callbackId}] Updated music record with tags${metadataPatch.title ? ' and title' : ''}`
          );
        } catch (dbError) {
          console.error(`[CALLBACK-${callbackId}] Failed to update music generation record with text data:`, dbError);
          return false;
        }

        // 4.1.3 存储歌词到lyrics表
        const shouldUsePromptFallback = !(isUploadDerivedMusicType(musicType));
        const primaryPrompt = typeof primaryTrack.prompt === 'string' ? primaryTrack.prompt : '';
        const lyricsContent = primaryPrompt || (shouldUsePromptFallback ? promptFallback : '') || '';
        // 对于 upload 类型或用户自定义标题，优先使用现有标题；否则使用回调标题并允许空值回退到歌词首句。
        const titleForLyrics =
          (isUploadDerivedMusicType(musicType) || hasUserProvidedTitle)
            ? (trimmedExistingTitle || existingTitle || '')
            : (typeof primaryTrack.title === 'string' ? primaryTrack.title : '');

        if (lyricsContent.trim().length > 0) {
          await upsertLyrics(musicGenerationId, titleForLyrics, lyricsContent, callbackId);
        }

        // 4.1.4 更新已存在的tracks记录
        try {
          const alignmentState = await loadTrackAlignmentState(musicGenerationId);

          for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            const sunoTrackId = typeof track?.id === 'string' ? track.id.trim() : '';
            if (!sunoTrackId) continue;

            let trackTitle: string;
            if (isUploadDerivedMusicType(musicType) || hasUserProvidedTitle) {
              trackTitle = trimmedExistingTitle || existingTitle || 'Untitled';
            } else {
              trackTitle = track.title || extractedTitle;
            }
            trackTitle = clampTitle(trackTitle, 'Untitled');

            const resolvedTrackId = await resolveTrackRecordId({
              musicGenerationId,
              sunoTrackId,
              streamAudioUrl: track.stream_audio_url || null,
              trackTitle,
              duration: normalizeTrackDuration(track.duration),
              alignmentState,
            });

            await query(
              `UPDATE tracks SET
                stream_audio_url = COALESCE(NULLIF($1, ''), stream_audio_url),
                title = COALESCE(NULLIF($2, ''), title),
                duration = COALESCE($3, duration),
                updated_at = NOW()
              WHERE id = $4`,
              [
                track.stream_audio_url || '',
                trackTitle,
                normalizeTrackDuration(track.duration),
                resolvedTrackId,
              ]
            );
          }

          if (tracks.length === 0) {
            console.warn(`[CALLBACK-${callbackId}] Text callback has no tracks and no placeholders for music_id: ${musicGenerationId}`);
          }
        } catch (tracksError) {
          console.error('Failed to update tracks records in text callback:', tracksError);
          return false;
        }

        // 4.1.5 封面生成优先在生成接口返回 taskId 后立即触发；first/complete 回调仅兜底补偿

        return true; // 直接返回，不处理其他逻辑
        
      } else if (callbackType === 'first') {
        // 4.2 first回调：将 audio_url 持久化到 R2，并更新数据库对应表字段
        console.log(`[CALLBACK-${callbackId}] FIRST callback`);
        try {

          const tracksWithProgress = tracks.filter((track: any) => {
            const sunoTrackId = typeof track?.id === 'string' ? track.id.trim() : '';
            if (!sunoTrackId) return false;

            const hasDuration = normalizeTrackDuration(track.duration) !== null;
            const hasStreamUrl = typeof track?.stream_audio_url === 'string' && track.stream_audio_url.trim() !== '';
            const hasAudioUrl = typeof track?.audio_url === 'string' && track.audio_url.trim() !== '';
            return hasDuration || hasStreamUrl || hasAudioUrl;
          });

          if (tracksWithProgress.length === 0) {
            console.log(`[CALLBACK-${callbackId}] No track progress data in FIRST callback`);
            return false;
          }
          // 查询 music 记录
          let finalUserId: string = 'anonymous';
          let finalTitle = 'Untitled Song';
          let promptFallback = '';
          let musicType: MusicType | null = null;
          const musicGenQuery = await query(
            'SELECT id, user_id, title, prompt, type, status FROM music WHERE task_id = $1',
            [taskId]
          );
          const musicGenerationId = musicGenQuery.rows[0]?.id;
          if (musicGenQuery.rows.length > 0) {
            finalUserId = musicGenQuery.rows[0].user_id || finalUserId;
            finalTitle = musicGenQuery.rows[0].title || finalTitle;
            promptFallback = musicGenQuery.rows[0].prompt || '';
            musicType = musicGenQuery.rows[0].type as MusicType;
            const currentStatus = typeof musicGenQuery.rows[0].status === 'string'
              ? musicGenQuery.rows[0].status
              : 'generating';
            if (currentStatus === 'complete' || currentStatus === 'error') {
              console.log(
                `[CALLBACK-${callbackId}] FIRST callback ignored because current status is ${currentStatus}`
              );
              return true;
            }
          }
          if (!musicGenerationId) {
            console.error(`No music record found for taskId: ${taskId} (first callback)`);
            return false;
          }

          const alignmentState = await loadTrackAlignmentState(musicGenerationId);
          let firstStageUpdatedCount = 0;

          // First 回调：主要补齐 stream 链接与时长，不上传最终音频
          for (let i = 0; i < tracksWithProgress.length; i++) {
            const track = tracksWithProgress[i];
            const sunoTrackId = typeof track?.id === 'string' ? track.id.trim() : '';
            if (!sunoTrackId) continue;

            try {
              const trackTitle = clampTitle(track.title || finalTitle, 'Untitled');
              const resolvedTrackId = await resolveTrackRecordId({
                musicGenerationId,
                sunoTrackId,
                streamAudioUrl: track.stream_audio_url || null,
                trackTitle,
                duration: normalizeTrackDuration(track.duration),
                alignmentState,
              });

              await query(
                `UPDATE tracks SET
                  duration = COALESCE($1, duration),
                  stream_audio_url = COALESCE(NULLIF($2, ''), stream_audio_url),
                  title = COALESCE(NULLIF($3, ''), title),
                  updated_at = NOW()
                WHERE id = $4`,
                [
                  normalizeTrackDuration(track.duration),
                  track.stream_audio_url || '',
                  trackTitle,
                  resolvedTrackId,
                ]
              );
              firstStageUpdatedCount++;
            } catch (err) {
              console.error(`Failed to process FIRST callback track ${track.id}:`, err);
            }
          }

          if (firstStageUpdatedCount === 0) {
            console.warn(`[CALLBACK-${callbackId}] FIRST callback did not update any track rows`);
            return false;
          }
          
          // 更新music状态为first (带重试机制)
          await retryDatabaseOperation(async () => {
            const transitionResult = await transitionMusicGenerationStatusByTaskId(taskIdValue, 'first');
            if (!transitionResult.updated) {
              console.log(
                `[CALLBACK-${callbackId}] FIRST callback skipped status transition due to forward-only guard`
              );
            }
          }, 3, callbackId, 'update status to first');

          if (!(isUploadDerivedMusicType(musicType))) {
            await upsertLyrics(
              musicGenerationId,
              finalTitle,
              promptFallback,
              callbackId
            );
          }

          // first 回调兜底触发封面生成：若生成接口阶段未成功触发，则在此补偿启动
          setImmediate(async () => {
            try {
              const coverExists = await query(
                'SELECT id FROM cover_generations WHERE music_task_id = $1 LIMIT 1',
                [taskIdValue]
              );

              if (coverExists.rows.length > 0) {
                console.log(`[CALLBACK-${callbackId}] FIRST: Cover generation already exists for taskId: ${taskIdValue}`);
                return;
              }

              const coverResponse = await fetch(`${process.env.CallBackURL}/api/cover/generate`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  musicTaskId: taskIdValue,
                  userId: finalUserId,
                }),
              });

              if (coverResponse.ok) {
                console.log(`[CALLBACK-${callbackId}] FIRST: ✅ Cover generation started for taskId: ${taskIdValue}`);
              } else {
                console.error(`[CALLBACK-${callbackId}] FIRST: ❌ Cover generation failed for taskId: ${taskIdValue}`);
              }
            } catch (coverError) {
              console.error(`[CALLBACK-${callbackId}] FIRST: Error starting cover generation:`, coverError);
            }
          });
          
        } catch (err) {
          console.error('First callback processing error:', err);
          return false;
        }
        return true; // 处理完成，返回

      } else if (callbackType === 'complete') {
        // 4.3 complete回调：处理最终音频文件上传到R2
        console.log(`[CALLBACK-${callbackId}] COMPLETE callback`);
        if (!Array.isArray(tracks) || tracks.length === 0) {
          console.warn(`[CALLBACK-${callbackId}] COMPLETE callback has no tracks, skipping`);
          return false;
        }

        const readyTrackCount = tracks.filter(
          (track: any) => typeof track?.audio_url === 'string' && track.audio_url.trim() !== ''
        ).length;
        if (readyTrackCount === 0) {
          console.log(`[CALLBACK-${callbackId}] Complete callback has no ready audio_url yet`);
          return false;
        }
        if (readyTrackCount < tracks.length) {
          console.warn(
            `[CALLBACK-${callbackId}] Complete callback contains partial audio URLs (${readyTrackCount}/${tracks.length})`
          );
        }
        // 获取用户ID和标题信息
        const musicGenQuery = await query(
          'SELECT id, user_id, title, prompt, tags FROM music WHERE task_id = $1',
          [taskId]
        );
        const musicGenerationId = musicGenQuery.rows[0]?.id;
        const finalUserId = musicGenQuery.rows[0]?.user_id || 'anonymous';
        const finalTitle = musicGenQuery.rows[0]?.title;
        const promptFallback = musicGenQuery.rows[0]?.prompt || '';
        const existingTags = (musicGenQuery.rows[0]?.tags || '').trim();
        const callbackPrompt = tracks
          .map((track: any) => (typeof track?.prompt === 'string' ? track.prompt.trim() : ''))
          .find((value: string) => value.length > 0) || '';
        const callbackTitle = tracks
          .map((track: any) => (typeof track?.title === 'string' ? track.title.trim() : ''))
          .find((value: string) => value.length > 0) || '';
        
        if (!musicGenerationId) {
          console.error(`No music record found for taskId: ${taskId} - this should not happen`);
          return false;
        }

        const callbackTags = Array.isArray(tracks)
          ? tracks
              .map((track) => {
                if (!track || typeof track !== 'object' || !('tags' in track)) {
                  return '';
                }
                const tagsValue = (track as { tags?: unknown }).tags;
                return typeof tagsValue === 'string' ? tagsValue.trim() : '';
              })
              .find((value) => value.length > 0)
          : '';

        if (callbackTags && callbackTags !== existingTags) {
          try {
            await updateMusicGenerationByTaskId(taskId as string, {
              tags: callbackTags
            });
            console.log(`[CALLBACK-${callbackId}] Complete: Updated tags from callback tracks`);
          } catch (tagsError) {
            console.error(`[CALLBACK-${callbackId}] Complete: Failed to update tags from callback tracks:`, tagsError);
          }
        }
        
        const alignmentState = await loadTrackAlignmentState(musicGenerationId);
        let uploadedTrackCount = 0;

        // Complete回调：统一处理所有音频文件上传到R2
        for (let i = 0; i < tracks.length; i++) {
          const track = tracks[i];
          const sunoTrackId = typeof track?.id === 'string' ? track.id.trim() : '';
          if (!sunoTrackId) {
            console.warn(`[CALLBACK-${callbackId}] Complete: track ${i + 1} missing id`);
            continue;
          }

          try {
            const trackTitle = clampTitle(track.title || finalTitle, 'Untitled');
            const resolvedTrackId = await resolveTrackRecordId({
              musicGenerationId,
              sunoTrackId,
              streamAudioUrl: track.stream_audio_url || null,
              trackTitle,
              duration: normalizeTrackDuration(track.duration),
              alignmentState,
            });

            // 使用 audio_url
            const audioUrl = track.audio_url;

            if (audioUrl && audioUrl.trim() !== '') {
              // 下载音频文件到R2（统一在complete回调处理）
              const audioBuffer = await downloadFromUrl(audioUrl);
              const filename = `${clampTitle(finalTitle, 'Untitled')}_${i + 1}.mp3`;
              const audioR2Url = await uploadAudioFile(audioBuffer, taskId, filename, finalUserId || 'anonymous');
              
              console.log(`[CALLBACK-${callbackId}] Complete: Uploaded audio for track ${i + 1} to R2: ${audioR2Url}`);
              
              // 更新数据库（包含audio_url和duration）
              await query(
                `UPDATE tracks SET 
                  audio_url = $1,
                  duration = $2,
                  stream_audio_url = COALESCE(NULLIF($3, ''), stream_audio_url),
                  title = COALESCE(NULLIF($4, ''), title),
                  updated_at = NOW()
                WHERE id = $5`,
                [
                  audioR2Url,
                  normalizeTrackDuration(track.duration),
                  track.stream_audio_url || '',
                  trackTitle,
                  resolvedTrackId
                ]
              );
              uploadedTrackCount++;
            } else {
              console.warn(`[CALLBACK-${callbackId}] Complete: No audio URL for track ${i + 1}`);
            }
          } catch (error) {
            console.error(`[CALLBACK-${callbackId}] Failed to process track ${i + 1}:`, error);
            // 音频处理失败，不更新数据库
          }
        }

        if (uploadedTrackCount === 0) {
          console.warn(`[CALLBACK-${callbackId}] COMPLETE callback processed 0 tracks, waiting for retry`);
          return false;
        }

        if (uploadedTrackCount < tracks.length) {
          const partialMessage = `Complete callback partially processed: ${uploadedTrackCount}/${tracks.length} tracks uploaded`;
          console.warn(`[CALLBACK-${callbackId}] ${partialMessage}`);
          if (finalUserId && finalUserId !== 'anonymous') {
            try {
              await createGenerationError(
                'music_generation',
                finalUserId,
                musicGenerationId,
                partialMessage,
                'PARTIAL_COMPLETE_UPLOAD'
              );
            } catch (warningError) {
              console.error(`[CALLBACK-${callbackId}] Failed to record partial complete warning:`, warningError);
            }
          }
        }
        
        // 更新music状态为complete (带重试机制)
        await retryDatabaseOperation(async () => {
          const transitionResult = await transitionMusicGenerationStatusByTaskId(taskIdValue, 'complete');
          if (!transitionResult.updated) {
            console.log(
              `[CALLBACK-${callbackId}] COMPLETE callback skipped status transition due to forward-only guard`
            );
          }
        }, 5, callbackId, 'update status to complete'); // complete 回调使用 5 次重试
        processedTasks.set(`${taskIdValue}_completed`, Date.now());

        const lyricsContent = callbackPrompt || (typeof promptFallback === 'string' ? promptFallback.trim() : '');
        const lyricsTitle = finalTitle || callbackTitle;
        if (callbackPrompt && typeof promptFallback === 'string' && promptFallback.trim().length > 0) {
          // 如果历史上已经先写入了 promptFallback（常见于 style 文本），允许 complete 回调用真实歌词覆盖。
          try {
            await query(
              `UPDATE lyrics
               SET content = ''
               WHERE music_id = $1
                 AND BTRIM(content) = BTRIM($2)`,
              [musicGenerationId, promptFallback]
            );
          } catch (lyricsResetError) {
            console.warn(`[CALLBACK-${callbackId}] Failed to reset fallback lyrics before complete upsert:`, lyricsResetError);
          }
        }

        await upsertLyrics(
          musicGenerationId,
          lyricsTitle,
          lyricsContent,
          callbackId
        );

        // complete 回调兜底触发封面生成：若 first 回调未成功触发，则在此补偿启动
        setImmediate(async () => {
          try {
            const coverExists = await query(
              'SELECT id FROM cover_generations WHERE music_task_id = $1 LIMIT 1',
              [taskIdValue]
            );

            if (coverExists.rows.length > 0) {
              console.log(`[CALLBACK-${callbackId}] Cover generation already exists for taskId: ${taskIdValue}`);
              return;
            }

            const coverResponse = await fetch(`${process.env.CallBackURL}/api/cover/generate`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                musicTaskId: taskIdValue,
                userId: finalUserId
              }),
            });

            if (coverResponse.ok) {
              console.log(`[CALLBACK-${callbackId}] ✅ Cover generation started for taskId: ${taskIdValue}`);
            } else {
              console.error(`[CALLBACK-${callbackId}] ❌ Cover generation failed for taskId: ${taskIdValue}`);
            }
          } catch (coverError) {
            console.error(`[CALLBACK-${callbackId}] Error starting cover generation:`, coverError);
          }
        });

        // 音乐生成完成后，提交到 IndexNow（后台异步，不阻塞主流程）
        setImmediate(async () => {
          try {
            // 查询是否有已发布的 tracks
            const publishedTracksQuery = await query(
              'SELECT id FROM tracks WHERE music_id = $1 AND is_published = true LIMIT 1',
              [musicGenerationId]
            );

            // 如果有已发布的 tracks，提交 explore 页面到 IndexNow
            if (publishedTracksQuery.rows.length > 0) {
              await submitExplorePageToIndexNow();
              console.log(`[CALLBACK-${callbackId}] Submitted explore page to IndexNow`);
            }
          } catch (indexError) {
            console.error(`[CALLBACK-${callbackId}] Failed to submit to IndexNow:`, indexError);
            // IndexNow 失败不影响主流程
          }
        });

        // 音乐生成完成后，备份封面图片到R2（兜底机制，callbacks/cover 可能已经处理过）
        try {
          // 查询需要备份的封面图片（使用新的cover_image_url字段）
          const coverImagesQuery = await query(
            `SELECT mt.id, mt.cover_image_url, cg.task_id as cover_task_id, cg.user_id
             FROM tracks mt
             JOIN music mg ON mt.music_id = mg.id
             JOIN cover_generations cg ON mg.task_id = cg.music_task_id
             WHERE cg.music_task_id = $1
             AND mt.cover_image_url LIKE 'http%'`,
            [taskId]
          );
          
          if (coverImagesQuery.rows.length > 0) {
            
            for (const track of coverImagesQuery.rows) {
              try {
                if (isManagedAssetUrl(track.cover_image_url)) {
                  continue;
                }

                const imageBuffer = await downloadFromUrl(track.cover_image_url);
                const filename = `${Date.now()}_${track.id}.png`;

                // Upload cover image
                const coverImageUrl = await uploadCoverImage(
                  imageBuffer,
                  track.cover_task_id,
                  filename,
                  track.user_id || 'anonymous'
                );

                // Update tracks record with cover URL
                await query(
                  'UPDATE tracks SET cover_image_url = $1 WHERE id = $2',
                  [coverImageUrl, track.id]
                );

              } catch (imageError) {
                console.error(`[CALLBACK-${callbackId}] Failed to backup cover image for track ${track.id}:`, imageError);
                // 备份失败不影响主流程，前端仍可使用临时URL
              }
            }
          }
        } catch (backupError) {
          console.error(`[CALLBACK-${callbackId}] Error during cover image backup:`, backupError);
          // 备份失败不影响主流程，前端仍可使用临时URL
        }
        
        return true;
      } else {
        console.log(`[CALLBACK-${callbackId}] Unknown callback type: ${callbackType}`);
        return false;
      }
      
    } else if (code !== 200) {
      // 5. 处理失败的回调
      console.log(`[CALLBACK-${callbackId}] FAILED callback: ${code}`);

      try {
        const failureMsg = msg || raw?.data?.msg || `Music generation failed with code ${code}`;

        // 先尝试找到扣费记录（用于退款与兜底）
        const creditTransactionResult = await query(
          `SELECT user_id, amount FROM credit_transactions
           WHERE reference_id = $1
           AND transaction_type = 'spend'
           ORDER BY created_at DESC LIMIT 1`,
          [taskId]
        );

        // 获取音乐生成记录信息
        const musicGenQuery = await query(
          'SELECT id, user_id, prompt, type, status FROM music WHERE task_id = $1',
          [taskId]
        );

        if (musicGenQuery.rows.length > 0) {
          const musicGeneration = musicGenQuery.rows[0];
          const musicType = musicGeneration.type as MusicType | undefined;
          const currentStatus = typeof musicGeneration.status === 'string'
            ? musicGeneration.status
            : 'generating';

          if (currentStatus === 'complete') {
            console.log(
              `[CALLBACK-${callbackId}] Ignoring error callback because current status is complete`
            );
            return true;
          }

          // 更新音乐生成状态为错误
          try {
            await transitionMusicGenerationStatusByTaskId(
              taskId,
              'error',
              {
                title: clampTitle(musicGeneration.prompt, 'Unknown'), // 使用用户输入的prompt作为标题
              }
            );
          } catch (updateError) {
            console.error(`[CALLBACK-${callbackId}] Failed to update music status on error:`, updateError);
          }

          // 创建错误记录
          await createGenerationError(
            'music_generation',
            musicGeneration.user_id,
            musicGeneration.id,
            failureMsg,
            `API_ERROR_${code}`
          );

          // 退还积分 - 因为用户没有得到任何音乐结果
          try {
            // 优先从数据库获取已扣除的积分（最准确）
            let creditCost = getMusicCredits('simple'); // 默认 Simple Mode 的积分消耗
            let refundUserId = musicGeneration.user_id;

            if (creditTransactionResult.rows.length > 0) {
              // 消费记录是负数，退款应该是正数
              creditCost = Math.abs(creditTransactionResult.rows[0].amount);
              refundUserId = creditTransactionResult.rows[0].user_id || refundUserId;
            } else {
              // 如果没有找到交易记录，根据 MusicType 确定退款金额
              console.warn(`No credit transaction found for taskId ${taskId}, determining refund by MusicType`);

              if (musicType === 'upload_cover') {
                creditCost = getFeatureCredits('upload_cover_music' as FeatureKey);
              } else if (musicType === 'upload_extend') {
                creditCost = getFeatureCredits('upload_extend_music' as FeatureKey);
              } else if (musicType === 'upload_mashup') {
                creditCost = getFeatureCredits('upload_mashup_music' as FeatureKey);
              } else if (musicType === 'upload_vocal') {
                creditCost = getFeatureCredits('add_vocals_music' as FeatureKey);
              } else if (musicType === 'upload_melody') {
                creditCost = getFeatureCredits('add_instrumental_music' as FeatureKey);
              } else if (musicType === 'extended') {
                // 扩展音乐使用默认值，因为模型版本可能不同
                creditCost = 12; // 默认扩展音乐积分
              } else {
                // generated 或未知类型使用 simple 模式默认值
                creditCost = getMusicCredits('simple');
              }

              console.log(`[CALLBACK-${callbackId}] Using refund amount based on MusicType ${musicType}: ${creditCost} credits`);
            }

            const refundSuccess = await addUserCredits(
              refundUserId,
              creditCost,
              `Music generation failed - refund (${failureMsg})`,
              taskId,
              'refund'
            );

            if (refundSuccess) {
              console.log(`[CALLBACK-${callbackId}] Successfully refunded ${creditCost} credits`);
            } else {
              console.error(`[CALLBACK-${callbackId}] Failed to refund credits for failed music generation: ${musicGeneration.id}`);
            }
          } catch (refundError) {
            console.error(`[CALLBACK-${callbackId}] Error refunding credits for failed music generation:`, refundError);
            // 不抛出错误，避免影响错误记录的创建
          }
        } else {
          console.error(`[CALLBACK-${callbackId}] No music record found for failed taskId: ${taskId}`);

          if (creditTransactionResult.rows.length > 0) {
            try {
              const creditCost = Math.abs(creditTransactionResult.rows[0].amount);
              const refundUserId = creditTransactionResult.rows[0].user_id;

              const refundSuccess = await addUserCredits(
                refundUserId,
                creditCost,
                `Music generation failed - refund (${failureMsg})`,
                taskId,
                'refund'
              );

              if (refundSuccess) {
                console.log(`[CALLBACK-${callbackId}] Refunded ${creditCost} credits without music record`);
              } else {
                console.error(`[CALLBACK-${callbackId}] Failed to refund credits without music record for taskId: ${taskId}`);
              }
            } catch (refundError) {
              console.error(`[CALLBACK-${callbackId}] Error refunding credits without music record:`, refundError);
            }
          }
        }
      } catch (error) {
        console.error(`[CALLBACK-${callbackId}] Failed to process error callback:`, error);
        return false;
      }
      return true;
    }

    // Log completion of async processing
    const asyncProcessingTime = Date.now() - asyncStartTime;
    console.log(`[CALLBACK-${callbackId}] Async processing completed in ${asyncProcessingTime}ms`);
    return false;
  } catch (error) {
    console.error(`[CALLBACK-${callbackId}] Async callback processing failed:`, error);
    // 尝试获取taskId用于错误通知
    try {
      if (taskId) {
        console.error(`[CALLBACK-${callbackId}] Error processing callback for taskId: ${taskId}`);
      }
    } catch (taskIdError) {
      console.error(`[CALLBACK-${callbackId}] Failed to extract taskId from error context:`, taskIdError);
    }
    return false;
  }
}

// 定期清理缓存，防止内存泄漏
setInterval(() => {
  const now = Date.now();

  processedTasks.forEach((timestamp, key) => {
    if (now - timestamp > CALLBACK_IDEMPOTENCY_TTL_MS) {
      processedTasks.delete(key);
    }
  });

  processingTasks.forEach((timestamp, key) => {
    if (now - timestamp > CALLBACK_IDEMPOTENCY_TTL_MS) {
      processingTasks.delete(key);
    }
  });

  if (processedTasks.size > 5000) {
    processedTasks.clear();
  }
  if (processingTasks.size > 5000) {
    processingTasks.clear();
  }
}, 60 * 60 * 1000); // 每小时清理一次
