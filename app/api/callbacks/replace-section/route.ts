/**
 * 替换音乐分区回调 API
 * POST /api/callbacks/replace-section
 * 处理 KIE API 的回调通知
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-query-builder';
import { downloadFromUrl, uploadAudioFile, uploadCoverImage } from '@/lib/r2-storage';
import { addUserCredits } from '@/lib/user-db';
import { createGenerationError } from '@/lib/generation-errors-db';
import { getFeatureCredits } from '@/lib/credits-config';
import { resolveLyricsTitle } from '@/lib/lyrics-title';

// Cache for processed tasks to handle idempotency
const processedTasks = new Set<string>();

export async function POST(request: NextRequest) {
  const callbackId = `rs_callback_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  console.log(`[RS-CALLBACK-${callbackId}] Replace section callback received`);

  try {
    const callbackData = await request.json();
    const { code, data } = callbackData;
    const taskId = data?.task_id;

    console.log(`[RS-CALLBACK-${callbackId}] Processing callback: taskId=${taskId}, code=${code}, type=${data?.callbackType}`);

    if (!taskId) {
      return NextResponse.json({ error: 'task_id is required' }, { status: 400 });
    }

    // Idempotency check
    const taskKey = `${taskId}_${data?.callbackType || 'unknown'}_${code}`;
    if (processedTasks.has(taskKey)) {
      console.log(`[RS-CALLBACK-${callbackId}] Already processed`);
      return NextResponse.json({
        status: 'received',
        message: 'Already processed'
      });
    }

    processedTasks.add(taskKey);

    // Return response immediately
    const response = NextResponse.json({ status: 'received' });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Process callback asynchronously
    setImmediate(() => {
      processCallbackAsync(callbackData, callbackId);
    });

    return response;

  } catch (error) {
    console.error(`[RS-CALLBACK-${callbackId}] Error:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
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

async function processCallbackAsync(callbackData: any, callbackId: string) {
  try {
    const { code, msg, data } = callbackData;
    const taskId = data?.task_id;
    const callbackType = data?.callbackType;

    // Get music and user info
    const musicQuery = await query(
      'SELECT id, user_id, title FROM music WHERE task_id = $1',
      [taskId]
    );

    if (musicQuery.rows.length === 0) {
      console.error(`[RS-CALLBACK-${callbackId}] No music record found for taskId: ${taskId}`);
      return;
    }

    const musicRecord = musicQuery.rows[0];
    const musicId = musicRecord.id;
    const userId = musicRecord.user_id;

    if (code === 200 && callbackType === 'complete') {
      // Success callback
      console.log(`[RS-CALLBACK-${callbackId}] COMPLETE callback - processing`);

      const tracks = data.data;
      console.log(`[RS-CALLBACK-${callbackId}] Received tracks from KIE API:`, JSON.stringify(tracks, null, 2));

      if (!tracks || tracks.length === 0) {
        console.error(`[RS-CALLBACK-${callbackId}] No tracks in callback data`);
        await handleError(musicId, userId, 'No tracks in callback', callbackId);
        return;
      }

      // Get existing track record
      const existingTracksQuery = await query(
        'SELECT id FROM tracks WHERE music_id = $1 ORDER BY id ASC',
        [musicId]
      );

      if (existingTracksQuery.rows.length === 0) {
        console.error(`[RS-CALLBACK-${callbackId}] No existing tracks found for music_id: ${musicId}`);
        return;
      }

      // Process each track
      for (let i = 0; i < Math.min(tracks.length, existingTracksQuery.rows.length); i++) {
        const track = tracks[i];
        const existingTrack = existingTracksQuery.rows[i];

        try {
          // 先保存 KIE 返回的临时 URL，确保前端可以立即使用
          // 使用 KIE API 返回的 image_url 作为封面（与 extend-music 保持一致）
          const coverImageUrl = track.image_url || '';

          // Update track record - 不更新 title，保持用户输入的 title
          await query(
            `UPDATE tracks SET
              suno_track_id = $1,
              audio_url = $2,
              stream_audio_url = $3,
              duration = $4,
              cover_image_url = $5,
              updated_at = NOW()
            WHERE id = $6`,
            [
              track.id, // suno_track_id
              track.audio_url || track.stream_audio_url || '', // 临时 audio URL
              track.stream_audio_url || '',
              track.duration || null,
              coverImageUrl, // 使用 KIE 返回的 image_url
              existingTrack.id
            ]
          );

          console.log(`[RS-CALLBACK-${callbackId}] Updated track ${existingTrack.id}, cover: ${coverImageUrl}`);

        } catch (trackError) {
          console.error(`[RS-CALLBACK-${callbackId}] Error processing track:`, trackError);
        }
      }

      // 存储 prompt 到 lyrics 表
      const firstTrack = tracks[0];
      if (firstTrack && firstTrack.prompt) {
        try {
          const lyricsTitle = resolveLyricsTitle(musicRecord.title, firstTrack.prompt);

          // 检查是否已存在 lyrics 记录
          const existingLyricsQuery = await query(
            'SELECT id FROM lyrics WHERE music_id = $1',
            [musicId]
          );

          if (existingLyricsQuery.rows.length > 0) {
            // 更新现有的歌词记录，content 使用 KIE 返回的 prompt
            await query(
              `UPDATE lyrics SET title = $1, content = $2 WHERE music_id = $3`,
              [lyricsTitle, firstTrack.prompt, musicId]
            );
            console.log(`[RS-CALLBACK-${callbackId}] Lyrics updated for replace section: ${musicId}, title: ${lyricsTitle}`);
          } else {
            // 创建新的歌词记录，content 使用 KIE 返回的 prompt
            await query(
              `INSERT INTO lyrics (music_id, title, content)
               VALUES ($1::uuid, $2, $3)`,
              [musicId, lyricsTitle, firstTrack.prompt]
            );
            console.log(`[RS-CALLBACK-${callbackId}] Lyrics created for replace section: ${musicId}, title: ${lyricsTitle}`);
          }
        } catch (error) {
          console.error(`[RS-CALLBACK-${callbackId}] Failed to create/update lyrics:`, error);
          // 继续处理
        }
      } else {
        console.log(`[RS-CALLBACK-${callbackId}] No prompt found in track data`);
      }

      // Update music status to complete and tags (if available from KIE API)
      // 不更新 title，保持用户输入的 title
      if (firstTrack && firstTrack.tags) {
        await query(
          `UPDATE music SET status = 'complete', tags = $1, updated_at = NOW() WHERE task_id = $2`,
          [firstTrack.tags, taskId]
        );
        console.log(`[RS-CALLBACK-${callbackId}] Updated music with tags: ${firstTrack.tags}`);
      } else {
        await query(
          `UPDATE music SET status = 'complete', updated_at = NOW() WHERE task_id = $1`,
          [taskId]
        );
      }

      console.log(`[RS-CALLBACK-${callbackId}] Replace section completed successfully`);

      // 异步处理音频和封面上传到 R2（不阻塞回调响应）
      setImmediate(async () => {
        try {
          // 查询已更新的 tracks（用于更新 R2 URL）
          const existingTracksQuery = await query(
            'SELECT id, title, audio_url, cover_image_url FROM tracks WHERE music_id = $1 ORDER BY id ASC',
            [musicId]
          );
          const existingTracks = existingTracksQuery.rows;
          console.log(`[RS-CALLBACK-${callbackId}] Found ${existingTracks.length} existing tracks for R2 upload`);

          // 处理音频上传到 R2
          for (let i = 0; i < tracks.length && i < existingTracks.length; i++) {
            const track = tracks[i];
            const existingTrack = existingTracks[i];
            const audioUrl = track.audio_url || track.stream_audio_url;

            if (audioUrl && audioUrl.trim() !== '' && !audioUrl.includes('makernb-assets.nasirann.com')) {
              try {
                console.log(`[RS-CALLBACK-${callbackId}] Uploading audio for track ${i + 1}/${tracks.length} to R2`);
                const audioBuffer = await downloadFromUrl(audioUrl);
                const filename = `${track.id}.mp3`;
                const audioR2Url = await uploadAudioFile(audioBuffer, taskId, filename, userId);

                // 更新数据库中的 audio_url
                await query(
                  `UPDATE tracks SET
                    audio_url = $1,
                    updated_at = NOW()
                  WHERE id = $2`,
                  [audioR2Url, existingTrack.id]
                );

                console.log(`[RS-CALLBACK-${callbackId}] ✅ Uploaded audio for track ${i + 1} to R2: ${audioR2Url}`);
              } catch (audioError) {
                console.error(`[RS-CALLBACK-${callbackId}] ❌ Failed to upload audio for track ${i + 1}:`, audioError);
                // 音频上传失败不影响主流程，前端仍可使用临时URL
              }
            } else {
              console.log(`[RS-CALLBACK-${callbackId}] Skipping R2 upload for track ${i + 1} (already on R2 or no URL)`);
            }
          }

          // 备份封面图片到 R2
          try {
            console.log(`[RS-CALLBACK-${callbackId}] Checking for cover images to backup`);
            const coverImagesQuery = await query(
              `SELECT id, cover_image_url
               FROM tracks
               WHERE music_id = $1
               AND cover_image_url LIKE 'http%'
               AND cover_image_url NOT LIKE '%makernb-assets.nasirann.com%'`,
              [musicId]
            );

            if (coverImagesQuery.rows.length > 0) {
              console.log(`[RS-CALLBACK-${callbackId}] Found ${coverImagesQuery.rows.length} cover images to backup`);
              for (const track of coverImagesQuery.rows) {
                try {
                  console.log(`[RS-CALLBACK-${callbackId}] Backing up cover image for track ${track.id}`);
                  const imageBuffer = await downloadFromUrl(track.cover_image_url);
                  const filename = `${track.id}_cover.jpeg`;

                  const r2ImageUrl = await uploadCoverImage(
                    imageBuffer,
                    taskId,
                    filename,
                    userId
                  );

                  // 更新tracks记录，将临时URL替换为R2备份URL
                  await query(
                    'UPDATE tracks SET cover_image_url = $1 WHERE id = $2',
                    [r2ImageUrl, track.id]
                  );

                  console.log(`[RS-CALLBACK-${callbackId}] ✅ Backed up cover image for track ${track.id} to R2: ${r2ImageUrl}`);
                } catch (imageError) {
                  console.error(`[RS-CALLBACK-${callbackId}] ❌ Failed to backup cover image for track ${track.id}:`, imageError);
                  // 备份失败不影响主流程，前端仍可使用临时URL
                }
              }
            } else {
              console.log(`[RS-CALLBACK-${callbackId}] No cover images need backup (all on R2 or no URLs)`);
            }
          } catch (backupError) {
            console.error(`[RS-CALLBACK-${callbackId}] Error during cover image backup:`, backupError);
            // 备份失败不影响主流程，前端仍可使用临时URL
          }

          console.log(`[RS-CALLBACK-${callbackId}] Async R2 upload process completed`);
        } catch (r2Error) {
          console.error(`[RS-CALLBACK-${callbackId}] Error during async R2 upload:`, r2Error);
          // R2 上传失败不影响已保存的临时 URL，用户仍可使用
        }
      });

    } else {
      // Error callback
      console.error(`[RS-CALLBACK-${callbackId}] Error callback: code=${code}, msg=${msg}`);
      await handleError(musicId, userId, msg || 'Replace section failed', callbackId, code);
    }

  } catch (error) {
    console.error(`[RS-CALLBACK-${callbackId}] Async processing error:`, error);
  }
}

async function handleError(
  musicId: string,
  userId: string,
  errorMsg: string,
  callbackId: string,
  errorCode?: number
) {
  try {
    // Update music status to error
    await query(
      `UPDATE music SET status = 'error', updated_at = NOW() WHERE id = $1`,
      [musicId]
    );

    // Create error record
    await createGenerationError(
      'music_generation',
      userId,
      musicId,
      errorMsg,
      errorCode ? `API_ERROR_${errorCode}` : 'GENERATION_FAILED'
    );

    // Refund credits
    const refundCredits = getFeatureCredits('replace_section');
    await addUserCredits(
      userId,
      refundCredits,
      `Refund: ${errorMsg}`,
      musicId,
      'refund_replace_section'
    );

    console.log(`[RS-CALLBACK-${callbackId}] Error handled, credits refunded: ${refundCredits}`);

  } catch (error) {
    console.error(`[RS-CALLBACK-${callbackId}] Error handling failed:`, error);
  }
}

// Periodic cleanup of processed tasks cache
setInterval(() => {
  if (processedTasks.size > 1000) {
    processedTasks.clear();
  }
}, 60 * 60 * 1000); // Clean every hour
