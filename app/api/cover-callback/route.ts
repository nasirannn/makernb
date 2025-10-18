import { NextRequest, NextResponse } from 'next/server';
import { createCoverGeneration, updateCoverGeneration } from '@/lib/cover-db';
import { createCoverImages } from '@/lib/cover-images-db';
import { query } from '@/lib/db-query-builder';
import { downloadFromUrl, uploadCoverImage } from '@/lib/r2-storage';

import { handleError, createErrorNotification, retryOperation, ErrorContext } from '@/lib/error-handler';

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

// 幂等处理 - 避免重复处理同一回调
const processedCoverTasks = new Set<string>();

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('=== COVER CALLBACK RECEIVED ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Cover callback received:', JSON.stringify(body, null, 2));

    // 验证回调数据结构
    if (!body.data?.taskId) {
      console.error('Invalid callback data: missing taskId');
      return NextResponse.json({ status: 'error', message: 'Missing taskId' }, { status: 400 });
    }

    const { code, msg, data } = body;
    const coverTaskId = data.taskId;
    
    // 幂等处理 - 避免重复处理同一回调
    const taskKey = `${coverTaskId}_${code}`;
    if (processedCoverTasks.has(taskKey)) {
      console.log(`Cover task ${coverTaskId} with code ${code} already processed, skipping duplicate`);
      return NextResponse.json({ status: 'received' });
    }
    
    // 标记为已处理
    processedCoverTasks.add(taskKey);
    
    // 快速响应，异步处理复杂逻辑
    const response = NextResponse.json({ status: 'received' });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // 异步处理复杂逻辑 - 不再依赖x-user-id，从数据库查询用户ID
    setImmediate(() => {
      processCoverCallbackAsync({ code, msg, data });
    });
    
    return response;
    
  } catch (error) {
    console.error('Cover callback processing error:', error);
    
    // 返回简单错误响应
    const errorResponse = NextResponse.json({ status: 'error' }, { status: 500 });
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    errorResponse.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return errorResponse;
  }
}

// 异步处理封面回调逻辑
async function processCoverCallbackAsync(callbackData: any) {
  try {
    const { code, msg, data } = callbackData;
    const coverTaskId = data.taskId;
    
    // 处理不同的状态码
    if (code === 200) {
      // 成功：存储封面生成结果
      console.log(`Cover generation completed for coverTaskId: ${coverTaskId}`, {
        imagesCount: data.images?.length || 0,
        images: data.images
      });
      
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
      console.log(`Cover generation completed for coverTaskId: ${coverTaskId}, images count: ${imagesCount}`);
      
      // 从数据库查询用户ID
      let finalUserId: string;
      console.log(`Querying database for userId using cover taskId: ${coverTaskId}`);
      
      try {
        const coverRecord = await query(
          'SELECT user_id FROM cover_generations WHERE task_id = $1',
          [coverTaskId]
        );
        console.log(`Cover query result for cover taskId ${coverTaskId}:`, coverRecord.rows);
        
        if (coverRecord.rows.length > 0 && coverRecord.rows[0].user_id) {
          finalUserId = coverRecord.rows[0].user_id;
          console.log(`Found userId from cover_generations using cover taskId: ${finalUserId}`);
        } else {
          console.error(`No cover record found for cover taskId: ${coverTaskId}`);
          finalUserId = 'anonymous';
        }
      } catch (dbError) {
        console.error(`Database query failed for cover taskId ${coverTaskId}:`, dbError);
        finalUserId = 'anonymous';
      }
      
      // 最终确认userId
      console.log(`Final userId for R2 upload: ${finalUserId}`);
      
      // 准备文件名数组（用于异步下载）
      const originalFilenames = [];
      if (data.images && data.images.length > 0) {
        for (let i = 0; i < data.images.length; i++) {
          const imageUrl = data.images[i];
          // 从URL中提取原始文件名
          const urlParts = imageUrl.split('/');
          let originalFilename = urlParts[urlParts.length - 1];
          
          // 确保文件名有效，如果提取失败则使用时间戳+索引作为备用
          if (!originalFilename || originalFilename.trim() === '') {
            originalFilename = `cover_${Date.now()}_${i + 1}.png`;
          }
          
          originalFilenames.push(originalFilename);
        }
      }
      
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
            console.log(`Creating cover_images records with temporary URLs: ${JSON.stringify(data.images)}`);
            
            const musicTaskId = coverRecord.rows[0].music_task_id || coverTaskId;
            
            // 查找对应的music_tracks记录
            const tracksQuery = await query(
              'SELECT id, side_letter FROM music_tracks WHERE music_generation_id = (SELECT id FROM music_generations WHERE task_id = $1) AND (is_deleted IS NULL OR is_deleted = FALSE) ORDER BY created_at ASC',
              [musicTaskId]
            );
            
            if (tracksQuery.rows.length > 0) {
              console.log(`Found ${tracksQuery.rows.length} music tracks, creating cover_images records with temporary URLs`);
              
              // 为每个track创建cover_images记录，使用临时图片URL
              for (let i = 0; i < Math.min(tracksQuery.rows.length, data.images.length); i++) {
                await query(
                  `INSERT INTO cover_images (cover_generation_id, music_track_id, r2_url, filename)
                   VALUES ($1, $2, $3, $4)`,
                  [
                    coverGenerationId,
                    tracksQuery.rows[i].id,
                    data.images[i], // 使用临时图片URL，前端立即可用
                    originalFilenames[i] || `cover_${i + 1}.jpeg`
                  ]
                );
              }
              
              console.log(`Successfully created ${Math.min(tracksQuery.rows.length, data.images.length)} cover_images records with temporary URLs`);
              
              // 标记需要异步下载的图片信息，等待complete回调触发
              console.log(`Cover images stored with temporary URLs, waiting for complete callback to trigger R2 backup`);
            } else {
              console.log(`No music tracks found, creating cover_images without track association`);
              // 如果没有music_tracks，创建不关联的cover_images记录
              await createCoverImages(coverGenerationId, data.images, originalFilenames);
            }
          }
          
          console.log(`Cover generation completed for coverTaskId: ${coverTaskId}, coverGenerationId: ${coverGenerationId}`);
          
          console.log(`Updated cover generation record for coverTaskId: ${coverTaskId}, coverGenerationId: ${coverGenerationId}`);
          
          // 封面存储完成后，查询文本数据并一起推送到前端
          try {
            const musicTaskId = coverRecord.rows[0].music_task_id || coverTaskId;
            console.log(`=== Cover Callback Debug ===`);
            console.log(`Cover Task ID: ${coverTaskId}`);
            console.log(`Music Task ID from cover record: ${coverRecord.rows[0].music_task_id}`);
            console.log(`Final Music Task ID: ${musicTaskId}`);
            console.log(`Pushing cover images update for musicTaskId: ${musicTaskId}`);

            // 查询music_tracks数据，获取封面图片信息
            const tracksQuery = await query(
              `SELECT mt.id, mt.side_letter, ci.r2_url as cover_r2_url
               FROM music_tracks mt
               LEFT JOIN cover_images ci ON mt.id = ci.music_track_id
               WHERE mt.music_generation_id = (
                 SELECT id FROM music_generations WHERE task_id = $1
               )
               AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
               ORDER BY mt.side_letter ASC`,
              [musicTaskId]
            );

            if (tracksQuery.rows.length > 0) {
              // 使用R2存储的封面图片
              const coverImages = tracksQuery.rows.map(row => row.cover_r2_url).filter(Boolean);

              // 构建封面更新信息
              const coverUpdateInfo = tracksQuery.rows.map((track: any, index: number) => ({
                trackIndex: index,
                coverImage: track.cover_r2_url || null,
                sideLetter: track.side_letter
              }));

              // 推送封面更新到前端
              const pushData = {
                type: 'cover',
                taskId: musicTaskId,
                status: 'PROCESSING',
                images: coverImages,
                coverUpdates: coverUpdateInfo,
                message: `Cover generation completed for ${tracksQuery.rows.length} tracks`
              };

              console.log(`Pushing cover update to frontend:`, JSON.stringify(pushData, null, 2));

              // 使用重试机制推送数据
              console.log(`🚀 Pushing cover callback for musicTaskId: ${musicTaskId}`);

            }
          } catch (pushError) {
            console.error('Failed to push combined data to frontend:', pushError);
          }
        } else {
          console.error(`No cover generation record found for coverTaskId: ${coverTaskId}`);
        }
        
      } catch (dbError) {
        console.error('Failed to save cover generation to database:', dbError);
      }
      
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
      
      console.error(`Cover generation failed for coverTaskId: ${coverTaskId}`, msg);
      
      // 更新数据库记录为失败状态
      try {
        await updateCoverGeneration(coverTaskId, {
          status: 'error'
        });
        console.log(`Updated cover generation record to error for coverTaskId: ${coverTaskId}`);
      } catch (dbError) {
        console.error('Failed to update cover generation error in database:', dbError);
      }
      
    } else if (code === 400) {
      // 重复请求：该音乐任务已生成过Cover
      console.log(`Cover already exists for coverTaskId: ${coverTaskId} - ${msg}`);
      
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
      
      // 查询对应的音乐生成taskId
      let musicTaskId = coverTaskId;
      try {
        const coverRecord = await query(
          'SELECT music_task_id FROM cover_generations WHERE task_id = $1',
          [coverTaskId]
        );
        if (coverRecord.rows.length > 0 && coverRecord.rows[0].music_task_id) {
          musicTaskId = coverRecord.rows[0].music_task_id;
        }
      } catch (error) {
        console.error('Failed to query music taskId for duplicate:', error);
      }
      
      // 发送重复请求通知到前端

      
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
      
      console.error(`Cover generation server error for coverTaskId: ${coverTaskId}`, msg);
      
      // 查询对应的音乐生成taskId
      let musicTaskId = coverTaskId;
      try {
        const coverRecord = await query(
          'SELECT music_task_id FROM cover_generations WHERE task_id = $1',
          [coverTaskId]
        );
        if (coverRecord.rows.length > 0 && coverRecord.rows[0].music_task_id) {
          musicTaskId = coverRecord.rows[0].music_task_id;
        }
      } catch (error) {
        console.error('Failed to query music taskId for error:', error);
      }
      
      // 发送错误通知到前端

      
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
      
      console.error(`Cover generation error for coverTaskId: ${coverTaskId}`, { code, msg });
    }
    
    // 清理过期结果
    cleanupExpiredResults();
    
  } catch (error) {
    console.error('Cover callback async processing error:', error);
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
    
    // 尝试通知前端错误
    try {
      const { searchParams } = new URL(request.url);
      const taskId = searchParams.get('taskId');
      
      if (taskId) {
        const errorContext: ErrorContext = {
          taskId,
          operation: 'get_cover_result',
          callbackType: 'cover'
        };
        
        const errorResult = handleError(error, errorContext);
        
        if (errorResult.shouldNotifyFrontend) {
          const errorNotification = createErrorNotification(errorContext, errorResult.error || 'Failed to get cover result');

        }
      }
    } catch (notificationError) {
      console.error('Failed to send error notification:', notificationError);
    }
    
    return NextResponse.json(
      { error: 'Failed to get cover result' },
      { status: 500 }
    );
  }
}
