import { NextRequest, NextResponse } from 'next/server';
import { updateCoverGeneration } from '@/lib/cover-db';
import { query } from '@/lib/db-query-builder';
import { downloadFromUrl, uploadCoverImage } from '@/lib/r2-storage';

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
          console.log(`Found userId: ${finalUserId} from cover_generations using cover taskId: ${coverTaskId}`);
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
            
            // 查找对应的tracks记录
            const tracksQuery = await query(
              'SELECT id, side_letter FROM tracks WHERE music_id = (SELECT id FROM music WHERE task_id = $1) AND (is_deleted IS NULL OR is_deleted = FALSE) ORDER BY side_letter ASC',
              [musicTaskId]
            );
            
            if (tracksQuery.rows.length > 0) {
              console.log(`Found ${tracksQuery.rows.length} music tracks, updating cover_image_url directly`);
              
              // 直接更新tracks表的cover_image_url字段（更安全的方式）
              for (let i = 0; i < Math.min(tracksQuery.rows.length, data.images.length); i++) {
                await query(
                  `UPDATE tracks SET cover_image_url = $1, updated_at = NOW() 
                   WHERE id = $2 
                   AND cover_image_url IS NULL`,
                  [data.images[i], tracksQuery.rows[i].id] // 使用临时图片URL，前端立即可用
                );
              }
              
              console.log(`Successfully updated ${Math.min(tracksQuery.rows.length, data.images.length)} tracks with cover_image_url`);
              
              // 立即开始R2备份，不等待complete回调
              console.log(`Starting immediate R2 backup for cover images`);
              setImmediate(async () => {
                try {
                  console.log(`Starting async R2 backup for coverTaskId: ${coverTaskId}`);
                  
                  // 查询需要备份的tracks记录（使用临时URL的）
                  const backupQuery = await query(
                    `SELECT mt.id, mt.cover_image_url, cg.user_id
                     FROM tracks mt
                     JOIN music mg ON mt.music_id = mg.id
                     JOIN cover_generations cg ON mg.task_id = cg.music_task_id
                     WHERE cg.task_id = $1
                     AND mt.cover_image_url LIKE 'http%' 
                     AND mt.cover_image_url NOT LIKE '%makernb-assets.nasirann.com%'`,
                    [coverTaskId]
                  );
                  
                  if (backupQuery.rows.length > 0) {
                    console.log(`Found ${backupQuery.rows.length} cover images to backup to R2`);
                    
                    for (const track of backupQuery.rows) {
                      try {
                        console.log(`Starting backup for track: ${track.id}`);
                        
                        const imageBuffer = await downloadFromUrl(track.cover_image_url);
                        const filename = `cover_backup_${Date.now()}_${track.id}.jpeg`;
                        
                        const r2ImageUrl = await uploadCoverImage(
                          imageBuffer, 
                          coverTaskId, 
                          filename, 
                          track.user_id || 'anonymous'
                        );
                        
                        // 更新tracks记录，将临时URL替换为R2备份URL
                        await query(
                          'UPDATE tracks SET cover_image_url = $1 WHERE id = $2',
                          [r2ImageUrl, track.id]
                        );
                        
                        console.log(`Successfully backed up cover image for track ${track.id} to R2: ${r2ImageUrl}`);
                      } catch (imageError) {
                        console.error(`Failed to backup cover image for track ${track.id}:`, imageError);
                      }
                    }
                    
                    console.log(`Cover image backup process completed for coverTaskId: ${coverTaskId}`);
                  } else {
                    console.log(`No cover images found for backup in cover-callback`);
                  }
                } catch (backupError) {
                  console.error(`Error during cover image backup in cover-callback:`, backupError);
                }
              });
            } else {
              console.log(`No music tracks found for musicTaskId: ${musicTaskId}`);
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

            // 查询tracks数据，获取封面图片信息（使用新的cover_image_url字段）
            const tracksQuery = await query(
              `SELECT mt.id, mt.side_letter, mt.cover_image_url
               FROM tracks mt
               WHERE mt.music_id = (
                 SELECT id FROM music WHERE task_id = $1
               )
               AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
               ORDER BY mt.side_letter ASC`,
              [musicTaskId]
            );

            if (tracksQuery.rows.length > 0) {
              // 使用新的cover_image_url字段
              const coverImages = tracksQuery.rows.map(row => row.cover_image_url).filter(Boolean);

              // 构建封面更新信息
              const coverUpdateInfo = tracksQuery.rows.map((track: any, index: number) => ({
                trackIndex: index,
                coverImage: track.cover_image_url || null,
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
    
    // 记录错误日志
    console.error('Failed to get cover result:', error);
    
    return NextResponse.json(
      { error: 'Failed to get cover result' },
      { status: 500 }
    );
  }
}
