import { NextRequest, NextResponse } from 'next/server';

import { updateMusicGenerationByTaskId } from '@/lib/music-db';
import { createGenerationError } from '@/lib/generation-errors-db';
import { addUserCredits } from '@/lib/user-db';
import { downloadFromUrl, uploadAudioFile, uploadCoverImage } from '@/lib/r2-storage';
import { query } from '@/lib/db-query-builder';
import { getMusicCredits, getFeatureCredits, FeatureKey } from '@/lib/credits-config';
import { MusicType } from '@/types/music';

// Cache for processed tasks to handle idempotency
const processedTasks = new Set<string>();

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
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const callbackId = `callback_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  console.log(`[CALLBACK-${callbackId}] Suno callback received`);

  try {
    // 1. Fast response - must return response within 15 seconds
    const callbackData = await request.json();
    const { code, data } = callbackData;
    const taskId = data?.task_id;

    console.log(`[CALLBACK-${callbackId}] Processing callback: ${taskId}, code: ${code}`);

    // 3. Idempotency handling - avoid duplicate processing of same callback
    // 使用 callbackType 来区分不同的回调类型，避免相同 code 的冲突
    const callbackType = data?.callbackType;
    const taskKey = `${taskId}_${callbackType || 'unknown'}_${code}`;

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

    // 检查是否已经处理过成功的回调（只有当所有音频都有URL时才标记为完成）
    if (code === 200 && data?.data) {
      const tracks = data.data;
      const allAudioReady = tracks.every((track: any) =>
        track.audio_url && track.audio_url.trim() !== ''
      );


      if (allAudioReady && processedTasks.has(`${taskId}_completed`)) {
        console.log(`[CALLBACK-${callbackId}] Already completed`);
        return NextResponse.json({
          success: true,
          message: 'Already completed',
          taskId: taskId,
          processedAt: new Date().toISOString()
        });
      }
    }

    // Mark as processed
    processedTasks.add(taskKey);

    // 4. Return success response immediately to avoid blocking (符合官方示例格式)
    const response = NextResponse.json({
      status: 'received'
    });

    // 添加CORS头支持ngrok
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 6. Process complex logic asynchronously to avoid blocking callback response
    setImmediate(() => {
      processCallbackAsync(callbackData, callbackId);
    });

    return response;

  } catch (error) {
    console.error(`[CALLBACK-${callbackId}] Callback processing error:`, error);

    // Return quick response even on error
    const errorResponse = NextResponse.json(
      {
        error: 'Internal server error',
        success: false,
        processedAt: new Date().toISOString()
      },
      { status: 500 }
    );

    // 添加CORS头支持ngrok
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    errorResponse.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return errorResponse;
  }
}

// 添加OPTIONS方法支持CORS预检请求
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

/**
 * 处理音乐生成回调的核心函数
 * 功能：接收KIE AI的回调通知，处理不同类型的回调（text/first/complete），
 * 存储数据到数据库和R2
 */
async function processCallbackAsync(callbackData: any, callbackId: string) {
  const asyncStartTime = Date.now();
  console.log(`[CALLBACK-${callbackId}] Starting async processing`);

  try {
    // 1. 解析回调数据
    const { code, data } = callbackData;
    const taskId = data?.task_id; //音乐生成任务ID

    // 2. 识别回调类型并处理
    let callbackType = data?.callbackType;

    if (code === 200 && data?.data) {
      // 音乐数据直接在 data.data 数组中
      const tracks = data.data;
      console.log(`[CALLBACK-${callbackId}] Processing ${tracks.length} tracks`);

      // 4. 根据不同的回调类型处理
      if (callbackType === 'text') {
        console.log(`[CALLBACK-${callbackId}] TEXT callback`);

        // 4.1 text回调：只存储数据到数据库
        // 使用第一个track的元数据更新数据库（除了audio_url以外的所有值）
        const primaryTrack = tracks[0];

        // 4.1.1 查询music记录获取type和现有title
        const musicGenQuery = await query(
          'SELECT id, type, title FROM music WHERE task_id = $1',
          [taskId]
        );

        if (musicGenQuery.rows.length === 0) {
          console.error(`[CALLBACK-${callbackId}] No music record found for taskId: ${taskId}`);
          return;
        }

        const musicRecord = musicGenQuery.rows[0];
        const musicGenerationId = musicRecord.id;
        const musicType = musicRecord.type as MusicType;
        const existingTitle = musicRecord.title;
        const trimmedExistingTitle = (existingTitle || '').trim();
        const hasUserProvidedTitle = trimmedExistingTitle.length > 0;

        // 4.1.2 更新音乐生成记录的元数据
        const styleFromTags = primaryTrack.tags;

        // 使用接口返回的标题，如果没有则使用默认值
        const extractedTitle = primaryTrack.title || 'Untitled';

        // 构建更新对象，只包含有值的字段
        const updateData: any = {
          status: 'text' // text回调已完成，文本信息已生成
        };

        // 对于 upload 类型或用户自定义标题，保持原始标题；否则采用 text 回调标题
        if (musicType === 'upload_cover' || musicType === 'upload_extend') {
          console.log(`[CALLBACK-${callbackId}] Upload type detected (${musicType}), preserving user title: ${existingTitle}`);
        } else if (!hasUserProvidedTitle) {
          updateData.title = extractedTitle;
        } else {
          console.log(`[CALLBACK-${callbackId}] User provided custom title (${trimmedExistingTitle}), skipping API title`);
        }
        updateData.tags = styleFromTags;

        try {
          // 实际执行数据库更新操作
          await updateMusicGenerationByTaskId(taskId, updateData);
          console.log(`[CALLBACK-${callbackId}] Updated music record with tags${updateData.title ? ' and title' : ''}`);
        } catch (dbError) {
          console.error(`[CALLBACK-${callbackId}] Failed to update music generation record with text data:`, dbError);
        }

        // 4.1.3 存储歌词到lyrics表
        const lyricsContent = primaryTrack.prompt;
        // 对于upload类型，使用existingTitle；对于普通类型，使用extractedTitle
        const titleForLyrics = (musicType === 'upload_cover' || musicType === 'upload_extend' || hasUserProvidedTitle)
          ? (trimmedExistingTitle || existingTitle)
          : extractedTitle;

        if (lyricsContent && lyricsContent.trim() !== '') {
          try {
            await query(
              `INSERT INTO lyrics (music_id, title, content)
               VALUES ($1, $2, $3)`,
              [musicGenerationId, titleForLyrics, lyricsContent]
            );
          } catch (lyricsError) {
            console.error('Failed to create music lyrics record:', lyricsError);
          }
        }

        // 4.1.4 更新已存在的tracks记录
        try {
          // 获取已存在的tracks记录（包括已有title的记录）
          const existingTracksQuery = await query(
            'SELECT id, title FROM tracks WHERE music_id = $1 AND suno_track_id IS NULL ORDER BY id ASC',
            [musicGenerationId]
          );

          if (existingTracksQuery.rows.length > 0) {
            // 依次更新tracks，每个API返回的track对应一个数据库record
            for (let i = 0; i < Math.min(tracks.length, existingTracksQuery.rows.length); i++) {
              const track = tracks[i];
              const existingTrack = existingTracksQuery.rows[i];

              console.log(`[CALLBACK-${callbackId}] Updating track ${i + 1} with suno_track_id ${track.id}`);

              // 决定是否更新track的title
              let trackTitle: string;
              if (musicType === 'upload_cover' || musicType === 'upload_extend' || hasUserProvidedTitle) {
                // 上传或用户自定义标题：保持原始值
                trackTitle = existingTrack.title || trimmedExistingTitle || existingTitle || 'Untitled';
                console.log(`[CALLBACK-${callbackId}] Preserving provided track title: ${trackTitle}`);
              } else {
                // 对于普通generate类型且没有用户标题，使用API返回的title
                trackTitle = track.title || extractedTitle;
              }

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
                  track.stream_audio_url,
                  trackTitle,
                  existingTrack.id
                ]
              );
            }
          } else {
            console.error(`[CALLBACK-${callbackId}] No existing tracks found for music_id: ${musicGenerationId}`);
          }
        } catch (tracksError) {
          console.error('Failed to update tracks records in text callback:', tracksError);
        }

        // 4.1.5 封面生成已在音乐生成API中立即启动，text回调不再需要调用

        return; // 直接返回，不处理其他逻辑
        
      } else if (callbackType === 'first') {
        // 4.2 first回调：将 audio_url 持久化到 R2，并更新数据库对应表字段
        console.log(`[CALLBACK-${callbackId}] FIRST callback`);
        try {

          // 仅处理带有 audio_url 的条目
          const tracksWithAudio = tracks.filter((t: any) => t.audio_url && t.audio_url.trim() !== '');

          if (tracksWithAudio.length === 0) {
            console.log(`[CALLBACK-${callbackId}] No audio tracks`);
            return;
          }
          // 查询 userId
          let finalUserId: string = 'anonymous';
          try {
            const userQuery = await query(
              'SELECT user_id FROM music WHERE task_id = $1',
              [taskId]
            );
            if (userQuery.rows.length > 0) {
              finalUserId = userQuery.rows[0].user_id;
            }
          } catch (dbErr) {
            console.error('Failed to query userId for first callback, fallback to anonymous:', dbErr);
          }

          // 查询已有标题作为后备
          let finalTitle = 'Untitled Song';
          try {
            const originalRecord = await query(
              'SELECT title FROM music WHERE task_id = $1',
              [taskId]
            );
            const originalTitle = originalRecord.rows[0]?.title;
            finalTitle = originalTitle;
          } catch (titleErr) {
            console.error('Failed to resolve title for first callback, using default', titleErr);
          }

          // 获取 music_id
          const musicGenQuery = await query(
            'SELECT id FROM music WHERE task_id = $1',
            [taskId]
          );
          const musicGenerationId = musicGenQuery.rows[0]?.id;
          if (!musicGenerationId) {
            console.error(`No music record found for taskId: ${taskId} (first callback)`);
            return;
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
                console.error(`[CALLBACK-${callbackId}] First callback: no existing track found for suno_track_id ${track.id}, this should not happen`);
              }
            } catch (err) {
              console.error(`Failed to update duration for track ${track.id} in first callback:`, err);
            }
          }
          
          // 更新music状态为first (带重试机制)
          await retryDatabaseOperation(async () => {
            await updateMusicGenerationByTaskId(taskId, {
              status: 'first'
            });
          }, 3, callbackId, 'update status to first');
          
        } catch (err) {
          console.error('First callback processing error:', err);
        }
        return; // 处理完成，返回

      } else if (callbackType === 'complete') {
        // 4.3 complete回调：处理最终音频文件上传到R2
        console.log(`[CALLBACK-${callbackId}] COMPLETE callback`);

        // 检查音频准备状态
        const audioReady = tracks.every((track: any) =>
          track.audio_url && track.audio_url.trim() !== ''
        );

        if (!audioReady) {
          console.log(`[CALLBACK-${callbackId}] Audio not ready`);
          return;
        }
        // 获取用户ID和标题信息
        const musicGenQuery = await query(
          'SELECT id, user_id, title FROM music WHERE task_id = $1',
          [taskId]
        );
        const musicGenerationId = musicGenQuery.rows[0]?.id;
        const finalUserId = musicGenQuery.rows[0]?.user_id || 'anonymous';
        const finalTitle = musicGenQuery.rows[0]?.title;
        
        if (!musicGenerationId) {
          console.error(`No music record found for taskId: ${taskId} - this should not happen`);
          return;
        }
        
        // 获取已存在的tracks记录
        const existingTracksQuery = await query(
          'SELECT id, duration FROM tracks WHERE music_id = $1 ORDER BY id ASC',
          [musicGenerationId]
        );
        const existingTracks = existingTracksQuery.rows;
        
        if (existingTracks.length !== tracks.length) {
          console.error(`Mismatch: ${existingTracks.length} existing tracks vs ${tracks.length} callback tracks`);
          return;
        }
        
        // Complete回调：统一处理所有音频文件上传到R2
        for (let i = 0; i < tracks.length; i++) {
          const track = tracks[i];
          const existingTrack = existingTracks[i];
          
          try {
            // 使用 audio_url
            const audioUrl = track.audio_url;

            if (audioUrl && audioUrl.trim() !== '') {
              // 下载音频文件到R2（统一在complete回调处理）
              const audioBuffer = await downloadFromUrl(audioUrl);
              const filename = `${finalTitle}_${i + 1}.mp3`;
              const audioR2Url = await uploadAudioFile(audioBuffer, taskId, filename, finalUserId || 'anonymous');
              
              console.log(`[CALLBACK-${callbackId}] Complete: Uploaded audio for track ${i + 1} to R2: ${audioR2Url}`);
              
              // 更新数据库（包含audio_url和duration）
              await query(
                `UPDATE tracks SET 
                  audio_url = $1,
                  duration = $2,
                  updated_at = NOW()
                WHERE id = $3`,
                [
                  audioR2Url,
                  track.duration || null,
                  existingTrack.id
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
          await updateMusicGenerationByTaskId(taskId, {
            status: 'complete'
          });
        }, 5, callbackId, 'update status to complete'); // complete 回调使用 5 次重试
        
        // 音乐生成完成后，备份封面图片到R2（兜底机制，cover-callback可能已经处理过）
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
                const filename = `cover_backup_${Date.now()}_${track.id}.png`;
                
                const r2ImageUrl = await uploadCoverImage(
                  imageBuffer, 
                  track.cover_task_id, 
                  filename, 
                  track.user_id || 'anonymous'
                );
                
                // 更新tracks记录，将临时URL替换为R2备份URL
                await query(
                  'UPDATE tracks SET cover_image_url = $1 WHERE id = $2',
                  [r2ImageUrl, track.id]
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
        
        return;
      } else {
        console.log(`[CALLBACK-${callbackId}] Unknown callback type: ${callbackType}`);
      }
      
    } else if (code !== 200) {
      // 5. 处理失败的回调
      console.log(`[CALLBACK-${callbackId}] FAILED callback: ${code}`);

      try {
        // 获取音乐生成记录信息
        const musicGenQuery = await query(
          'SELECT id, user_id, prompt FROM music WHERE task_id = $1',
          [taskId]
        );

        if (musicGenQuery.rows.length > 0) {
          const musicGeneration = musicGenQuery.rows[0];
          const { msg } = callbackData;


          // 更新音乐生成状态为错误
          await updateMusicGenerationByTaskId(taskId, {
            status: 'error',
            title: musicGeneration.prompt || 'Unknown' // 使用用户输入的prompt作为标题
          });

          // 创建错误记录
          await createGenerationError(
            'music_generation',
            musicGeneration.id,
            msg || `Music generation failed with code ${code}`,
            `API_ERROR_${code}`
          );

          // 退还积分 - 因为用户没有得到任何音乐结果
          try {
            // 从 credit_transactions 表中查找该 taskId 的积分消耗记录
            const creditTransactionResult = await query(
              `SELECT amount FROM credit_transactions
               WHERE reference_id = $1
               ORDER BY created_at DESC LIMIT 1`,
              [taskId]
            );

            // 优先从数据库获取已扣除的积分（最准确）
            let creditCost = getMusicCredits('basic'); // 默认 Basic Mode 的积分消耗

            if (creditTransactionResult.rows.length > 0) {
              // 消费记录是负数，退款应该是正数
              creditCost = Math.abs(creditTransactionResult.rows[0].amount);
            } else {
              // 如果没有找到交易记录，根据 MusicType 确定退款金额
              console.warn(`No credit transaction found for taskId ${taskId}, determining refund by MusicType`);

              // 查询 MusicType
              const musicTypeQuery = await query(
                'SELECT type FROM music WHERE task_id = $1',
                [taskId]
              );

              const musicType = musicTypeQuery.rows[0]?.type as MusicType | undefined;

              if (musicType === 'upload_cover') {
                creditCost = getFeatureCredits('upload_cover_music' as FeatureKey);
              } else if (musicType === 'upload_extend') {
                creditCost = getFeatureCredits('upload_extend_music' as FeatureKey);
              } else if (musicType === 'extended') {
                // 扩展音乐使用默认值，因为模型版本可能不同
                creditCost = 12; // 默认扩展音乐积分
              } else {
                // generated 或未知类型使用 basic 模式默认值
                creditCost = getMusicCredits('basic');
              }

              console.log(`[CALLBACK-${callbackId}] Using refund amount based on MusicType ${musicType}: ${creditCost} credits`);
            }

            const refundSuccess = await addUserCredits(
              musicGeneration.user_id,
              creditCost,
              `Music generation failed - refund (${msg || 'API error'})`,
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
        }
      } catch (error) {
        console.error(`[CALLBACK-${callbackId}] Failed to process error callback:`, error);
      }
    }

    // Log completion of async processing
    const asyncProcessingTime = Date.now() - asyncStartTime;
    console.log(`[CALLBACK-${callbackId}] Async processing completed in ${asyncProcessingTime}ms`);
  } catch (error) {
    console.error(`[CALLBACK-${callbackId}] Async callback processing failed:`, error);
    // 尝试获取taskId用于错误通知
    try {
      const { data } = callbackData;
      const taskId = data?.task_id;
      if (taskId) {
        console.error(`[CALLBACK-${callbackId}] Error processing callback for taskId: ${taskId}`);
      }
    } catch (taskIdError) {
      console.error(`[CALLBACK-${callbackId}] Failed to extract taskId from error context:`, taskIdError);
    }
  }
}

// 定期清理缓存，防止内存泄漏
setInterval(() => {
  if (processedTasks.size > 1000) {
    processedTasks.clear();
  }
}, 60 * 60 * 1000); // 每小时清理一次
