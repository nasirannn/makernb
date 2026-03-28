import { NextRequest, NextResponse } from 'next/server';

import { query } from '@/lib/db-query-builder';
import { createGenerationError, getGenerationErrorByReferenceId } from '@/lib/generation-errors-db';
import { updateSoundGenerationMetadataByTaskId } from '@/lib/sound-generation-db';
import { getFeatureCredits } from '@/lib/credits-config';
import { addUserCredits } from '@/lib/user-db';
import { downloadFromUrl, isManagedAssetUrl, uploadAudioFile } from '@/lib/r2-storage';

export const dynamic = 'force-dynamic';

const GENERATED_SOUND_MUSIC_TYPE = 'generated_sound';
const SOUND_REFUND_TRANSACTION_TYPE = 'refund_generate_sound';
const SOUND_PENDING_STATES = new Set([
  'waiting',
  'pending',
  'processing',
  'queued',
  'queuing',
  'submitted',
  'running',
  'executing',
  'text_success',
  'first_success',
]);
const SOUND_SUCCESS_STATES = new Set(['success', 'completed', 'complete', 'succeeded']);
const SOUND_FAILURE_STATES = new Set([
  'fail',
  'failed',
  'error',
  'cancelled',
  'canceled',
  'create_task_failed',
  'generate_audio_failed',
  'callback_exception',
  'sensitive_word_error',
]);

type GenerationRow = {
  id: string;
  user_id: string;
  status: string | null;
  title: string | null;
  genre: string | null;
  tags: string | null;
  generation_mode: string | null;
  type: string | null;
  model: string | null;
};


function sanitizeAudioBaseName(value: string | null | undefined, fallback = 'generated-sound'): string {
  const normalized = (value || '').trim();
  const safe = normalized || fallback;
  return safe
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || fallback;
}

function parseJsonSafely(value: unknown): any {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function extractSoundUrls(resultJson: unknown): string[] {
  const parsed = parseJsonSafely(resultJson);

  if (Array.isArray(parsed)) {
    const directUrls = parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    if (directUrls.length > 0) {
      return directUrls;
    }

    const mappedUrls = parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const record = item as Record<string, unknown>;
        const audioUrl =
          (typeof record.audioUrl === 'string' && record.audioUrl.trim()) ||
          (typeof record.audio_url === 'string' && record.audio_url.trim()) ||
          (typeof record.streamAudioUrl === 'string' && record.streamAudioUrl.trim()) ||
          (typeof record.stream_audio_url === 'string' && record.stream_audio_url.trim()) ||
          null;
        return audioUrl;
      })
      .filter((item): item is string => Boolean(item));

    if (mappedUrls.length > 0) {
      return mappedUrls;
    }
  }

  if (typeof parsed === 'string' && parsed.trim()) {
    return [parsed.trim()];
  }

  if (!parsed || typeof parsed !== 'object') {
    return [];
  }

  const record = parsed as Record<string, unknown>;
  const directCandidates = [record.resultUrls, record.result_urls, record.urls, record.audioUrls, record.audio_urls];
  for (const candidate of directCandidates) {
    if (Array.isArray(candidate)) {
      const urls = candidate.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
      if (urls.length > 0) return urls;
    }
  }

  const singleCandidates = [record.resultUrl, record.result_url, record.audioUrl, record.audio_url, record.url];
  for (const candidate of singleCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return [candidate.trim()];
    }
  }

  return [];
}

type SoundTrackRecord = {
  audioId: string | null;
  audioUrl: string | null;
  streamAudioUrl: string | null;
  imageUrl: string | null;
  title: string | null;
  tags: string | null;
  modelName: string | null;
  duration: number | null;
};

function toNullableNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractSoundTrackRecords(rawTracks: unknown): SoundTrackRecord[] {
  const parsed = parseJsonSafely(rawTracks);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.map((item) => {
    if (!item || typeof item !== 'object') {
      return {
        audioId: null,
        audioUrl: null,
        streamAudioUrl: null,
        imageUrl: null,
        title: null,
        tags: null,
        modelName: null,
        duration: null,
      } satisfies SoundTrackRecord;
    }

    const record = item as Record<string, unknown>;
    return {
      audioId:
        (typeof record.id === 'string' && record.id.trim()) ||
        (typeof record.audioId === 'string' && record.audioId.trim()) ||
        null,
      audioUrl:
        (typeof record.audioUrl === 'string' && record.audioUrl.trim()) ||
        (typeof record.audio_url === 'string' && record.audio_url.trim()) ||
        null,
      streamAudioUrl:
        (typeof record.streamAudioUrl === 'string' && record.streamAudioUrl.trim()) ||
        (typeof record.stream_audio_url === 'string' && record.stream_audio_url.trim()) ||
        null,
      imageUrl:
        (typeof record.imageUrl === 'string' && record.imageUrl.trim()) ||
        (typeof record.image_url === 'string' && record.image_url.trim()) ||
        null,
      title: (typeof record.title === 'string' && record.title.trim()) || null,
      tags: (typeof record.tags === 'string' && record.tags.trim()) || null,
      modelName:
        (typeof record.modelName === 'string' && record.modelName.trim()) ||
        (typeof record.model_name === 'string' && record.model_name.trim()) ||
        null,
      duration: toNullableNumber(record.duration),
    } satisfies SoundTrackRecord;
  });
}

async function ensureSoundTrackRows(musicId: string, expectedCount: number) {
  const existingResult = await query(
    `SELECT id
     FROM tracks
     WHERE music_id = $1
       AND (is_deleted IS NULL OR is_deleted = FALSE)
     ORDER BY created_at ASC, id ASC`,
    [musicId]
  );

  const missingCount = Math.max(0, expectedCount - existingResult.rows.length);
  if (missingCount > 0) {
    await query(
      `INSERT INTO tracks (music_id, is_published, cover_image_url, suno_track_id)
       SELECT $1, FALSE, NULL, NULL FROM generate_series(1, $2)`,
      [musicId, missingCount]
    );
  }

  const finalResult = await query(
    `SELECT id
     FROM tracks
     WHERE music_id = $1
       AND (is_deleted IS NULL OR is_deleted = FALSE)
     ORDER BY created_at ASC, id ASC`,
    [musicId]
  );

  return finalResult.rows.map((row: any) => row.id as string);
}

async function refundSoundCreditsIfNeeded(taskId: string, userId: string) {
  const existingRefund = await query(
    `SELECT id
     FROM credit_transactions
     WHERE reference_id = $1
       AND transaction_type = $2
     LIMIT 1`,
    [taskId, SOUND_REFUND_TRANSACTION_TYPE]
  );

  if (existingRefund.rows.length > 0) {
    return;
  }

  await addUserCredits(
    userId,
    getFeatureCredits('generate_sound'),
    'Refund sound generation credits',
    taskId,
    SOUND_REFUND_TRANSACTION_TYPE
  );
}

async function maybeSyncGeneratedSoundTask(taskId: string, generation: GenerationRow) {
  if (generation.type !== GENERATED_SOUND_MUSIC_TYPE) {
    return;
  }

  if (generation.status === 'complete' || generation.status === 'error') {
    return;
  }

  const kieBaseUrl = process.env.KIE_API_BASE_URL;
  const apiKey = process.env.KIE_API_KEY;
  if (!kieBaseUrl || !apiKey) {
    return;
  }

  const response = await fetch(
    `${kieBaseUrl}/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    console.warn(`[music-status] Sound recordInfo request failed for task ${taskId}: ${response.status}`);
    return;
  }

  const payload = await response.json().catch(() => null);
  const rootCode = typeof payload?.code === 'number' ? payload.code : Number(payload?.code);
  if (Number.isFinite(rootCode) && rootCode !== 200) {
    console.warn(`[music-status] Sound recordInfo returned code=${rootCode} for task ${taskId}`);
    return;
  }

  const data = payload?.data ?? {};
  const responseNode = data?.response ?? {};
  const rawState = typeof data?.status === 'string'
    ? data.status
    : typeof responseNode?.status === 'string'
      ? responseNode.status
      : typeof payload?.status === 'string'
        ? payload.status
        : '';
  const normalizedState = rawState.trim().toLowerCase();

  if (!normalizedState || SOUND_PENDING_STATES.has(normalizedState)) {
    await updateSoundGenerationMetadataByTaskId(taskId, {
      providerRecordInfoJson: payload,
      lastSyncedAt: new Date().toISOString(),
    }).catch((error) => {
      console.error('[music-status] Failed to update sound metadata for pending state:', error);
    });
    return;
  }

  if (SOUND_FAILURE_STATES.has(normalizedState)) {
    const failMsg = typeof data?.errorMessage === 'string' && data.errorMessage.trim()
      ? data.errorMessage.trim()
      : typeof data?.error_message === 'string' && data.error_message.trim()
        ? data.error_message.trim()
        : typeof payload?.msg === 'string' && payload.msg.trim()
          ? payload.msg.trim()
          : 'Sound generation failed';
    const failCode = typeof data?.errorCode === 'number' && Number.isFinite(data.errorCode)
      ? `SOUND_${Math.trunc(data.errorCode)}`
      : typeof data?.errorCode === 'string' && data.errorCode.trim()
        ? `SOUND_${data.errorCode.trim().toUpperCase()}`
      : typeof data?.error_code === 'string' && data.error_code.trim()
        ? `SOUND_${data.error_code.trim().toUpperCase()}`
        : 'SOUND_GENERATION_FAILED';

    await query(
      `UPDATE music
       SET status = 'error', updated_at = NOW()
       WHERE id = $1
         AND status <> 'complete'`,
      [generation.id]
    );

    const existingError = await query(
      `SELECT id
       FROM generation_errors
       WHERE error_type = 'music_generation'
         AND reference_id = $1
         AND error_code = $2
       LIMIT 1`,
      [generation.id, failCode]
    );

    if (existingError.rows.length === 0) {
      await createGenerationError('music_generation', generation.user_id, generation.id, failMsg, failCode).catch((error) => {
        console.error('[music-status] Failed to create sound generation error:', error);
      });
    }

    await updateSoundGenerationMetadataByTaskId(taskId, {
      providerRecordInfoJson: payload,
      errorCode: typeof data?.errorCode === 'number' && Number.isFinite(data.errorCode) ? data.errorCode : null,
      errorMessage: failMsg,
      lastSyncedAt: new Date().toISOString(),
    }).catch((error) => {
      console.error('[music-status] Failed to update sound metadata for failure state:', error);
    });

    await refundSoundCreditsIfNeeded(taskId, generation.user_id).catch((error) => {
      console.error('[music-status] Failed to refund sound generation credits:', error);
    });
    return;
  }

  if (!SOUND_SUCCESS_STATES.has(normalizedState)) {
    return;
  }

  const rawTrackPayload =
    responseNode?.sunoData ??
    responseNode?.data ??
    data?.resultJson ??
    data?.result_json ??
    payload?.resultJson;

  const urls = extractSoundUrls(rawTrackPayload);
  const trackRecords = extractSoundTrackRecords(rawTrackPayload);
  if (urls.length === 0) {
    return;
  }

  const trackIds = await ensureSoundTrackRows(generation.id, urls.length);
  const uploadedAudioUrls = await Promise.all(
    trackIds.slice(0, urls.length).map(async (trackId, index) => {
      const trackRecord = trackRecords[index];
      const sourceAudioUrl = trackRecord?.audioUrl || urls[index];
      let persistedAudioUrl = sourceAudioUrl;

      if (sourceAudioUrl && !isManagedAssetUrl(sourceAudioUrl)) {
        const audioBuffer = await downloadFromUrl(sourceAudioUrl);
        const filename = `${sanitizeAudioBaseName(trackRecord?.title || generation.title || generation.tags || generation.genre)}_${index + 1}.mp3`;
        persistedAudioUrl = await uploadAudioFile(audioBuffer, taskId, filename, generation.user_id || 'anonymous');
      }

      await query(
        `UPDATE tracks
         SET suno_track_id = COALESCE(NULLIF($2, ''), suno_track_id),
             audio_url = $3,
             stream_audio_url = COALESCE(NULLIF($4, ''), $3, stream_audio_url),
             duration = COALESCE($5, duration),
             title = COALESCE(NULLIF($6, ''), title),
             cover_image_url = COALESCE(NULLIF($7, ''), cover_image_url),
             updated_at = NOW()
         WHERE id = $1`,
        [
          trackId,
          trackRecord?.audioId || '',
          persistedAudioUrl,
          trackRecord?.streamAudioUrl || '',
          trackRecord?.duration,
          trackRecord?.title || '',
          trackRecord?.imageUrl || '',
        ]
      );

      return {
        audioId: trackRecord?.audioId || null,
        audioUrl: persistedAudioUrl,
      };
    })
  );

  const primaryTrack = trackRecords.find((item) => item.tags || item.modelName || item.title) || null;
  if (primaryTrack) {
    await query(
      `UPDATE music
       SET title = COALESCE(NULLIF($2, ''), title),
           tags = COALESCE(NULLIF($3, ''), tags),
           updated_at = NOW()
       WHERE id = $1`,
      [
        generation.id,
        primaryTrack.title || '',
        primaryTrack.tags || '',
      ]
    );
  }

  await updateSoundGenerationMetadataByTaskId(taskId, {
    providerRecordInfoJson: payload,
    resultAudioIdsJson: uploadedAudioUrls.map((item) => item.audioId).filter(Boolean),
    r2AudioUrlsJson: uploadedAudioUrls.map((item) => item.audioUrl),
    resultTrackCount: uploadedAudioUrls.length,
    errorCode: null,
    errorMessage: null,
    lastSyncedAt: new Date().toISOString(),
  }).catch((error) => {
    console.error('[music-status] Failed to update sound metadata after success sync:', error);
  });

  await query(
    `UPDATE music
     SET status = 'complete', updated_at = NOW()
     WHERE id = $1`,
    [generation.id]
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId parameter is required' },
        { status: 400 }
      );
    }

    const genResult = await query(
      `SELECT id, user_id, status, title, COALESCE(NULLIF(tags, ''), '') as genre, tags, generation_mode, type, model
       FROM music
       WHERE task_id = $1`,
      [taskId]
    );

    if (genResult.rows.length === 0) {
      console.error(`No music generation record found for task_id: ${taskId}`);
      return NextResponse.json({
        code: 404,
        msg: `No music generation record found for task_id: ${taskId}`,
        data: { taskId, status: 'not_found', tracks: [] }
      });
    }

    let generation = genResult.rows[0] as GenerationRow;
    await maybeSyncGeneratedSoundTask(taskId, generation);

    const refreshedGenResult = await query(
      `SELECT id, user_id, status, title, COALESCE(NULLIF(tags, ''), '') as genre, tags, generation_mode, type, model
       FROM music
       WHERE task_id = $1`,
      [taskId]
    );
    generation = refreshedGenResult.rows[0] as GenerationRow;

    const tracksResult = await query(
      `SELECT 
        mt.id as track_id,
        mt.suno_track_id,
        mt.audio_url,
        mt.stream_audio_url,
        mt.duration,
        mt.cover_image_url,
        mt.created_at,
        COALESCE(mt.title, mg.title) as title,
        COALESCE(NULLIF(mg.tags, ''), '') as genre,
        mg.tags as tags,
        mg.prompt as prompt,
        mg.generation_mode as generation_mode,
        mg.type as music_type,
        mg.model as model,
        (
          SELECT ml.content FROM lyrics ml
          WHERE ml.music_id = mg.id
          ORDER BY ml.created_at ASC
          LIMIT 1
        ) as lyrics_content
      FROM tracks mt
      INNER JOIN music mg ON mt.music_id = mg.id
      WHERE mg.task_id = $1
        AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
      ORDER BY mt.created_at ASC, mt.id ASC`,
      [taskId]
    );
    
    const tracks = tracksResult.rows.map((row: any) => ({
      id: row.track_id,
      suno_track_id: row.suno_track_id || null,
      createdAt: row.created_at,
      title: row.title || '',
      tags: row.tags || '',
      genre: row.genre || null,
      prompt: row.prompt || '',
      generationMode: row.generation_mode || null,
      lyrics: row.lyrics_content || '',
      audioUrl: row.audio_url || row.stream_audio_url || '',
      streamAudioUrl: row.stream_audio_url || '',
      duration: row.duration || null,
      musicType: row.music_type || generation.type || 'generated',
      model: row.model || generation.model || null,
      coverImage: row.cover_image_url || null,
    }));

    let status: 'generating' | 'text' | 'first' | 'complete' | 'error' = 'generating';
    if (generation.status === 'text') {
      status = 'text';
    } else if (generation.status === 'first') {
      status = 'first';
    } else if (generation.status === 'complete') {
      status = 'complete';
    } else if (generation.status === 'error') {
      status = 'error';
    }

    let errorInfo = null;
    if (status === 'error') {
      try {
        errorInfo = await getGenerationErrorByReferenceId('music_generation', generation.id);
      } catch (error) {
        console.error('Failed to get error info for generation:', generation.id, error);
      }
    }

    return NextResponse.json({
      code: 200,
      msg: 'Success',
      data: {
        taskId,
        generationId: generation.id,
        status,
        tracks,
        errorInfo: errorInfo ? {
          errorMessage: errorInfo.error_message,
          errorCode: errorInfo.error_code
        } : null
      }
    });
  } catch (error) {
    console.error('Get music status error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get music status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
