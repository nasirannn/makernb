import { NextRequest, NextResponse } from 'next/server';

import { updateMusicGenerationByTaskId } from '@/lib/music-db';
import { createGenerationError } from '@/lib/generation-errors-db';
import { addUserCredits } from '@/lib/user-db';
import { downloadFromUrl, uploadAudioFile, uploadCoverImage } from '@/lib/r2-storage';
import { query } from '@/lib/db-query-builder';
import { getMusicCredits, getFeatureCredits, FeatureKey } from '@/lib/credits-config';
import { MusicType } from '@/types/music';
import { submitExplorePageToIndexNow } from '@/lib/indexnow';

// Cache for processed tasks to handle idempotency
const processedTasks = new Set<string>();
const processingTasks = new Set<string>();

export interface NormalizedKieCallback {
  code: number;
  msg?: string;
  taskId?: string;
  callbackType?: string;
  tracks: any[];
  errorMessage?: string;
  raw: any;
}

export function normalizeKieCallback(
  callbackData: any,
  options?: { defaultCallbackType?: string }
): NormalizedKieCallback {
  const code = Number(callbackData?.code);
  const msg = callbackData?.msg;
  const data = callbackData?.data || {};
  const taskId = data?.task_id || data?.taskId;
  const callbackTypeRaw = data?.callbackType ?? data?.status ?? options?.defaultCallbackType;
  const callbackType = typeof callbackTypeRaw === 'string'
    ? callbackTypeRaw.trim().toLowerCase()
    : undefined;
  const tracks = Array.isArray(data?.data)
    ? data.data
    : (Array.isArray(data?.tracks) ? data.tracks : []);
  const errorMessage = (code !== 200 ? (msg || data?.error_message) : data?.error_message) || undefined;

  return {
    code,
    msg,
    taskId,
    callbackType,
    tracks,
    errorMessage,
    raw: callbackData,
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
    const callbackData = await request.json();
    try {
      console.log(`[CALLBACK-${callbackId}] Raw callback payload:`, JSON.stringify(callbackData));
    } catch (logError) {
      console.warn(`[CALLBACK-${callbackId}] Failed to stringify callback payload:`, logError);
    }
    const normalized = normalizeKieCallback(callbackData, {
      defaultCallbackType: options.defaultCallbackType,
    });

    const { code, taskId, callbackType, tracks } = normalized;
    const idempotencyEnabled = options.enableIdempotency !== false;
    const taskKey = taskId ? `${taskId}_${callbackType || 'unknown'}_${code}_${sourceLabel}` : undefined;
    const completedKey = taskId ? `${taskId}_completed` : undefined;

    console.log(`[CALLBACK-${callbackId}] Processing callback: ${taskId}, code: ${code}`);

    if (idempotencyEnabled && taskKey) {
      if (processedTasks.has(taskKey)) {
        console.log(`[CALLBACK-${callbackId}] Already processed`);
        return NextResponse.json({
          success: true,
          message: 'Already processed',
          taskId: taskId,
          callbackType: callbackType,
          processedAt: new Date().toISOString()
        });
      }

      if (processingTasks.has(taskKey)) {
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

        if (allAudioReady && completedKey && processedTasks.has(completedKey)) {
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
      try {
        if (idempotencyEnabled && taskKey) {
          processingTasks.add(taskKey);
        }

        const processedSuccessfully = await options.onProcess(normalized, callbackId);

        if (idempotencyEnabled && taskKey) {
          if (processedSuccessfully) {
            processedTasks.add(taskKey);
            console.log(`[CALLBACK-${callbackId}] Marked callback as processed: ${taskKey}`);
          } else {
            console.warn(`[CALLBACK-${callbackId}] Callback not marked as processed (failed/incomplete): ${taskKey}`);
          }
        }
      } catch (processError) {
        console.error(`[CALLBACK-${callbackId}] Async callback processor threw error:`, processError);
      } finally {
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
  title: string,
  content: string,
  callbackId: string
) => {
  const normalized = (content || '').trim();
  if (!normalized) return;
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
        [title, normalized, musicId]
      );
    } else {
      await query(
        'INSERT INTO lyrics (music_id, title, content) VALUES ($1, $2, $3)',
        [musicId, title, normalized]
      );
    }
  } catch (lyricsError) {
    console.error(`[CALLBACK-${callbackId}] Failed to upsert lyrics:`, lyricsError);
  }
};

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
    console.log(`[CALLBACK-${callbackId}] Raw callback data:`, raw);
    console.log(`[CALLBACK-${callbackId}] code=${code}, taskId=${taskId}, status=${raw?.data?.status}, msg=${msg || raw?.msg}`);

    if (!taskId) {
      console.error(`[CALLBACK-${callbackId}] Missing taskId in callback payload`);
      return false;
    }
    const taskIdValue = taskId;

    // 2. 识别回调类型并处理
    let callbackType = rawCallbackType;

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
          'SELECT id, type, title, prompt FROM music WHERE task_id = $1',
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
        const updateData: any = {
          status: 'text' // text回调已完成，文本信息已生成
        };

        // 对于 upload 类型或用户自定义标题，保持原始标题；否则采用 text 回调标题
        if (isUploadDerivedMusicType(musicType)) {
          console.log(`[CALLBACK-${callbackId}] Upload type detected (${musicType}), preserving user title: ${existingTitle}`);
        } else if (!hasUserProvidedTitle) {
          updateData.title = extractedTitle;
        } else {
          console.log(`[CALLBACK-${callbackId}] User provided custom title (${trimmedExistingTitle}), skipping API title`);
        }
        if (typeof styleFromTags === 'string' && styleFromTags.trim()) {
          updateData.tags = styleFromTags;
        }

        try {
          // 实际执行数据库更新操作
          await updateMusicGenerationByTaskId(taskId as string, updateData);
          console.log(`[CALLBACK-${callbackId}] Updated music record with tags${updateData.title ? ' and title' : ''}`);
        } catch (dbError) {
          console.error(`[CALLBACK-${callbackId}] Failed to update music generation record with text data:`, dbError);
          return false;
        }

        // 4.1.3 存储歌词到lyrics表
        const shouldUsePromptFallback = !(isUploadDerivedMusicType(musicType));
        const primaryPrompt = typeof primaryTrack.prompt === 'string' ? primaryTrack.prompt : '';
        const lyricsContent = primaryPrompt || (shouldUsePromptFallback ? promptFallback : '') || '';
        // 对于upload类型，使用existingTitle；对于普通类型，使用extractedTitle
        const titleForLyrics = clampTitle(
          (isUploadDerivedMusicType(musicType) || hasUserProvidedTitle)
            ? (trimmedExistingTitle || existingTitle)
            : extractedTitle
        );

        if (lyricsContent.trim().length > 0) {
          await upsertLyrics(musicGenerationId, titleForLyrics, lyricsContent, callbackId);
        }

        // 4.1.4 更新已存在的tracks记录
        try {
          // 获取已存在的tracks记录（包括已有title的记录）
          const existingTracksQuery = await query(
            'SELECT id, title FROM tracks WHERE music_id = $1 AND suno_track_id IS NULL ORDER BY id ASC',
            [musicGenerationId]
          );

          const existingTracks = existingTracksQuery.rows;

          // 依次更新现有占位 tracks，每个 API track 对应一个数据库 record
          for (let i = 0; i < Math.min(tracks.length, existingTracks.length); i++) {
            const track = tracks[i];
            const existingTrack = existingTracks[i];
            if (!track?.id) continue;

            console.log(`[CALLBACK-${callbackId}] Updating track ${i + 1} with suno_track_id ${track.id}`);

            // 决定是否更新track的title
            let trackTitle: string;
            if (isUploadDerivedMusicType(musicType) || hasUserProvidedTitle) {
              // 上传或用户自定义标题：保持原始值
              trackTitle = existingTrack.title || trimmedExistingTitle || existingTitle || 'Untitled';
              console.log(`[CALLBACK-${callbackId}] Preserving provided track title: ${trackTitle}`);
            } else {
              // 对于普通generate类型且没有用户标题，使用API返回的title
              trackTitle = track.title || extractedTitle;
            }
            trackTitle = clampTitle(trackTitle, 'Untitled');

            // text回调：将stream_audio_url和title存储到tracks表
            await query(
              `UPDATE tracks SET
                suno_track_id = $1,
                stream_audio_url = $2,
                title = $3,
                updated_at = NOW()
              WHERE id = $4`,
              [
                track.id,
                track.stream_audio_url || null,
                trackTitle,
                existingTrack.id
              ]
            );
          }

          // 如果没有占位track，或回调曲目数多于占位数，补建缺失tracks，避免后续complete卡在mismatch
          if (tracks.length > existingTracks.length) {
            for (let i = existingTracks.length; i < tracks.length; i++) {
              const track = tracks[i];
              if (!track?.id) continue;

              let trackTitle: string;
              if (isUploadDerivedMusicType(musicType) || hasUserProvidedTitle) {
                trackTitle = trimmedExistingTitle || existingTitle || 'Untitled';
              } else {
                trackTitle = track.title || extractedTitle;
              }
              trackTitle = clampTitle(trackTitle, 'Untitled');

              await query(
                `INSERT INTO tracks (
                  music_id, suno_track_id, stream_audio_url, title, duration, is_published, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
                [
                  musicGenerationId,
                  track.id,
                  track.stream_audio_url || null,
                  trackTitle,
                  track.duration || null,
                  false,
                ]
              );
              console.log(`[CALLBACK-${callbackId}] Created missing track for text callback: ${track.id}`);
            }
          } else if (existingTracks.length === 0 && tracks.length === 0) {
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

          // 仅处理带有 audio_url 的条目
          const tracksWithAudio = tracks.filter((t: any) => t.audio_url && t.audio_url.trim() !== '');

          if (tracksWithAudio.length === 0) {
            console.log(`[CALLBACK-${callbackId}] No audio tracks`);
            return false;
          }
          // 查询 music 记录
          let finalUserId: string = 'anonymous';
          let finalTitle = 'Untitled Song';
          let promptFallback = '';
          let musicType: MusicType | null = null;
          const musicGenQuery = await query(
            'SELECT id, user_id, title, prompt, type FROM music WHERE task_id = $1',
            [taskId]
          );
          const musicGenerationId = musicGenQuery.rows[0]?.id;
          if (musicGenQuery.rows.length > 0) {
            finalUserId = musicGenQuery.rows[0].user_id || finalUserId;
            finalTitle = musicGenQuery.rows[0].title || finalTitle;
            promptFallback = musicGenQuery.rows[0].prompt || '';
            musicType = musicGenQuery.rows[0].type as MusicType;
          }
          if (!musicGenerationId) {
            console.error(`No music record found for taskId: ${taskId} (first callback)`);
            return false;
          }

          // First回调：只更新duration，不处理audio_url
          for (let i = 0; i < tracksWithAudio.length; i++) {
            const track = tracksWithAudio[i];

            try {
              // 查找对应的 track 记录（使用 suno_track_id 匹配）
              const existingTrackQuery = await query(
                'SELECT id FROM tracks WHERE music_id = $1 AND suno_track_id = $2',
                [musicGenerationId, track.id]
              );

              if (existingTrackQuery.rows.length > 0) {
                const existingTrackId = existingTrackQuery.rows[0].id;
                // 只更新duration，不处理audio_url（统一在complete回调处理）
                await query(
                  `UPDATE tracks SET
                    duration = $1,
                    updated_at = NOW()
                  WHERE id = $2`,
                  [
                    track.duration || null,
                    existingTrackId
                  ]
                );
                console.log(`[CALLBACK-${callbackId}] First: Updated duration for track ${i + 1}: ${track.duration}`);
              } else {
                const trackTitle = clampTitle(track.title || finalTitle, 'Untitled');
                const createdTrack = await query(
                  `INSERT INTO tracks (
                    music_id, suno_track_id, stream_audio_url, title, duration, is_published, created_at, updated_at
                  ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                  RETURNING id`,
                  [
                    musicGenerationId,
                    track.id,
                    track.stream_audio_url || null,
                    trackTitle,
                    track.duration || null,
                    false,
                  ]
                );
                console.log(
                  `[CALLBACK-${callbackId}] First callback created missing track ${createdTrack.rows[0]?.id} for suno_track_id ${track.id}`
                );
              }
            } catch (err) {
              console.error(`Failed to update duration for track ${track.id} in first callback:`, err);
            }
          }
          
          // 更新music状态为first (带重试机制)
          await retryDatabaseOperation(async () => {
            await updateMusicGenerationByTaskId(taskIdValue, {
              status: 'first'
            });
          }, 3, callbackId, 'update status to first');

          if (!(isUploadDerivedMusicType(musicType))) {
            await upsertLyrics(
              musicGenerationId,
              clampTitle(finalTitle, 'Untitled'),
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

        // 检查音频准备状态
        const audioReady = tracks.every((track: any) =>
          track.audio_url && track.audio_url.trim() !== ''
        );

        if (!audioReady) {
          console.log(`[CALLBACK-${callbackId}] Audio not ready`);
          return false;
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
        
        // 获取已存在的tracks记录，并基于suno_track_id进行对齐
        const existingTracksQuery = await query(
          `SELECT id, suno_track_id
           FROM tracks
           WHERE music_id = $1
             AND (is_deleted IS NULL OR is_deleted = FALSE)
           ORDER BY created_at ASC, id ASC`,
          [musicGenerationId]
        );
        const existingTracks = existingTracksQuery.rows as Array<{ id: string; suno_track_id: string | null }>;
        const tracksBySunoId = new Map<string, string>();
        const unboundTrackIds: string[] = [];

        existingTracks.forEach((row) => {
          if (row.suno_track_id && row.suno_track_id.trim()) {
            tracksBySunoId.set(row.suno_track_id, row.id);
          } else {
            unboundTrackIds.push(row.id);
          }
        });

        const resolvedTrackIds: string[] = [];
        for (let i = 0; i < tracks.length; i++) {
          const track = tracks[i];
          if (!track?.id) {
            resolvedTrackIds.push('');
            continue;
          }

          let resolvedTrackId = tracksBySunoId.get(track.id);
          if (!resolvedTrackId && unboundTrackIds.length > 0) {
            resolvedTrackId = unboundTrackIds.shift() as string;
            const trackTitle = clampTitle(track.title || finalTitle, 'Untitled');
            await query(
              `UPDATE tracks SET
                suno_track_id = $1,
                stream_audio_url = COALESCE(NULLIF($2, ''), stream_audio_url),
                title = COALESCE(NULLIF($3, ''), title),
                updated_at = NOW()
               WHERE id = $4`,
              [
                track.id,
                track.stream_audio_url || '',
                trackTitle,
                resolvedTrackId,
              ]
            );
            tracksBySunoId.set(track.id, resolvedTrackId);
          }

          if (!resolvedTrackId) {
            const trackTitle = clampTitle(track.title || finalTitle, 'Untitled');
            const createdTrack = await query(
              `INSERT INTO tracks (
                music_id, suno_track_id, stream_audio_url, title, duration, is_published, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
              RETURNING id`,
              [
                musicGenerationId,
                track.id,
                track.stream_audio_url || null,
                trackTitle,
                track.duration || null,
                false,
              ]
            );
            resolvedTrackId = createdTrack.rows[0]?.id;
            if (resolvedTrackId) {
              tracksBySunoId.set(track.id, resolvedTrackId);
            }
            console.log(`[CALLBACK-${callbackId}] Complete: created missing track for suno_track_id ${track.id}`);
          }

          resolvedTrackIds.push(resolvedTrackId || '');
        }

        // Complete回调：统一处理所有音频文件上传到R2
        for (let i = 0; i < tracks.length; i++) {
          const track = tracks[i];
          const resolvedTrackId = resolvedTrackIds[i];
          if (!resolvedTrackId) {
            console.warn(`[CALLBACK-${callbackId}] Complete: no resolved track id at index ${i}`);
            continue;
          }
          
          try {
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
                  track.duration || null,
                  track.stream_audio_url || '',
                  clampTitle(track.title || finalTitle, 'Untitled'),
                  resolvedTrackId
                ]
              );
            } else {
              console.warn(`[CALLBACK-${callbackId}] Complete: No audio URL for track ${i + 1}`);
            }
          } catch (error) {
            console.error(`[CALLBACK-${callbackId}] Failed to process track ${i + 1}:`, error);
            // 音频处理失败，不更新数据库
          }
        }
        
        // 更新music状态为complete (带重试机制)
        await retryDatabaseOperation(async () => {
          await updateMusicGenerationByTaskId(taskIdValue, {
            status: 'complete'
          });
        }, 5, callbackId, 'update status to complete'); // complete 回调使用 5 次重试
        processedTasks.add(`${taskIdValue}_completed`);

        await upsertLyrics(
          musicGenerationId,
          clampTitle(finalTitle, 'Untitled'),
          promptFallback,
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
             AND mt.cover_image_url LIKE 'http%' 
             AND mt.cover_image_url NOT LIKE '%makernb-assets.nasirann.com%'`,
            [taskId]
          );
          
          if (coverImagesQuery.rows.length > 0) {
            
            for (const track of coverImagesQuery.rows) {
              try {

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
          'SELECT id, user_id, prompt, type FROM music WHERE task_id = $1',
          [taskId]
        );

        if (musicGenQuery.rows.length > 0) {
          const musicGeneration = musicGenQuery.rows[0];
          const musicType = musicGeneration.type as MusicType | undefined;

          // 更新音乐生成状态为错误
          try {
            await updateMusicGenerationByTaskId(taskId, {
              status: 'error',
              title: clampTitle(musicGeneration.prompt, 'Unknown') // 使用用户输入的prompt作为标题
            });
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
  if (processedTasks.size > 1000) {
    processedTasks.clear();
  }
  if (processingTasks.size > 1000) {
    processingTasks.clear();
  }
}, 60 * 60 * 1000); // 每小时清理一次
