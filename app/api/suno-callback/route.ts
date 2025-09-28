import { NextRequest, NextResponse } from 'next/server';

import { updateMusicGenerationByTaskId } from '@/lib/music-db';
import { createGenerationError } from '@/lib/generation-errors-db';
import { addUserCredits } from '@/lib/user-db';
import { downloadFromUrl, uploadAudioFile } from '@/lib/r2-storage';
import { query } from '@/lib/neon';

// Cache for processed tasks to handle idempotency
const processedTasks = new Set<string>();

// Handle Suno API callbacks
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 1. Fast response - must return response within 15 seconds
    const callbackData = await request.json();
    
    console.log('=== SUNO CALLBACK RECEIVED ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Callback data:', JSON.stringify(callbackData, null, 2));
    
    // 2. Verify callback source legitimacy (optional - implement as needed)
    // const isValidSource = await verifyCallbackSource(request);
    // if (!isValidSource) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }
    
    const { code, msg, data } = callbackData;
    const taskId = data?.task_id;

    // 3. Idempotency handling - avoid duplicate processing of same callback
    // 使用 callbackType 来区分不同的回调类型，避免相同 code 的冲突
    const callbackType = data?.callbackType;
    const taskKey = `${taskId}_${callbackType || 'unknown'}_${code}`;
    if (processedTasks.has(taskKey)) {
      console.log(`Task ${taskId} with callbackType ${callbackType} and code ${code} already processed, skipping duplicate`);
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
        console.log(`Task ${taskId} already completed with all audio ready, skipping`);
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
      processCallbackAsync(callbackData);
    });
    
    // Log processing time to ensure it's within 15 seconds
    const processingTime = Date.now() - startTime;
    console.log(`Callback processing time: ${processingTime}ms`);
    
    return response;

  } catch (error) {
    console.error('Callback processing error:', error);
    
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
async function processCallbackAsync(callbackData: any) {
  try {
    // 1. 解析回调数据
    const { code, data } = callbackData;
    const taskId = data?.task_id; //音乐生成任务ID
    
    // 2. 识别回调类型并处理
    let callbackType = data?.callbackType;
    
    console.log(`Callback type: ${callbackType}, code: ${code}`);
    
    if (code === 200 && data?.data) {
      // 音乐数据直接在 data.data 数组中
      const tracks = data.data;

      // 4. 根据不同的回调类型处理
      if (callbackType === 'text') {
        // 🎯 text回调时开始封面生成
        // 使用标记避免重复调用封面生成
        const coverTaskKey = `${taskId}_cover_started`;
        if (!processedTasks.has(coverTaskKey)) {
          processedTasks.add(coverTaskKey);

          // 异步开始封面生成，不阻塞回调处理
          setImmediate(async () => {
            try {
              console.log(`Starting cover generation for text callback - music task: ${taskId}`);

              // 从音乐生成记录中获取用户ID
              let userId = null;
              try {
                const musicGenQuery = await query(
                  'SELECT user_id FROM music_generations WHERE task_id = $1',
                  [taskId]
                );
                
                if (musicGenQuery.rows.length > 0) {
                  userId = musicGenQuery.rows[0].user_id;
                  console.log(`Found user_id for cover generation: ${userId}`);
                } else {
                  console.error(`No music generation record found for task_id: ${taskId}`);
                }
              } catch (dbError) {
                console.error(`Failed to query user_id for task_id ${taskId}:`, dbError);
              }

              const coverResponse = await fetch(`${process.env.BASE_URL}/api/generate-cover`, {
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
                console.log(`Cover generation started for music task ${taskId}`);
              } else {
                const errorText = await coverResponse.text();
                console.error(`Failed to start cover generation for music task ${taskId}:`, errorText);
              }
            } catch (coverError) {
              console.error(`Error starting cover generation for music task ${taskId}:`, coverError);
            }
          });
        }
        // 4.1 text回调：只存储数据到数据库
        console.log(`Task ${taskId} - text callback, storing metadata for ${tracks.length} tracks`);

        // 使用第一个track的元数据更新数据库（除了audio_url以外的所有值）
        const firstTrack = tracks[0];

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
          await updateMusicGenerationByTaskId(taskId, updateData);
          console.log(`Updated music generation record with text data - title: ${extractedTitle || 'not updated'}, tags: ${styleFromTags || 'not updated'}`);
        } catch (dbError) {
          console.error('Failed to update music generation record with text data:', dbError);
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
              console.log(`Created music_lyrics record with title: ${lyricsTitle}`);
            } else {
              console.log('No music generation record found for task_id:', taskId);
            }

          } catch (lyricsError) {
            console.error('Failed to create music lyrics record:', lyricsError);
          }
        } else {
          console.log('No lyrics content found in text callback');
        }
        
        // 4.1.3 创建music_tracks记录（即使还没有audio_url）
        try {
          const musicGenQuery = await query(
            'SELECT id FROM music_generations WHERE task_id = $1',
            [taskId]
          );
          
          if (musicGenQuery.rows.length > 0) {
            const musicGenerationId = musicGenQuery.rows[0].id;
            
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
                console.log(`Updated existing music_track record for side ${i === 0 ? 'A' : 'B'}`);
              } else {
                // 创建新记录
                const trackRecord = await query(
                  `INSERT INTO music_tracks (
                    music_generation_id,
                    suno_track_id,
                    side_letter,
                    stream_audio_url
                  ) VALUES ($1, $2, $3, $4)
                  RETURNING *`,
                  [
                    musicGenerationId,
                    track.id, // 使用track.id
                    i === 0 ? 'A' : 'B', // 第一个是A面，第二个是B面
                    track.stream_audio_url // 保存流式音频URL到stream_audio_url字段
                  ]
                );
                console.log(`Created music_track record for side ${i === 0 ? 'A' : 'B'}:`, trackRecord.rows[0].id);
              }
            }
            console.log(`Processed ${tracks.length} music_tracks records for taskId: ${taskId}`);
          }
        } catch (tracksError) {
          console.error('Failed to create music_tracks records in text callback:', tracksError);
        }
        console.log(`Text callback completed for ${tracks.length} tracks, data stored in database`);

        return; // 直接返回，不处理其他逻辑
        
      } else if (callbackType === 'first') {
        // 4.2 first回调：将 audio_url 持久化到 R2，并更新数据库对应表字段
        console.log(`Task ${taskId} - first callback received, persisting available audio to R2`);
        try {
          // 仅处理带有 audio_url 的条目
          const tracksWithAudio = tracks.filter((t: any) => t.audio_url && t.audio_url.trim() !== '');
          if (tracksWithAudio.length === 0) {
            console.log(`Task ${taskId} - first callback has no audio_url yet, skip`);
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
            console.log('Found userId for first callback:', finalUserId);
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
                console.log(`First callback: updated track ${existingTrackId} (side ${currentSideLetter}) with R2 URL`);
              } else {
                console.error(`First callback: no existing track found for side ${currentSideLetter}, this should not happen`);
              }
            } catch (audioErr) {
              console.error(`Failed to persist audio for side ${currentSideLetter} in first callback:`, audioErr);
            }
          }
          
          // 更新music_generations状态为first
          try {
            await updateMusicGenerationByTaskId(taskId, {
              status: 'first'
            });
            console.log(`Updated music generation status to 'first' for taskId: ${taskId}`);
          } catch (updateError) {
            console.error(`Failed to update music generation status to 'first' for taskId: ${taskId}`, updateError);
          }
          
          console.log(`First callback processing finished for task ${taskId}`);
        } catch (err) {
          console.error('First callback processing error:', err);
        }
        return; // 处理完成，返回

      } else if (callbackType === 'complete') {
        // 4.3 complete回调：处理最终音频文件上传到R2
        console.log(`Task ${taskId} - complete callback processing`);
        
        // 检查音频准备状态
        const audioReady = tracks.every((track: any) => 
          track.audio_url && track.audio_url.trim() !== ''
        );
        
        if (!audioReady) {
          console.log(`Task ${taskId} - waiting for all audio to be ready, skipping processing`);
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
              console.log(`Downloading audio from: ${audioUrl}`);
              const audioBuffer = await downloadFromUrl(audioUrl);
              console.log(`Downloaded audio buffer size: ${audioBuffer.length} bytes`);
              const filename = `${finalTitle}_${i + 1}.mp3`;
              audioR2Url = await uploadAudioFile(audioBuffer, taskId, filename, finalUserId);
              console.log(`Uploaded track ${i + 1} to R2: ${audioR2Url}`);
              
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
              console.log(`Updated track ${existingTrack.id} (side ${currentSideLetter}) with R2 URL`);            
            } else {
              console.log(`No audio URL available for track ${i + 1}, skipping`);
            }
          } catch (error) {
            console.error(`Failed to process track ${i + 1}:`, error);
            // 音频处理失败，不更新数据库
          }
        }
        
        // 更新music_generations状态为complete
        try {
          await updateMusicGenerationByTaskId(taskId, {
            status: 'complete'
          });
          console.log(`Task ${taskId} complete callback processing finished - status updated to complete`);

        } catch (updateError) {
          console.error(`Failed to update music_generations status to complete for taskId: ${taskId}`, updateError);
          // 即使更新失败也要记录，避免无限轮询
          throw new Error(`Failed to update music generation status: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`);
        }
        return;
      } else {
        console.log(`Task ${taskId} - unknown callbackType: ${callbackType}`);
      }
      
    } else if (code !== 200) {
      // 5. 处理失败的回调
      console.log(`Task ${taskId} generation failed with code ${code}`);

      try {
        // 获取音乐生成记录信息
        const musicGenQuery = await query(
          'SELECT id, user_id, prompt FROM music_generations WHERE task_id = $1',
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
               WHERE reference_id = $1 AND reference_type = 'music_generation' 
               AND transaction_type = 'spend' 
               ORDER BY created_at DESC LIMIT 1`,
              [taskId]
            );

            let creditCost = 7; // 默认 Basic Mode 的积分消耗
            if (creditTransactionResult.rows.length > 0) {
              creditCost = creditTransactionResult.rows[0].amount;
              console.log(`Found credit transaction for taskId ${taskId}: ${creditCost} credits`);
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
              console.log(`Successfully refunded ${creditCost} credit(s) for failed music generation: ${musicGeneration.id}`);
            } else {
              console.error(`Failed to refund credits for failed music generation: ${musicGeneration.id}`);
            }
          } catch (refundError) {
            console.error('Error refunding credits for failed music generation:', refundError);
            // 不抛出错误，避免影响错误记录的创建
          }

          console.log(`Created error record for failed music generation: ${musicGeneration.id}`);
          console.log(`Error message: ${msg}`);
        } else {
          console.error(`No music_generations record found for failed taskId: ${taskId}`);
        }
      } catch (error) {
        console.error('Failed to process error callback:', error);
      }
    } else {
      console.log(`Unknown callback code: ${code}`);
    }
  } catch (error) {
    console.error('Async callback processing failed:', error);
    // 尝试获取taskId用于错误通知
    try {
      const { data } = callbackData;
      const taskId = data?.task_id;
      if (taskId) {
        console.error(`Error processing callback for taskId: ${taskId}`);
      }
    } catch (taskIdError) {
      console.error('Failed to extract taskId from error context:', taskIdError);
    }
  }
}

// 定期清理缓存，防止内存泄漏
setInterval(() => {
  if (processedTasks.size > 1000) {
    processedTasks.clear();
    console.log('Processed task cache cleared');
  }
}, 60 * 60 * 1000); // 每小时清理一次
