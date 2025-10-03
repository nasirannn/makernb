import { NextRequest, NextResponse } from 'next/server';

import { updateMusicGenerationByTaskId } from '@/lib/music-db';
import { createGenerationError } from '@/lib/generation-errors-db';
import { addUserCredits } from '@/lib/user-db';
import { downloadFromUrl, uploadAudioFile } from '@/lib/r2-storage';
import { query } from '@/lib/db-query-builder';

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
  const callbackId = `callback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  console.log(`[CALLBACK-${callbackId}] Suno callback received at ${new Date().toISOString()}`);

  try {
    // 1. Fast response - must return response within 15 seconds
    const callbackData = await request.json();
    console.log(`[CALLBACK-${callbackId}] Callback data parsed:`, {
      code: callbackData.code,
      msg: callbackData.msg,
      taskId: callbackData.data?.task_id,
      callbackType: callbackData.data?.callbackType,
      hasData: !!callbackData.data?.data,
      dataLength: callbackData.data?.data?.length || 0
    });


    // 2. Verify callback source legitimacy (optional - implement as needed)
    // const isValidSource = await verifyCallbackSource(request);
    // if (!isValidSource) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const { code, msg, data } = callbackData;
    const taskId = data?.task_id;

    console.log(`[CALLBACK-${callbackId}] Processing callback for taskId: ${taskId}, code: ${code}`);

    // 3. Idempotency handling - avoid duplicate processing of same callback
    // 使用 callbackType 来区分不同的回调类型，避免相同 code 的冲突
    const callbackType = data?.callbackType;
    const taskKey = `${taskId}_${callbackType || 'unknown'}_${code}`;
    console.log(`[CALLBACK-${callbackId}] Checking idempotency with taskKey: ${taskKey}`);

    if (processedTasks.has(taskKey)) {
      console.log(`[CALLBACK-${callbackId}] Callback already processed, returning early`);
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

      console.log(`[CALLBACK-${callbackId}] Audio readiness check:`, {
        trackCount: tracks.length,
        allAudioReady,
        trackAudioStatus: tracks.map((t: any, i: number) => ({
          trackIndex: i,
          hasAudioUrl: !!t.audio_url,
          audioUrl: t.audio_url?.substring(0, 50) + '...'
        }))
      });

      if (allAudioReady && processedTasks.has(`${taskId}_completed`)) {
        console.log(`[CALLBACK-${callbackId}] Complete callback already processed`);
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
    console.log(`[CALLBACK-${callbackId}] Marked taskKey as processed: ${taskKey}`);

    // 4. Return success response immediately to avoid blocking (符合官方示例格式)
    const response = NextResponse.json({
      status: 'received'
    });

    // 添加CORS头支持ngrok
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 6. Process complex logic asynchronously to avoid blocking callback response
    console.log(`[CALLBACK-${callbackId}] Scheduling async processing for taskId: ${taskId}`);
    setImmediate(() => {
      processCallbackAsync(callbackData, callbackId);
    });

    // Log processing time to ensure it's within 15 seconds
    const processingTime = Date.now() - startTime;
    console.log(`[CALLBACK-${callbackId}] Response sent in ${processingTime}ms`);

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
  console.log(`[CALLBACK-${callbackId}] Starting async processing at ${new Date().toISOString()}`);

  try {
    // 1. 解析回调数据
    const { code, data } = callbackData;
    const taskId = data?.task_id; //音乐生成任务ID

    console.log(`[CALLBACK-${callbackId}] Parsed callback data:`, {
      code,
      taskId,
      callbackType: data?.callbackType,
      hasData: !!data?.data
    });


    // 2. 识别回调类型并处理
    let callbackType = data?.callbackType;
    console.log(`[CALLBACK-${callbackId}] Processing callbackType: ${callbackType}`);

    if (code === 200 && data?.data) {
      // 音乐数据直接在 data.data 数组中
      const tracks = data.data;
      console.log(`[CALLBACK-${callbackId}] Processing ${tracks.length} tracks for code 200`);

      // 4. 根据不同的回调类型处理
      if (callbackType === 'text') {
        console.log(`[CALLBACK-${callbackId}] Processing TEXT callback`);

        // 🎯 text回调时开始封面生成
        // 使用标记避免重复调用封面生成
        const coverTaskKey = `${taskId}_cover_started`;
        if (!processedTasks.has(coverTaskKey)) {
          console.log(`[CALLBACK-${callbackId}] Starting cover generation for taskId: ${taskId}`);
          processedTasks.add(coverTaskKey);

          // 异步开始封面生成，不阻塞回调处理
          setImmediate(async () => {
            try {
              console.log(`[CALLBACK-${callbackId}] Initiating cover generation for taskId: ${taskId}`);

              // 从音乐生成记录中获取用户ID
              let userId = null;
              try {
                const musicGenQuery = await query(
                  'SELECT user_id FROM music_generations WHERE task_id = $1',
                  [taskId]
                );

                if (musicGenQuery.rows.length > 0) {
                  userId = musicGenQuery.rows[0].user_id;
                  console.log(`[CALLBACK-${callbackId}] Found userId for cover generation: ${userId}`);
                } else {
                  console.error(`[CALLBACK-${callbackId}] No music generation record found for task_id: ${taskId}`);
                }
              } catch (dbError) {
                console.error(`[CALLBACK-${callbackId}] Failed to query user_id for task_id ${taskId}:`, dbError);
              }

              const coverResponse = await fetch(`${process.env.CallBackURL}/api/generate-cover`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  musicTaskId: taskId,
                  userId: userId // 直接传递用户ID
                })
              });

              if (coverResponse.ok) {
                console.log(`[CALLBACK-${callbackId}] Cover generation started successfully for taskId: ${taskId}`);
              } else {
                const errorText = await coverResponse.text();
                console.error(`[CALLBACK-${callbackId}] Failed to start cover generation for music task ${taskId}:`, errorText);
              }
            } catch (coverError) {
              console.error(`[CALLBACK-${callbackId}] Error starting cover generation for music task ${taskId}:`, coverError);
            }
          });
        }
        // 4.1 text回调：只存储数据到数据库
        console.log(`[CALLBACK-${callbackId}] Processing text callback database operations`);

        // 使用第一个track的元数据更新数据库（除了audio_url以外的所有值）
        const firstTrack = tracks[0];
        console.log(`[CALLBACK-${callbackId}] First track metadata:`, {
          id: firstTrack.id,
          title: firstTrack.title,
          hasPrompt: !!firstTrack.prompt,
          hasTags: !!firstTrack.tags
        });

        // 4.1.1 更新音乐生成记录的元数据
        // style 仅使用接口返回的 tags；如果没有 tags 则不更新 style 字段
        const styleFromTags = (firstTrack.tags && firstTrack.tags.trim() !== '') ? firstTrack.tags : undefined;

        // 提取标题 - 优先使用track.title，如果没有则尝试从歌词内容中提取
        let extractedTitle = firstTrack.title;
        if (!extractedTitle || extractedTitle.trim() === '') {
          // 尝试从歌词内容中提取标题（通常在第一行或者[Title]标签中）
          const lyricsContent = firstTrack.prompt;
          if (lyricsContent) {
            // 查找 [Title: xxx] 或 [title: xxx] 格式
            const titleMatch = lyricsContent.match(/\[title:\s*([^\]]+)\]/i);
            if (titleMatch) {
              extractedTitle = titleMatch[1].trim();
            } else {
              // 查找第一行非空行作为标题（如果不是verse/chorus等标签）
              const lines = lyricsContent.split('\n').map((line: string) => line.trim()).filter((line: string) => line);
              const firstLine = lines[0];
              if (firstLine && !firstLine.match(/^\[(verse|chorus|bridge|pre-?chorus|outro|intro)/i)) {
                extractedTitle = firstLine.replace(/^\[|\]$/g, ''); // 移除可能的方括号
              }
            }
          }
        }

        // 构建更新对象，只包含有值的字段
        const updateData: any = {
          status: 'text' // text回调已完成，文本信息已生成
        };

        // 只有当title有值时才更新
        if (extractedTitle && extractedTitle.trim() !== '') {
          updateData.title = extractedTitle.trim();
        }
        // 只有当tags有值时才更新 style
        if (styleFromTags) {
          updateData.tags = styleFromTags;
        }

        try {
          console.log(`[CALLBACK-${callbackId}] Updating music generation record with extracted title: ${extractedTitle}`);
          await updateMusicGenerationByTaskId(taskId, updateData);
          console.log(`[CALLBACK-${callbackId}] Music generation record updated successfully`);
        } catch (dbError) {
          console.error(`[CALLBACK-${callbackId}] Failed to update music generation record with text data:`, dbError);
        }

        // 4.1.2 存储歌词到music_lyrics表（音乐生成中的歌词）
        // 歌词可能在多个字段中，按优先级检查
        const lyricsContent = firstTrack.prompt;

        if (lyricsContent && lyricsContent.trim() !== '') {
          try {
            // 获取music_generation_id
            const musicGenQuery = await query(
              'SELECT id FROM music_generations WHERE task_id = $1',
              [taskId]
            );

            if (musicGenQuery.rows.length > 0) {
              const musicGenerationId = musicGenQuery.rows[0].id;

              // 创建音乐歌词记录 - 使用提取的标题
              const lyricsTitle = extractedTitle || 'Generated Lyrics';
              const lyricsRecord = await query(
                `INSERT INTO music_lyrics (music_generation_id, title, content)
                 VALUES ($1, $2, $3)
                 RETURNING *`,
                [musicGenerationId, lyricsTitle, lyricsContent]
              );
            } else {
            }

          } catch (lyricsError) {
            console.error('Failed to create music lyrics record:', lyricsError);
          }
        } else {
        }
        
        // 4.1.3 创建music_tracks记录（即使还没有audio_url）
        try {
          const musicGenQuery = await query(
            'SELECT id FROM music_generations WHERE task_id = $1',
            [taskId]
          );
          
          if (musicGenQuery.rows.length > 0) {
            const musicGenerationId = musicGenQuery.rows[0].id;
            // 默认设置为公开，用户可以在library中手动调整
            const isPublished = true;
            
            // 为每个track创建记录
            for (let i = 0; i < tracks.length; i++) {
              const track = tracks[i];
              
              // 检查是否已存在该track记录，避免重复创建
              const existingTrackQuery = await query(
                'SELECT id FROM music_tracks WHERE music_generation_id = $1 AND side_letter = $2',
                [musicGenerationId, i === 0 ? 'A' : 'B']
              );
              
              if (existingTrackQuery.rows.length > 0) {
                // 更新现有记录
                await query(
                  `UPDATE music_tracks SET 
                    suno_track_id = $1,
                    stream_audio_url = $2,
                    updated_at = NOW()
                  WHERE id = $3`,
                  [
                    track.id,
                    track.stream_audio_url,
                    existingTrackQuery.rows[0].id
                  ]
                );
              } else {
                // 创建新记录
                const trackRecord = await query(
                  `INSERT INTO music_tracks (
                    music_generation_id,
                    suno_track_id,
                    side_letter,
                    stream_audio_url,
                    is_published
                  ) VALUES ($1, $2, $3, $4, $5)
                  RETURNING *`,
                  [
                    musicGenerationId,
                    track.id, // 使用track.id
                    i === 0 ? 'A' : 'B', // 第一个是A面，第二个是B面
                    track.stream_audio_url, // 保存流式音频URL到stream_audio_url字段
                    isPublished // 根据用户的isPublished选择设置
                  ]
                );
              }
            }
          }
        } catch (tracksError) {
          console.error('Failed to create music_tracks records in text callback:', tracksError);
        }

        return; // 直接返回，不处理其他逻辑
        
      } else if (callbackType === 'first') {
        // 4.2 first回调：将 audio_url 持久化到 R2，并更新数据库对应表字段
        console.log(`[CALLBACK-${callbackId}] Processing FIRST callback`);
        try {

          // 仅处理带有 audio_url 的条目
          const tracksWithAudio = tracks.filter((t: any) => t.audio_url && t.audio_url.trim() !== '');
          console.log(`[CALLBACK-${callbackId}] Tracks with audio: ${tracksWithAudio.length}/${tracks.length}`);

          if (tracksWithAudio.length === 0) {
            console.log(`[CALLBACK-${callbackId}] No tracks with audio found, returning early`);
            return;
          }
          // 查询 userId
          let finalUserId: string = 'anonymous';
          try {
            const userQuery = await query(
              'SELECT user_id FROM music_generations WHERE task_id = $1',
              [taskId]
            );
            finalUserId = userQuery.rows[0]?.user_id || 'anonymous';
          } catch (dbErr) {
            console.error('Failed to query userId for first callback, fallback to anonymous:', dbErr);
          }

          // 查询已有标题作为后备
          let finalTitle = 'Untitled Song';
          try {
            const originalRecord = await query(
              'SELECT title FROM music_generations WHERE task_id = $1',
              [taskId]
            );
            const originalTitle = originalRecord.rows[0]?.title;
            finalTitle = originalTitle;
          } catch (titleErr) {
            console.error('Failed to resolve title for first callback, using default', titleErr);
          }

          // 获取 music_generation_id
          const musicGenQuery = await query(
            'SELECT id FROM music_generations WHERE task_id = $1',
            [taskId]
          );
          const musicGenerationId = musicGenQuery.rows[0]?.id;
          if (!musicGenerationId) {
            console.error(`No music_generations record found for taskId: ${taskId} (first callback)`);
            return;
          }

          for (let i = 0; i < tracksWithAudio.length; i++) {
            const track = tracksWithAudio[i];
            const currentSideLetter: 'A' | 'B' = i === 0 ? 'A' : 'B';

            try {
              // 下载音频并上传到 R2
              const audioUrl = track.audio_url;
              const audioBuffer = await downloadFromUrl(audioUrl);

              const filename = `${finalTitle}_${i + 1}.mp3`;
              const audioR2Url = await uploadAudioFile(audioBuffer, taskId, filename, finalUserId || 'anonymous');

              // 查找并更新对应的 track 记录（按 side_letter 匹配）
              const existingTrackQuery = await query(
                'SELECT id FROM music_tracks WHERE music_generation_id = $1 AND side_letter = $2 ORDER BY created_at ASC LIMIT 1',
                [musicGenerationId, currentSideLetter]
              );

              if (existingTrackQuery.rows.length > 0) {
                const existingTrackId = existingTrackQuery.rows[0].id;
                await query(
                  `UPDATE music_tracks SET
                    audio_url = $1,
                    duration = $2,
                    updated_at = NOW()
                  WHERE id = $3`,
                  [
                    audioR2Url || null,
                    track.duration || null,
                    existingTrackId
                  ]
                );
              } else {
                console.error(`First callback: no existing track found for side ${currentSideLetter}, this should not happen`);
              }
            } catch (audioErr) {
              console.error(`Failed to persist audio for side ${currentSideLetter} in first callback:`, audioErr);
            }
          }
          
          // 更新music_generations状态为first (带重试机制)
          await retryDatabaseOperation(async () => {
            await updateMusicGenerationByTaskId(taskId, {
              status: 'first'
            });
            console.log(`[CALLBACK-${callbackId}] Successfully updated status to 'first' for taskId: ${taskId}`);
          }, 3, callbackId, 'update status to first');
          
        } catch (err) {
          console.error('First callback processing error:', err);
        }
        return; // 处理完成，返回

      } else if (callbackType === 'complete') {
        // 4.3 complete回调：处理最终音频文件上传到R2
        console.log(`[CALLBACK-${callbackId}] Processing COMPLETE callback`);


        // 检查音频准备状态
        const audioReady = tracks.every((track: any) =>
          track.audio_url && track.audio_url.trim() !== ''
        );

        console.log(`[CALLBACK-${callbackId}] Audio readiness check for complete callback:`, {
          audioReady,
          trackCount: tracks.length,
          tracksWithAudio: tracks.filter((t: any) => t.audio_url && t.audio_url.trim() !== '').length
        });

        if (!audioReady) {
          console.log(`[CALLBACK-${callbackId}] Audio not ready for complete callback, returning early`);
          return;
        }
        // 获取用户ID和标题信息
        const musicGenQuery = await query(
          'SELECT id, user_id, title FROM music_generations WHERE task_id = $1',
          [taskId]
        );
        const musicGenerationId = musicGenQuery.rows[0]?.id;
        const finalUserId = musicGenQuery.rows[0]?.user_id || 'anonymous';
        const finalTitle = musicGenQuery.rows[0]?.title;
        
        if (!musicGenerationId) {
          console.error(`No music_generations record found for taskId: ${taskId} - this should not happen`);
          return;
        }
        
        // 获取已存在的tracks记录，按side_letter排序
        const existingTracksQuery = await query(
          'SELECT id, side_letter FROM music_tracks WHERE music_generation_id = $1 ORDER BY side_letter ASC',
          [musicGenerationId]
        );
        const existingTracks = existingTracksQuery.rows;
        
        if (existingTracks.length !== tracks.length) {
          console.error(`Mismatch: ${existingTracks.length} existing tracks vs ${tracks.length} callback tracks`);
          return;
        }
        
        // 处理每个track的音频文件
        for (let i = 0; i < tracks.length; i++) {
          const track = tracks[i];
          const existingTrack = existingTracks[i];
          const currentSideLetter = existingTrack.side_letter;
          
          try {
            // 下载音频文件到R2
            let audioR2Url = null;
            // 优先使用 source_audio_url，如果没有则使用 audio_url
            const audioUrl = track.source_audio_url || track.audio_url;

            if (audioUrl && audioUrl.trim() !== '') {
              const audioBuffer = await downloadFromUrl(audioUrl);
              const filename = `${finalTitle}_${i + 1}.mp3`;
              audioR2Url = await uploadAudioFile(audioBuffer, taskId, filename, finalUserId);
              
              // 只有音频处理成功才更新数据库
              await query(
                `UPDATE music_tracks SET 
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
            }
          } catch (error) {
            console.error(`Failed to process track ${i + 1}:`, error);
            // 音频处理失败，不更新数据库
          }
        }
        
        // 更新music_generations状态为complete (带重试机制)
        console.log(`[CALLBACK-${callbackId}] Updating music generation status to complete`);
        await retryDatabaseOperation(async () => {
          await updateMusicGenerationByTaskId(taskId, {
            status: 'complete'
          });
          console.log(`[CALLBACK-${callbackId}] Music generation status updated to complete successfully`);
        }, 5, callbackId, 'update status to complete'); // complete 回调使用 5 次重试
        return;
      } else {
        console.log(`[CALLBACK-${callbackId}] Unknown or unhandled callback type: ${callbackType}`);
      }
      
    } else if (code !== 200) {
      // 5. 处理失败的回调
      console.log(`[CALLBACK-${callbackId}] Processing FAILED callback with code: ${code}, message: ${callbackData.msg}`);

      try {
        // 获取音乐生成记录信息
        const musicGenQuery = await query(
          'SELECT id, user_id, prompt FROM music_generations WHERE task_id = $1',
          [taskId]
        );

        if (musicGenQuery.rows.length > 0) {
          const musicGeneration = musicGenQuery.rows[0];
          const { msg } = callbackData;

          console.log(`[CALLBACK-${callbackId}] Found music generation record for failed callback:`, {
            generationId: musicGeneration.id,
            userId: musicGeneration.user_id,
            hasPrompt: !!musicGeneration.prompt
          });

          // 更新音乐生成状态为错误
          await updateMusicGenerationByTaskId(taskId, {
            status: 'error',
            title: musicGeneration.prompt || 'Unknown' // 使用用户输入的prompt作为标题
          });
          console.log(`[CALLBACK-${callbackId}] Updated music generation status to error`);

          // 创建错误记录
          await createGenerationError(
            'music_generation',
            musicGeneration.id,
            msg || `Music generation failed with code ${code}`,
            `API_ERROR_${code}`
          );
          console.log(`[CALLBACK-${callbackId}] Created error record for failed generation`);

          // 退还积分 - 因为用户没有得到任何音乐结果
          try {
            // 从 credit_transactions 表中查找该 taskId 的积分消耗记录
            const creditTransactionResult = await query(
              `SELECT amount FROM credit_transactions 
               WHERE reference_id = $1 AND reference_type = 'music_generation' 
               AND transaction_type = 'spend' 
               ORDER BY created_at DESC LIMIT 1`,
              [taskId]
            );

            let creditCost = parseInt(process.env.BASIC_MODE_CREDITS || '7'); // 默认 Basic Mode 的积分消耗
            if (creditTransactionResult.rows.length > 0) {
              creditCost = creditTransactionResult.rows[0].amount;
            } else {
              console.warn(`No credit transaction found for taskId ${taskId}, using default: ${creditCost} credits`);
            }

            const refundSuccess = await addUserCredits(
              musicGeneration.user_id,
              creditCost,
              `Music generation failed - refund (${msg || 'API error'})`,
              taskId,
              'music_generation_refund'
            );

            if (refundSuccess) {
              console.log(`[CALLBACK-${callbackId}] Credits refunded successfully: ${creditCost} credits to user ${musicGeneration.user_id}`);
            } else {
              console.error(`[CALLBACK-${callbackId}] Failed to refund credits for failed music generation: ${musicGeneration.id}`);
            }
          } catch (refundError) {
            console.error(`[CALLBACK-${callbackId}] Error refunding credits for failed music generation:`, refundError);
            // 不抛出错误，避免影响错误记录的创建
          }

        } else {
          console.error(`[CALLBACK-${callbackId}] No music_generations record found for failed taskId: ${taskId}`);
        }
      } catch (error) {
        console.error(`[CALLBACK-${callbackId}] Failed to process error callback:`, error);
      }
    } else {
      console.log(`[CALLBACK-${callbackId}] Unhandled callback condition - code: ${code}, hasData: ${!!data?.data}`);
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
