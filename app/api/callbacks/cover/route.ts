import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { updateCoverGeneration } from '@/features/lyrics-cover/lib/cover-db';
import { query } from '@/lib/db-query-builder';
import { createCallbackEvent, markCallbackEventFailed, markCallbackEventProcessed, markCallbackEventProcessing } from '@/lib/callback-events-db';
import { downloadFromUrl, isManagedAssetUrl, uploadCoverImage } from '@/lib/r2-storage';

// 强制动态渲染
export const dynamic = 'force-dynamic';

// 存储封面生成结果的内存存储（生产环境应使用数据库）
const coverResults = new Map<string, {
  code: number;
  msg: string;
  data: {
    taskId: string;
    images: string[] | null;
  };
  timestamp: number;
}>();

// callback_events 不可用时的内存幂等兜底
const processedCoverTasks = new Map<string, number>();
const processingCoverTasks = new Map<string, number>();
const COVER_CALLBACK_IDEMPOTENCY_TTL_MS = 30 * 60 * 1000;

// 清理过期结果（24小时后过期）
const EXPIRATION_TIME = 24 * 60 * 60 * 1000; // 24小时

function cleanupExpiredResults() {
  const now = Date.now();
  // 使用 Array.from 来避免 TypeScript 编译错误
  Array.from(coverResults.entries()).forEach(([taskId, result]) => {
    if (now - result.timestamp > EXPIRATION_TIME) {
      coverResults.delete(taskId);
    }
  });
}

function isActiveCoverTaskKey(cache: Map<string, number>, key: string, ttlMs: number): boolean {
  const timestamp = cache.get(key);
  if (!timestamp) return false;
  if (Date.now() - timestamp > ttlMs) {
    cache.delete(key);
    return false;
  }
  return true;
}

export async function POST(request: NextRequest) {
  const callbackId = `cover_callback_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  try {
    const rawBody = await request.text();
    let body: any = {};
    if (rawBody.trim().length > 0) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        console.error(`[COVER-CALLBACK-${callbackId}] Invalid callback payload: body is not valid JSON`);
        return NextResponse.json({ status: 'error', message: 'Invalid JSON payload' }, { status: 400 });
      }
    }

    // 验证回调数据结构
    if (!body.data?.taskId) {
      console.error(`[COVER-CALLBACK-${callbackId}] Invalid callback data: missing taskId`);
      return NextResponse.json({ status: 'error', message: 'Missing taskId' }, { status: 400 });
    }

    const { code, msg, data } = body;
    const coverTaskId = data.taskId;

    if (!Number.isFinite(code)) {
      console.error(`[COVER-CALLBACK-${callbackId}] Invalid callback data: missing/invalid code`);
      return NextResponse.json({ status: 'error', message: 'Missing/invalid code' }, { status: 400 });
    }

    const imageCount = Array.isArray(data?.images) ? data.images.length : 0;
    console.log(
      `[COVER-CALLBACK-${callbackId}] Received: taskId=${coverTaskId}, code=${code}, imageCount=${imageCount}, msg=${typeof msg === 'string' ? msg : ''}`
    );

    let callbackEventId: string | undefined;
    let callbackEventsEnabled = false;
    try {
      const payloadHash = createHash('sha256')
        .update(rawBody.trim().length > 0 ? rawBody : JSON.stringify(body || {}))
        .digest('hex');

      const callbackEventResult = await createCallbackEvent({
        provider: 'kie',
        sourceLabel: 'cover',
        taskId: coverTaskId,
        callbackType: 'cover',
        code,
        payload: body,
        payloadHash,
      });

      callbackEventsEnabled = callbackEventResult.enabled;
      callbackEventId = callbackEventResult.eventId;

      if (callbackEventResult.enabled && !callbackEventResult.accepted) {
        console.log(
          `[COVER-CALLBACK-${callbackId}] Duplicate callback ignored by callback_events gate: taskId=${coverTaskId}, status=${callbackEventResult.duplicateStatus || 'unknown'}`
        );
        return NextResponse.json({ status: 'received', message: 'Duplicate callback ignored' });
      }
    } catch (eventError) {
      console.warn(`[COVER-CALLBACK-${callbackId}] Failed to persist callback event (fallback to memory gate):`, eventError);
    }

    const taskKey = `${coverTaskId}_${code}_cover`;
    if (!callbackEventsEnabled) {
      if (isActiveCoverTaskKey(processedCoverTasks, taskKey, COVER_CALLBACK_IDEMPOTENCY_TTL_MS)) {
        console.log(`[COVER-CALLBACK-${callbackId}] Duplicate callback ignored by in-memory gate: ${taskKey}`);
        return NextResponse.json({ status: 'received', message: 'Duplicate callback ignored' });
      }
      if (isActiveCoverTaskKey(processingCoverTasks, taskKey, COVER_CALLBACK_IDEMPOTENCY_TTL_MS)) {
        console.log(`[COVER-CALLBACK-${callbackId}] Callback currently processing: ${taskKey}`);
        return NextResponse.json({ status: 'received', message: 'Callback processing in progress' });
      }
    }

    // 快速响应，异步处理复杂逻辑
    const response = NextResponse.json({ status: 'received' });
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

        if (!callbackEventsEnabled) {
          processingCoverTasks.set(taskKey, Date.now());
        }

        processedSuccessfully = await processCoverCallbackAsync({ code, msg, data }, callbackId);

        if (!processedSuccessfully) {
          failureReason = 'cover_callback_not_processed';
        } else if (!callbackEventsEnabled) {
          processedCoverTasks.set(taskKey, Date.now());
        }
      } catch (processError) {
        failureReason = processError instanceof Error ? processError.message : 'cover_callback_async_error';
        console.error(`[COVER-CALLBACK-${callbackId}] Async callback processing failed:`, processError);
      } finally {
        if (!callbackEventsEnabled) {
          processingCoverTasks.delete(taskKey);
        }

        if (callbackEventId) {
          try {
            if (processedSuccessfully) {
              await markCallbackEventProcessed(callbackEventId);
            } else {
              await markCallbackEventFailed(callbackEventId, failureReason || 'cover_callback_not_processed');
            }
          } catch (eventStatusError) {
            console.error(`[COVER-CALLBACK-${callbackId}] Failed to update callback_events status:`, eventStatusError);
          }
        }
      }
    });

    return response;
  } catch (error) {
    console.error(`[COVER-CALLBACK-${callbackId}] Callback processing error:`, error);

    // 返回简单错误响应
    const errorResponse = NextResponse.json({ status: 'error' }, { status: 500 });
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    errorResponse.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return errorResponse;
  }
}

// 异步处理封面回调逻辑
async function processCoverCallbackAsync(callbackData: any, callbackId: string): Promise<boolean> {
  try {
    const { code, msg, data } = callbackData;
    const coverTaskId = data.taskId;
    
    // 处理不同的状态码
    if (code === 200) {
      // 成功：存储封面生成结果
      console.log(`[COVER-CALLBACK-${callbackId}] Success callback: coverTaskId=${coverTaskId}, imageCount=${data.images?.length || 0}`);
      
      // 根据官方文档，通常生成2张不同风格的图片
      const expectedImageCount = 2;
      const actualImageCount = data.images?.length || 0;
      
      if (actualImageCount === 0) {
        console.warn(`No images received for coverTaskId: ${coverTaskId}, expected ${expectedImageCount} images`);
      } else if (actualImageCount !== expectedImageCount) {
        console.log(`Received ${actualImageCount} images for coverTaskId: ${coverTaskId}, expected ${expectedImageCount} images`);
      } else {
        console.log(`Successfully received ${actualImageCount} cover images for coverTaskId: ${coverTaskId}`);
      }
      
      const result = {
        code: code,
        msg: msg || 'success',
        data: {
          taskId: coverTaskId,
          images: data.images || null
        },
        timestamp: Date.now()
      };

      coverResults.set(coverTaskId, result);
      
      // 封面图片信息不再需要发送到前端，因为前端已经在text回调中处理封面显示
      const imagesCount = data.images?.length || 0;
      console.log(`[COVER-CALLBACK-${callbackId}] Cover generation completed for coverTaskId=${coverTaskId}, imagesCount=${imagesCount}`);
      
      // 从数据库查询用户ID
      let finalUserId: string;
      console.log(`[COVER-CALLBACK-${callbackId}] Querying database for userId by coverTaskId=${coverTaskId}`);
      
      try {
        const coverRecord = await query(
          'SELECT user_id FROM cover_generations WHERE task_id = $1',
          [coverTaskId]
        );
        console.log(`[COVER-CALLBACK-${callbackId}] cover_generations lookup count=${coverRecord.rows.length} for taskId=${coverTaskId}`);
        
        if (coverRecord.rows.length > 0 && coverRecord.rows[0].user_id) {
          finalUserId = coverRecord.rows[0].user_id;
          console.log(`[COVER-CALLBACK-${callbackId}] Resolved userId from cover_generations`);
        } else {
          console.error(`[COVER-CALLBACK-${callbackId}] No cover record found for coverTaskId=${coverTaskId}`);
          finalUserId = 'anonymous';
        }
      } catch (dbError) {
        console.error(`[COVER-CALLBACK-${callbackId}] Failed to query userId for coverTaskId=${coverTaskId}:`, dbError);
        finalUserId = 'anonymous';
      }
      
      // 最终确认userId
      console.log(`[COVER-CALLBACK-${callbackId}] Final userId for cover backup=${finalUserId}`);
      
      // 存储到数据库
      try {
        // 查找对应的cover_generations记录
        const coverRecord = await query(
          'SELECT id, music_task_id FROM cover_generations WHERE task_id = $1',
          [coverTaskId]
        );
        
        if (coverRecord.rows.length > 0) {
          const coverGenerationId = coverRecord.rows[0].id;
          
          // 更新cover_generations状态
          await updateCoverGeneration(coverTaskId, {
            status: 'complete'
          });
          
          // 立即存储临时图片链接到数据库，前端立即可用
          if (data.images && data.images.length > 0) {
            console.log(`[COVER-CALLBACK-${callbackId}] Applying temporary cover URLs to tracks, imageCount=${data.images.length}`);
            
            const musicTaskId = coverRecord.rows[0].music_task_id || coverTaskId;
            
            // 查找对应的tracks记录
            const tracksQuery = await query(
              'SELECT id FROM tracks WHERE music_id = (SELECT id FROM music WHERE task_id = $1) AND (is_deleted IS NULL OR is_deleted = FALSE) ORDER BY created_at ASC, id ASC',
              [musicTaskId]
            );
            
            if (tracksQuery.rows.length > 0) {
              console.log(`[COVER-CALLBACK-${callbackId}] Found ${tracksQuery.rows.length} tracks, updating cover_image_url`);
              
              // 直接更新tracks表的cover_image_url字段（更安全的方式）
              // 注意：生成图片接口生成的图片应该优先于延长音乐接口回传的图片
              // 所以这里应该覆盖已有的 cover_image_url（如果存在）
              for (let i = 0; i < Math.min(tracksQuery.rows.length, data.images.length); i++) {
                await query(
                  `UPDATE tracks SET cover_image_url = $1, updated_at = NOW() 
                   WHERE id = $2`,
                  [data.images[i], tracksQuery.rows[i].id] // 使用临时图片URL，前端立即可用
                );
                
                // ✅ 不需要触发事件！前端轮询会自动获取新数据
                console.log(`[COVER-CALLBACK-${callbackId}] Updated cover_image_url for track ${tracksQuery.rows[i].id}`);
              }
              
              console.log(`[COVER-CALLBACK-${callbackId}] Updated ${Math.min(tracksQuery.rows.length, data.images.length)} tracks with cover_image_url`);
              
              // 注意：如果延长音乐也调用了封面生成接口，这里的查询会找到延长音乐的 tracks 并更新封面
              // 延长音乐的封面会在延长音乐回调时，通过检查原音乐的封面来更新（如果封面回调还没更新）
              
              // 立即开始R2备份，不等待complete回调
              console.log(`[COVER-CALLBACK-${callbackId}] Starting immediate R2 backup for cover images`);
              setImmediate(async () => {
                try {
                  console.log(`[COVER-CALLBACK-${callbackId}] Async R2 backup started for coverTaskId=${coverTaskId}`);
                  
                  // 查询需要备份的tracks记录（使用临时URL的）
                  const backupQuery = await query(
                    `SELECT mt.id, mt.cover_image_url, cg.user_id
                     FROM tracks mt
                     JOIN music mg ON mt.music_id = mg.id
                     JOIN cover_generations cg ON mg.task_id = cg.music_task_id
                     WHERE cg.task_id = $1
                     AND mt.cover_image_url LIKE 'http%'`,
                    [coverTaskId]
                  );
                  
                  if (backupQuery.rows.length > 0) {
                    console.log(`[COVER-CALLBACK-${callbackId}] Candidate cover images for backup=${backupQuery.rows.length}`);
                    
                    for (const track of backupQuery.rows) {
                      try {
                        if (isManagedAssetUrl(track.cover_image_url)) {
                          continue;
                        }
                        console.log(`[COVER-CALLBACK-${callbackId}] Backing up cover for track=${track.id}`);

                        const imageBuffer = await downloadFromUrl(track.cover_image_url);
                        const filename = `${Date.now()}_${track.id}.png`;

                        // Upload cover image
                        const coverImageUrl = await uploadCoverImage(
                          imageBuffer,
                          coverTaskId,
                          filename,
                          track.user_id || 'anonymous'
                        );

                        // Update tracks record with cover URL
                        await query(
                          'UPDATE tracks SET cover_image_url = $1 WHERE id = $2',
                          [coverImageUrl, track.id]
                        );

                        console.log(`[COVER-CALLBACK-${callbackId}] Backed up cover image for track=${track.id}`);
                      } catch (imageError) {
                        console.error(`[COVER-CALLBACK-${callbackId}] Failed to backup cover image for track=${track.id}:`, imageError);
                      }
                    }
                    
                    console.log(`[COVER-CALLBACK-${callbackId}] Cover image backup completed for coverTaskId=${coverTaskId}`);
                  } else {
                    console.log(`[COVER-CALLBACK-${callbackId}] No cover images pending backup`);
                  }
                } catch (backupError) {
                  console.error(`[COVER-CALLBACK-${callbackId}] Error during async cover backup:`, backupError);
                }
              });
            } else {
              console.log(`[COVER-CALLBACK-${callbackId}] No tracks found for musicTaskId=${musicTaskId}`);
            }
          }
          
          console.log(`[COVER-CALLBACK-${callbackId}] Cover generation finalized for coverTaskId=${coverTaskId}, coverGenerationId=${coverGenerationId}`);
          
          // 封面存储完成后，查询文本数据并一起推送到前端
          try {
            const musicTaskId = coverRecord.rows[0].music_task_id || coverTaskId;
            console.log(`[COVER-CALLBACK-${callbackId}] Preparing cover push payload for musicTaskId=${musicTaskId}`);

            // 查询tracks数据，获取封面图片信息（使用新的cover_image_url字段）
            const tracksQuery = await query(
              `SELECT mt.id, mt.cover_image_url
               FROM tracks mt
               WHERE mt.music_id = (
                 SELECT id FROM music WHERE task_id = $1
               )
               AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
               ORDER BY mt.created_at ASC, mt.id ASC`,
              [musicTaskId]
            );

            if (tracksQuery.rows.length > 0) {
              console.log(`[COVER-CALLBACK-${callbackId}] Cover payload ready for musicTaskId=${musicTaskId}, tracks=${tracksQuery.rows.length}`);
            }
          } catch (pushError) {
            console.error(`[COVER-CALLBACK-${callbackId}] Failed to build cover push payload:`, pushError);
          }
        } else {
          console.error(`[COVER-CALLBACK-${callbackId}] No cover_generation row found for coverTaskId=${coverTaskId}`);
          return false;
        }
        
      } catch (dbError) {
        console.error(`[COVER-CALLBACK-${callbackId}] Failed to persist cover callback data:`, dbError);
        return false;
      }
      return true;
      
    } else if (code === 501) {
      // 封面生成失败
      const result = {
        code: code,
        msg: msg || 'Cover generation failed',
        data: {
          taskId: coverTaskId,
          images: null
        },
        timestamp: Date.now()
      };

      coverResults.set(coverTaskId, result);
      
      console.error(`[COVER-CALLBACK-${callbackId}] Cover generation failed for coverTaskId=${coverTaskId}, msg=${msg}`);
      
      // 更新数据库记录为失败状态
      try {
        await updateCoverGeneration(coverTaskId, {
          status: 'error'
        });
        console.log(`[COVER-CALLBACK-${callbackId}] Updated cover_generation status=error for coverTaskId=${coverTaskId}`);
      } catch (dbError) {
        console.error(`[COVER-CALLBACK-${callbackId}] Failed to update cover_generation error state:`, dbError);
        return false;
      }
      return true;
      
    } else if (code === 400) {
      // 重复请求：该音乐任务已生成过Cover
      console.log(`[COVER-CALLBACK-${callbackId}] Cover already exists for coverTaskId=${coverTaskId}, msg=${msg}`);
      
      const result = {
        code: code,
        msg: msg || 'Cover already exists for this music task',
        data: {
          taskId: coverTaskId,
          images: null
        },
        timestamp: Date.now()
      };

      coverResults.set(coverTaskId, result);
      
      // 发送重复请求通知到前端

      return true;

    } else if (code === 531) {
      // 服务器错误，积分已退还
      const result = {
        code: code,
        msg: msg || 'Generation failed, credits refunded',
        data: {
          taskId: coverTaskId,
          images: null
        },
        timestamp: Date.now()
      };

      coverResults.set(coverTaskId, result);
      
      console.error(`[COVER-CALLBACK-${callbackId}] Cover generation server error for coverTaskId=${coverTaskId}, msg=${msg}`);
      
      // 发送错误通知到前端

      return true;

    } else {
      // 其他错误状态
      const result = {
        code: code,
        msg: msg || 'Unknown error',
        data: {
          taskId: coverTaskId,
          images: null
        },
        timestamp: Date.now()
      };

      coverResults.set(coverTaskId, result);
      
      console.error(`[COVER-CALLBACK-${callbackId}] Cover generation error for coverTaskId=${coverTaskId}, code=${code}, msg=${msg}`);
      return true;
    }

  } catch (error) {
    console.error(`[COVER-CALLBACK-${callbackId}] Async processing error:`, error);
    return false;
  } finally {
    cleanupExpiredResults();
  }
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

    // 清理过期结果
    cleanupExpiredResults();

    const result = coverResults.get(taskId);
    
    if (!result) {
      return NextResponse.json({
        code: 202,
        msg: 'Cover generation in progress',
        data: {
          taskId: taskId,
          images: null
        }
      });
    }

    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Get cover result error:', error);
    
    // 记录错误日志
    console.error('Failed to get cover result:', error);
    
    return NextResponse.json(
      { error: 'Failed to get cover result' },
      { status: 500 }
    );
  }
}
