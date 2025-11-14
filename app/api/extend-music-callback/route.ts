/**
 * 扩展音乐回调 API
 * POST /api/extend-music-callback
 * 
 * KIE API 在扩展完成后会调用此接口
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getMusicIdByTaskId, 
  updateExtendMusicTaskStatus, 
  createExtendedTrack 
} from '@/lib/extend-music-db';
import { KIEExtendMusicCallbackResponse } from '@/types/extend-music';
import { query } from '@/lib/db-query-builder';
import { downloadFromUrl, uploadAudioFile, uploadCoverImage } from '@/lib/r2-storage';

// 强制动态渲染
export const dynamic = 'force-dynamic';

/**
 * POST /api/extend-music-callback
 * 处理 KIE API 的扩展完成回调
 */
export async function POST(request: NextRequest) {
  const callbackId = `callback_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  console.log(`[EXTEND-CALLBACK-${callbackId}] Callback received`);
  
  try {
    // 1. 快速响应，避免阻塞 KIE API
    const callbackData: KIEExtendMusicCallbackResponse = await request.json();
    console.log(`[EXTEND-CALLBACK-${callbackId}] Raw callback data:`, JSON.stringify(callbackData, null, 2));

    // 2. 解析回调数据 - 支持 KIE API 标准格式
    // KIE API 回调格式: { code, msg, data: { callbackType, task_id, data: [...] } }
    // 参考文档: https://docs.kie.ai/cn/suno-api/extend-music-callbacks
    // 注意：回调返回的是 task_id (有下划线)，与请求 API 返回的 taskId (驼峰) 不同
    const { code, msg, data } = callbackData;
    
    // 回调返回的是 task_id (有下划线)，优先使用 task_id
    const task_id = data?.task_id || (data as any)?.taskId;
    
    // 获取 callbackType（必需字段）
    const callbackType = data?.callbackType || 'complete';
    
    // 判断状态：code === 200 表示成功，否则失败
    const status = code === 200 ? 'success' : 'failed';
    
    // 获取 tracks 数据 - 使用 data.data（文档标准格式）
    const tracks = data?.data || [];
    
    // 获取错误信息
    const error_message = msg && code !== 200 ? msg : data?.error_message;

    console.log(`[EXTEND-CALLBACK-${callbackId}] Callback data parsed:`, {
      code,
      callbackType,
      task_id,
      status,
      tracks_count: tracks?.length || 0,
      error_message,
    });

    // 快速返回响应，避免阻塞
    const response = NextResponse.json({ 
      success: true, 
      status: 'received' 
    });
    
    // 添加 CORS 头支持
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 异步处理复杂逻辑
    setImmediate(() => {
      processCallbackAsync({ 
        task_id, 
        callbackType, 
        status, 
        tracks, 
        error_message,
        msg,
        code
      }, callbackId);
    });

    return response;
  } catch (error) {
    console.error(`[EXTEND-CALLBACK-${callbackId}] Callback processing error:`, error);
    
    const errorResponse = NextResponse.json(
      { 
        error: 'Internal server error',
        success: false 
      },
      { status: 500 }
    );
    
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    errorResponse.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return errorResponse;
  }
}

/**
 * 异步处理回调逻辑
 */
async function processCallbackAsync(
  callback: { 
    task_id: string | undefined; 
    callbackType: string;
    status: string; 
    tracks: any[]; 
    error_message?: string;
    msg?: string;
    code?: number;
  },
  callbackId: string
) {
  const { task_id, callbackType, status, tracks, error_message, msg, code } = callback;

  try {
    // 验证 task_id
    if (!task_id) {
      console.error(`[EXTEND-CALLBACK-${callbackId}] Missing task_id in callback data`);
      return;
    }

    // 3. 查询对应的 music 记录
    console.log(`[EXTEND-CALLBACK-${callbackId}] Querying music record for taskId: ${task_id}`);
    const musicId = await getMusicIdByTaskId(task_id);
    if (!musicId) {
      console.error(`[EXTEND-CALLBACK-${callbackId}] Music record not found for task_id: ${task_id}`);
      return;
    }

    console.log(`[EXTEND-CALLBACK-${callbackId}] Music record found: musicId=${musicId}`);

    // 4. 处理不同回调类型
    console.log(`[EXTEND-CALLBACK-${callbackId}] Processing callback type: ${callbackType}`);
    
    // 4.1 处理文本生成完成回调（callbackType: "text"）
    if (callbackType === 'text') {
      console.log(`[EXTEND-CALLBACK-${callbackId}] Text generation completed, waiting for music extension...`);
      // 文本生成完成，但音乐还未生成，此时 tracks 为空数组
      // 不需要更新状态，继续等待后续回调
      return;
    }
    
    // 4.2 处理失败情况（callbackType: "error" 或 code !== 200）
    if (status === 'failed' || callbackType === 'error') {
      console.error(`[EXTEND-CALLBACK-${callbackId}] Extend music task failed:`, {
        task_id,
        musicId,
        callbackType,
        error_message,
        code,
      });

      // 更新任务状态为失败
      console.log(`[EXTEND-CALLBACK-${callbackId}] Updating task status to 'error'`);
      await updateExtendMusicTaskStatus(task_id, 'error');

      // 记录错误信息
      console.log(`[EXTEND-CALLBACK-${callbackId}] Recording error in database`);
      await query(
        `INSERT INTO generation_errors (
          reference_id,
          error_type,
          error_message,
          error_code,
          created_at
        ) VALUES ($1, 'extend_music', $2, $3, NOW())`,
        [musicId, error_message || msg || 'Unknown error', `EXTEND_FAILED_${code || 'UNKNOWN'}`]
      );

      console.log(`[EXTEND-CALLBACK-${callbackId}] Task marked as failed successfully`);
      return;
    }

    // 5. 处理成功情况（callbackType: "first" 或 "complete"）
    // 注意：first 回调时可能只有第一首，complete 回调时包含所有音乐
    if (status === 'success' && (callbackType === 'first' || callbackType === 'complete') && tracks && tracks.length > 0) {
      console.log(`[EXTEND-CALLBACK-${callbackId}] Extend music task progress:`, {
        task_id,
        musicId,
        callbackType,
        tracks_count: tracks.length,
        is_complete: callbackType === 'complete',
      });

      // 查询 userId 和 title（用于 R2 上传）
      let userId: string = 'anonymous';
      let musicTitle: string = 'Extended Track';
      try {
        console.log(`[EXTEND-CALLBACK-${callbackId}] Querying music info for R2 upload`);
        const musicQuery = await query(
          'SELECT user_id, title FROM music WHERE id = $1',
          [musicId]
        );
        if (musicQuery.rows.length > 0) {
          userId = musicQuery.rows[0].user_id || 'anonymous';
          musicTitle = musicQuery.rows[0].title || 'Extended Track';
          console.log(`[EXTEND-CALLBACK-${callbackId}] Music info retrieved:`, { userId, musicTitle });
        }
      } catch (queryError) {
        console.error(`[EXTEND-CALLBACK-${callbackId}] Failed to query music info:`, queryError);
      }

      // 获取原始 track ID（从 music 记录中获取，但实际应该从创建时传入的参数获取）
      // 注意：由于 original_track_id 已从 music 表移除，我们需要从扩展任务创建时的参数获取
      // 这里我们通过查询原始 music 的 tracks 来获取第一个 track 作为原始 track
      let originalTrackId: string | undefined;
      try {
        console.log(`[EXTEND-CALLBACK-${callbackId}] Querying original track ID`);
        const originalMusicQuery = await query(
          `SELECT m.original_music_id 
           FROM music m 
           WHERE m.id = $1::uuid`,
          [musicId]
        );
        if (originalMusicQuery.rows.length > 0 && originalMusicQuery.rows[0].original_music_id) {
          const originalMusicId = originalMusicQuery.rows[0].original_music_id;
          const originalTrackQuery = await query(
            `SELECT id FROM tracks 
             WHERE music_id = $1::uuid 
             AND (is_deleted IS NULL OR is_deleted = FALSE)
             ORDER BY created_at ASC, id ASC 
             LIMIT 1`,
            [originalMusicId]
          );
          if (originalTrackQuery.rows.length > 0) {
            originalTrackId = originalTrackQuery.rows[0].id;
            console.log(`[EXTEND-CALLBACK-${callbackId}] Original track ID found: ${originalTrackId}`);
          }
        }
      } catch (error) {
        console.error(`[EXTEND-CALLBACK-${callbackId}] Failed to get original track ID:`, error);
        // 继续处理，originalTrackId 将为 undefined
      }

      // 更新或创建扩展的 track 记录（先保存临时 URL，确保前端可以立即使用）
      // 策略：优先更新占位 track，如果占位 track 不够则创建新 track
      console.log(`[EXTEND-CALLBACK-${callbackId}] Processing ${tracks.length} extended track records`);
      
      // 先查询所有占位 tracks（suno_track_id 为 NULL，按创建时间排序）
      const placeholderTracksQuery = await query(
        `SELECT id FROM tracks 
         WHERE music_id = $1::uuid 
         AND suno_track_id IS NULL 
         AND (is_deleted IS NULL OR is_deleted = FALSE)
         ORDER BY created_at ASC, id ASC`,
        [musicId]
      );
      const placeholderTrackIds = placeholderTracksQuery.rows.map((row: any) => row.id);
      console.log(`[EXTEND-CALLBACK-${callbackId}] Found ${placeholderTrackIds.length} placeholder tracks`);
      
      const createdTrackIds: string[] = [];
      
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        try {
          console.log(`[EXTEND-CALLBACK-${callbackId}] Processing track ${i + 1}/${tracks.length}:`, {
            suno_track_id: track.id,
            title: track.title,
          });
          
          let trackId: string;
          
          // 策略1：如果有占位 track 且当前索引在占位范围内，更新占位 track
          if (i < placeholderTrackIds.length) {
            trackId = placeholderTrackIds[i];
            console.log(`[EXTEND-CALLBACK-${callbackId}] Updating placeholder track ${i + 1}: ${trackId}`);
          } else {
            // 策略2：检查 track 是否已存在（基于 suno_track_id，可能是之前回调创建的）
            const existingTrackQuery = await query(
              'SELECT id FROM tracks WHERE music_id = $1::uuid AND suno_track_id = $2 AND (is_deleted IS NULL OR is_deleted = FALSE)',
              [musicId, track.id]
            );
            
            if (existingTrackQuery.rows.length > 0) {
              trackId = existingTrackQuery.rows[0].id;
              console.log(`[EXTEND-CALLBACK-${callbackId}] Track already exists (by suno_track_id), updating: ${trackId}`);
            } else {
              // 策略3：创建新 track（回调返回的 tracks 数量超过占位数量）
              trackId = null as any; // 将在后面创建
              console.log(`[EXTEND-CALLBACK-${callbackId}] Creating new track (beyond placeholder count)`);
            }
          }
          
          if (trackId) {
            // 更新现有 track（占位 track 或已存在的 track）
            // ✅ 直接使用延长音乐接口返回的 image_url 作为封面图
            // 注意：延长音乐回调返回的图片字段是 image_url（不是 cover_image_url）
            const coverImageUrl = track.image_url || '';
            
            await query(
              `UPDATE tracks SET
                suno_track_id = $1,
                title = COALESCE($2, title),
                audio_url = COALESCE($3, audio_url),
                stream_audio_url = COALESCE($4, stream_audio_url),
                duration = COALESCE($5, duration),
                cover_image_url = COALESCE(NULLIF($6, ''), cover_image_url),
                updated_at = NOW()
              WHERE id = $7::uuid`,
              [
                track.id, // 设置 suno_track_id
                track.title,
                track.audio_url || track.stream_audio_url || '',
                track.stream_audio_url || '',
                track.duration,
                coverImageUrl, // 使用延长音乐接口返回的 image_url
                trackId,
              ]
            );
            
            if (coverImageUrl) {
              console.log(`[EXTEND-CALLBACK-${callbackId}] Updated cover image from extend music callback: ${coverImageUrl}`);
            } else {
              console.log(`[EXTEND-CALLBACK-${callbackId}] No cover image in extend music callback, keeping existing cover`);
            }
            
            console.log(`[EXTEND-CALLBACK-${callbackId}] Track updated successfully: ${trackId}`);
          } else {
            // Track 不存在，创建新记录（回调返回的 tracks 数量超过占位数量）
            console.log(`[EXTEND-CALLBACK-${callbackId}] Creating new track record (beyond placeholder count)`);
            
            // ✅ 直接使用延长音乐接口返回的 image_url 作为封面图
            // 注意：延长音乐回调返回的图片字段是 image_url（不是 cover_image_url）
            const coverImageUrl = track.image_url || '';
            
            if (coverImageUrl) {
              console.log(`[EXTEND-CALLBACK-${callbackId}] Using cover image from extend music callback: ${coverImageUrl}`);
            } else {
              console.log(`[EXTEND-CALLBACK-${callbackId}] No cover image in extend music callback for new track`);
            }
            
            trackId = await createExtendedTrack({
              musicId,
              sunoTrackId: track.id,
              title: track.title,
              audioUrl: track.audio_url || track.stream_audio_url || '',
              streamAudioUrl: track.stream_audio_url || '',
              duration: track.duration,
              coverImageUrl: coverImageUrl, // 使用延长音乐接口返回的 image_url
              originalTrackId,
            });

            console.log(`[EXTEND-CALLBACK-${callbackId}] Extended track created successfully:`, {
              music_id: musicId,
              track_id: trackId,
              suno_track_id: track.id,
              title: track.title,
            });
          }
          
          if (trackId) {
            createdTrackIds.push(trackId);
          }
        } catch (error) {
          console.error(`[EXTEND-CALLBACK-${callbackId}] Failed to process extended track ${i + 1}:`, error);
          // 继续处理其他 tracks
        }
      }

      console.log(`[EXTEND-CALLBACK-${callbackId}] Created ${createdTrackIds.length}/${tracks.length} track records`);

      // 如果有歌词，创建歌词记录
      const firstTrack = tracks[0];
      const lyricsContent = firstTrack.lyrics || firstTrack.prompt;
      if (lyricsContent && lyricsContent.trim() !== '') {
        try {
          console.log(`[EXTEND-CALLBACK-${callbackId}] Creating lyrics record`);
          
          // 先检查是否已存在歌词记录
          const existingLyricsQuery = await query(
            'SELECT id FROM lyrics WHERE music_id = $1::uuid',
            [musicId]
          );
          
          if (existingLyricsQuery.rows.length > 0) {
            // 更新已存在的歌词记录
            await query(
              `UPDATE lyrics SET title = $1, content = $2 WHERE music_id = $3::uuid`,
              [firstTrack.title || musicTitle, lyricsContent, musicId]
            );
            console.log(`[EXTEND-CALLBACK-${callbackId}] Lyrics updated for extended music: ${musicId}`);
          } else {
            // 创建新的歌词记录
            await query(
              `INSERT INTO lyrics (music_id, title, content)
               VALUES ($1::uuid, $2, $3)`,
              [musicId, firstTrack.title || musicTitle, lyricsContent]
            );
            console.log(`[EXTEND-CALLBACK-${callbackId}] Lyrics created for extended music: ${musicId}`);
          }
        } catch (error) {
          console.error(`[EXTEND-CALLBACK-${callbackId}] Failed to create lyrics:`, error);
          // 继续处理
        }
      } else {
        console.log(`[EXTEND-CALLBACK-${callbackId}] No lyrics found in track data`);
      }

      // 更新任务状态：只有 complete 回调时才标记为完成
      if (callbackType === 'complete') {
        console.log(`[EXTEND-CALLBACK-${callbackId}] All music extended, updating task status to 'complete'`);
        await updateExtendMusicTaskStatus(task_id, 'complete');
        console.log(`[EXTEND-CALLBACK-${callbackId}] Task status updated to 'complete' successfully`);
      } else if (callbackType === 'first') {
        console.log(`[EXTEND-CALLBACK-${callbackId}] First track extended, waiting for remaining tracks...`);
        // first 回调时，任务仍在进行中，不更新状态为 completed
      }

      // 异步处理音频和封面上传到 R2（不阻塞回调响应）
      console.log(`[EXTEND-CALLBACK-${callbackId}] Starting async R2 upload process`);
      setImmediate(async () => {
        try {
          // 查询已创建的 tracks（用于更新 R2 URL）
          const existingTracksQuery = await query(
            'SELECT id, title, audio_url, cover_image_url FROM tracks WHERE music_id = $1 ORDER BY id ASC',
            [musicId]
          );
          const existingTracks = existingTracksQuery.rows;
          console.log(`[EXTEND-CALLBACK-${callbackId}] Found ${existingTracks.length} existing tracks for R2 upload`);

          // 处理音频上传到 R2
          for (let i = 0; i < tracks.length && i < existingTracks.length; i++) {
            const track = tracks[i];
            const existingTrack = existingTracks[i];
            const audioUrl = track.audio_url || track.stream_audio_url;

            if (audioUrl && audioUrl.trim() !== '' && !audioUrl.includes('makernb-assets.nasirann.com')) {
              try {
                console.log(`[EXTEND-CALLBACK-${callbackId}] Uploading audio for track ${i + 1}/${tracks.length} to R2`);
                const audioBuffer = await downloadFromUrl(audioUrl);
                const filename = `${musicTitle.replace(/[^a-zA-Z0-9]/g, '_')}_extended_${i + 1}.mp3`;
                const audioR2Url = await uploadAudioFile(audioBuffer, task_id, filename, userId);

                // 更新数据库中的 audio_url
                await query(
                  `UPDATE tracks SET 
                    audio_url = $1,
                    updated_at = NOW()
                  WHERE id = $2`,
                  [audioR2Url, existingTrack.id]
                );

                console.log(`[EXTEND-CALLBACK-${callbackId}] ✅ Uploaded audio for track ${i + 1} to R2: ${audioR2Url}`);
              } catch (audioError) {
                console.error(`[EXTEND-CALLBACK-${callbackId}] ❌ Failed to upload audio for track ${i + 1}:`, audioError);
                // 音频上传失败不影响主流程，前端仍可使用临时URL
              }
            } else {
              console.log(`[EXTEND-CALLBACK-${callbackId}] Skipping R2 upload for track ${i + 1} (already on R2 or no URL)`);
            }
          }

          // 备份封面图片到 R2
          // 注意：延长音乐直接使用回调返回的 image_url 作为封面，不再调用 generate-cover API
          // 这里需要将延长音乐返回的临时封面 URL 上传到 R2 并更新数据库
          try {
            console.log(`[EXTEND-CALLBACK-${callbackId}] Checking for cover images to backup`);
            const coverImagesQuery = await query(
              `SELECT mt.id, mt.cover_image_url, cg.task_id as cover_task_id, cg.user_id
               FROM tracks mt
               JOIN music mg ON mt.music_id = mg.id
               LEFT JOIN cover_generations cg ON mg.task_id = cg.music_task_id
               WHERE mg.id = $1
               AND mt.cover_image_url LIKE 'http%' 
               AND mt.cover_image_url NOT LIKE '%makernb-assets.nasirann.com%'`,
              [musicId]
            );

            if (coverImagesQuery.rows.length > 0) {
              console.log(`[EXTEND-CALLBACK-${callbackId}] Found ${coverImagesQuery.rows.length} cover images to backup`);
              for (const track of coverImagesQuery.rows) {
                try {
                  console.log(`[EXTEND-CALLBACK-${callbackId}] Backing up cover image for track ${track.id}`);
                  const imageBuffer = await downloadFromUrl(track.cover_image_url);
                  const filename = `cover_backup_${Date.now()}_${track.id}.png`;
                  const coverTaskId = track.cover_task_id || task_id;

                  const r2ImageUrl = await uploadCoverImage(
                    imageBuffer,
                    coverTaskId,
                    filename,
                    track.user_id || userId
                  );

                  // 更新tracks记录，将临时URL替换为R2备份URL
                  await query(
                    'UPDATE tracks SET cover_image_url = $1 WHERE id = $2',
                    [r2ImageUrl, track.id]
                  );

                  console.log(`[EXTEND-CALLBACK-${callbackId}] ✅ Backed up cover image for track ${track.id} to R2: ${r2ImageUrl}`);
                } catch (imageError) {
                  console.error(`[EXTEND-CALLBACK-${callbackId}] ❌ Failed to backup cover image for track ${track.id}:`, imageError);
                  // 备份失败不影响主流程，前端仍可使用临时URL
                }
              }
            } else {
              console.log(`[EXTEND-CALLBACK-${callbackId}] No cover images need backup (all on R2 or no URLs)`);
            }
          } catch (backupError) {
            console.error(`[EXTEND-CALLBACK-${callbackId}] Error during cover image backup:`, backupError);
            // 备份失败不影响主流程，前端仍可使用临时URL
          }

          console.log(`[EXTEND-CALLBACK-${callbackId}] Async R2 upload process completed`);
        } catch (r2Error) {
          console.error(`[EXTEND-CALLBACK-${callbackId}] Error during async R2 upload:`, r2Error);
          // R2 上传失败不影响已保存的临时 URL，用户仍可使用
        }
      });

      console.log(`[EXTEND-CALLBACK-${callbackId}] Callback processing completed successfully`);
      return;
    }

    // 6. 处理异常情况
    console.error(`[EXTEND-CALLBACK-${callbackId}] Invalid callback data:`, { task_id, status, tracks_count: tracks?.length || 0 });
  } catch (error) {
    console.error(`[EXTEND-CALLBACK-${callbackId}] Extend music callback error:`, error);
  }
}

// 添加 OPTIONS 方法支持 CORS 预检请求
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

