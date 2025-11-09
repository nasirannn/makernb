import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-query-builder';
import { updateTrackWavConversionByTaskId, getTrackWavConversionByTaskId } from '@/lib/track-wav-db';
import { downloadFromUrl, uploadWavFile, findWavFileByTaskId } from '@/lib/r2-storage';
import { consumeUserCredit, addUserCredits } from '@/lib/user-db';
import { getFeatureCredits } from '@/lib/credits-config';
import { handleKieApiErrorByCode, TaskTypeConfig } from '@/lib/kie-api-error-handler';

// 强制动态渲染
export const dynamic = 'force-dynamic';

// 幂等处理 - 避免重复处理同一回调
const processedWavTasks = new Set<string>();

/**
 * 处理 WAV 转换回调
 * 接收 KIE AI 的回调通知，更新 WAV 转换状态和 URL
 */
export async function POST(request: NextRequest) {
  const callbackId = `wav_callback_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  try {
    // 1. 快速响应 - 必须在15秒内返回响应
    const callbackData = await request.json();
    const { code, msg, data } = callbackData;
    const taskId = data?.task_id;

    // 验证回调数据
    if (!taskId) {
      console.error(`[WAV-CALLBACK-${callbackId}] Invalid callback data: missing task_id`);
      return NextResponse.json(
        { status: 'error', message: 'Missing task_id' },
        { status: 400 }
      );
    }

    // 幂等处理 - 避免重复处理同一回调
    const taskKey = `${taskId}_${code}`;
    if (processedWavTasks.has(taskKey)) {
      return NextResponse.json({ status: 'received' });
    }

    // 标记为已处理
    processedWavTasks.add(taskKey);

    // 快速响应，异步处理复杂逻辑
    const response = NextResponse.json({ status: 'received' });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 异步处理复杂逻辑
    setImmediate(() => {
      processWavCallbackAsync(callbackData, callbackId);
    });

    return response;

  } catch (error) {
    console.error(`[WAV-CALLBACK-${callbackId}] Callback processing error:`, error);

    // 返回简单错误响应
    const errorResponse = NextResponse.json({ status: 'error' }, { status: 500 });
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    errorResponse.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return errorResponse;
  }
}

// 添加 OPTIONS 方法支持 CORS 预检请求
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

/**
 * 异步处理 WAV 转换回调的核心函数
 */
async function processWavCallbackAsync(callbackData: any, callbackId: string) {
  let taskId: string | undefined;
  try {
    const { code, msg, data } = callbackData;
    taskId = data?.task_id;

    // 验证 taskId 是否存在
    if (!taskId) {
      console.error(`[WAV-CALLBACK-${callbackId}] Missing task_id in callback data`);
      return;
    }

    // 查询 WAV 转换记录
    const conversion = await getTrackWavConversionByTaskId(taskId);

    if (!conversion) {
      console.error(`[WAV-CALLBACK-${callbackId}] WAV conversion record not found for taskId: ${taskId}`);
      return;
    }

    // 处理不同的状态码
    if (code === 200) {
      // 成功：更新 WAV URL 和状态
      const wavUrl = data?.audio_wav_url;

      if (!wavUrl) {
        console.error(`[WAV-CALLBACK-${callbackId}] Missing audio_wav_url in success callback`);
        try {
          await updateTrackWavConversionByTaskId(taskId, {
            status: 'error'
          });
        } catch (statusError) {
          console.error(`[WAV-CALLBACK-${callbackId}] Failed to update status to error:`, statusError);
        }
        return;
      }

      try {
        // 获取track信息以获取user_id
        const trackResult = await query(
          `SELECT 
            mt.id as track_id,
            mg.user_id,
            COALESCE(mt.title, mg.title) as title
          FROM tracks mt
          INNER JOIN music mg ON mt.music_id = mg.id
          WHERE mt.id = $1::uuid
            AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)`,
          [conversion.trackId || (conversion as any).track_id]
        );

        if (trackResult.rows.length === 0) {
          console.error(`[WAV-CALLBACK-${callbackId}] Track not found for trackId: ${conversion.trackId || (conversion as any).track_id}`);
          // 仍保存原始URL，立即提供给前端使用
          await updateTrackWavConversionByTaskId(taskId, {
            wavUrl: wavUrl,
            status: 'completed'
          });
          return;
        }

        const track = trackResult.rows[0];
        const userId = track.user_id || 'anonymous';
        const trackTitle = track.title || 'track';

        // 第一步：立即保存接口返回的临时 URL，并标记为完成状态
        // 这样前端可以立即下载，无需等待 R2 上传完成
        await updateTrackWavConversionByTaskId(taskId, {
          wavUrl: wavUrl,
          status: 'completed'
        });

        // 第二步：异步下载并上传到 R2（不阻塞回调响应）
        // 使用 setImmediate 确保回调已返回，然后再处理持久化
        // 保存 taskId 到常量，确保闭包中的类型安全
        const finalTaskId = taskId;
        setImmediate(async () => {
          try {
            // 下载WAV文件并上传到R2
            const wavBuffer = await downloadFromUrl(wavUrl);

            // 生成文件名
            const timestamp = Date.now();
            const filename = `${trackTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.wav`;

            // 上传到R2
            const r2Url = await uploadWavFile(wavBuffer, finalTaskId, filename, userId);

            // 更新数据库记录：保存 R2 URL 到 wav_r2_url 字段
            await updateTrackWavConversionByTaskId(finalTaskId, {
              wavR2Url: r2Url
            });
          } catch (r2Error) {
            console.error(`[WAV-CALLBACK-${callbackId}] Error during async R2 upload:`, r2Error);
            // R2 上传失败不影响已保存的临时 URL，用户仍可下载
          }
        });

        // 扣除积分（WAV转换成功即可扣除，不等待R2上传）
        try {
          const wavCreditCost = getFeatureCredits('convert_to_wav');
          
          const creditConsumed = await consumeUserCredit(
            userId,
            wavCreditCost,
            'Convert to WAV Format',
            taskId,
            'wav_conversion'
          );

          if (!creditConsumed) {
            console.warn(`[WAV-CALLBACK-${callbackId}] Failed to deduct credits for WAV conversion task ${taskId} - insufficient credits`);
          }
        } catch (error) {
          console.error(`[WAV-CALLBACK-${callbackId}] Error deducting credits for WAV conversion:`, error);
          // 积分扣除失败不影响WAV转换完成的记录
        }

      } catch (error) {
        console.error(`[WAV-CALLBACK-${callbackId}] Error processing WAV callback:`, error);
        // 如果处理失败，仍尝试保存原始URL（KIE的临时URL）
        try {
          await updateTrackWavConversionByTaskId(taskId, {
            wavUrl: wavUrl,
            status: 'completed'
          });
        } catch (fallbackError) {
          console.error(`[WAV-CALLBACK-${callbackId}] Failed to save fallback URL:`, fallbackError);
          // 如果 fallback 也失败，更新状态为 error
          try {
            await updateTrackWavConversionByTaskId(taskId, {
              status: 'error'
            });
          } catch (statusError) {
            console.error(`[WAV-CALLBACK-${callbackId}] Failed to update status to error:`, statusError);
          }
        }
      }

    } else if (code === 409) {
      // 409: 任务已存在，检查数据库中是否有 wav_url，如果有则检查 R2 中是否存在文件
      console.log(`[WAV-CALLBACK-${callbackId}] Received 409 for taskId: ${taskId}, checking existing wav_url and R2 file`);
      
      try {
        // 检查 conversion 记录中的 wav_url 是否为空
        if (!conversion.wavUrl) {
          console.log(`[WAV-CALLBACK-${callbackId}] wav_url is empty for taskId: ${taskId}, cannot process 409`);
          // 如果没有 wav_url，无法处理，更新状态为错误
          await updateTrackWavConversionByTaskId(taskId, {
            status: 'error'
          });
          return;
        }

        // 获取 track 信息以获取 user_id
        const trackResult = await query(
          `SELECT 
            mt.id as track_id,
            mg.user_id,
            COALESCE(mt.title, mg.title) as title
          FROM tracks mt
          INNER JOIN music mg ON mt.music_id = mg.id
          WHERE mt.id = $1::uuid
            AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)`,
          [conversion.trackId || (conversion as any).track_id]
        );

        if (trackResult.rows.length === 0) {
          console.error(`[WAV-CALLBACK-${callbackId}] Track not found for trackId: ${conversion.trackId || (conversion as any).track_id}`);
          await updateTrackWavConversionByTaskId(taskId, {
            status: 'error'
          });
          return;
        }

        const track = trackResult.rows[0];
        const userId = track.user_id || 'anonymous';
        const trackTitle = track.title || 'track';

        // 检查 R2 中是否存在对应的文件
        const existingFile = await findWavFileByTaskId(taskId, userId);

        if (existingFile) {
          // 文件已存在，获取 URL 并更新数据库
          console.log(`[WAV-CALLBACK-${callbackId}] Found existing R2 file for taskId: ${taskId}, URL: ${existingFile.url}`);
          await updateTrackWavConversionByTaskId(taskId, {
            wavR2Url: existingFile.url,
            status: 'completed'
          });
        } else {
          // 文件不存在，下载并上传到 R2
          console.log(`[WAV-CALLBACK-${callbackId}] R2 file not found for taskId: ${taskId}, downloading and uploading to R2`);
          
          try {
            // 下载 WAV 文件
            const wavBuffer = await downloadFromUrl(conversion.wavUrl);

            // 生成文件名
            const timestamp = Date.now();
            const filename = `${trackTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.wav`;

            // 上传到 R2
            const r2Url = await uploadWavFile(wavBuffer, taskId, filename, userId);

            // 更新数据库记录
            await updateTrackWavConversionByTaskId(taskId, {
              wavR2Url: r2Url,
              status: 'completed'
            });
            
            console.log(`[WAV-CALLBACK-${callbackId}] Successfully uploaded to R2 and updated database for taskId: ${taskId}`);
          } catch (uploadError) {
            console.error(`[WAV-CALLBACK-${callbackId}] Error downloading/uploading WAV file for taskId: ${taskId}:`, uploadError);
            // 上传失败不影响已有的 wav_url，但状态保持为 generating 或更新为 error
            try {
              await updateTrackWavConversionByTaskId(taskId, {
                status: 'error'
              });
            } catch (statusError) {
              console.error(`[WAV-CALLBACK-${callbackId}] Failed to update status to error:`, statusError);
            }
          }
        }
      } catch (error) {
        console.error(`[WAV-CALLBACK-${callbackId}] Error processing 409 callback for taskId: ${taskId}:`, error);
        // 发生错误时，尝试更新状态为 error
        try {
          await updateTrackWavConversionByTaskId(taskId, {
            status: 'error'
          });
        } catch (statusError) {
          console.error(`[WAV-CALLBACK-${callbackId}] Failed to update status to error:`, statusError);
        }
      }

    } else if (code === 401) {
      // 401: 未授权 - 身份验证凭据缺失或无效
      console.error(`[WAV-CALLBACK-${callbackId}] WAV conversion unauthorized (401) for taskId: ${taskId}, msg: ${msg}`);
      await handleWavConversionError(code, msg, taskId, callbackId);

    } else if (code === 402) {
      // 402: 积分不足 - 账户没有足够的积分执行此操作
      // 注意：402 通常发生在请求时，如果回调收到 402，说明可能是后续验证失败
      // 这种情况下可能没有扣除积分，所以不需要回退
      console.error(`[WAV-CALLBACK-${callbackId}] WAV conversion insufficient credits (402) for taskId: ${taskId}, msg: ${msg}`);
      await handleWavConversionError(code, msg, taskId, callbackId);

    } else if (code === 404) {
      // 404: 未找到 - 请求的资源或端点不存在
      console.error(`[WAV-CALLBACK-${callbackId}] WAV conversion not found (404) for taskId: ${taskId}, msg: ${msg}`);
      await handleWavConversionError(code, msg, taskId, callbackId);

    } else if (code === 422) {
      // 422: 验证错误 - 请求参数未通过验证检查
      console.error(`[WAV-CALLBACK-${callbackId}] WAV conversion validation error (422) for taskId: ${taskId}, msg: ${msg}`);
      await handleWavConversionError(code, msg, taskId, callbackId);

    } else if (code === 429) {
      // 429: 超出限制 - 已超过对此资源的请求限制
      console.error(`[WAV-CALLBACK-${callbackId}] WAV conversion rate limited (429) for taskId: ${taskId}, msg: ${msg}`);
      await handleWavConversionError(code, msg, taskId, callbackId);

    } else if (code === 451) {
      // 451: 未授权 - 获取图像失败。请验证您或您的服务提供商设置的任何访问限制。
      console.error(`[WAV-CALLBACK-${callbackId}] WAV conversion image access failed (451) for taskId: ${taskId}, msg: ${msg}`);
      await handleWavConversionError(code, msg, taskId, callbackId);

    } else if (code === 455) {
      // 455: 服务不可用 - 系统当前正在进行维护
      console.error(`[WAV-CALLBACK-${callbackId}] WAV conversion service unavailable (455) for taskId: ${taskId}, msg: ${msg}`);
      await handleWavConversionError(code, msg, taskId, callbackId);

    } else if (code === 500) {
      // 500: 服务器错误 - 处理请求时发生意外错误
      console.error(`[WAV-CALLBACK-${callbackId}] WAV conversion server error (500) for taskId: ${taskId}, msg: ${msg}`);
      await handleWavConversionError(code, msg, taskId, callbackId);

    } else if (code === 501) {
      // 501: 失败（旧版错误码，保留兼容性）
      console.error(`[WAV-CALLBACK-${callbackId}] WAV conversion failed (501) for taskId: ${taskId}, msg: ${msg}`);
      await handleWavConversionError(code, msg, taskId, callbackId);

    } else {
      // 其他未知错误状态码
      console.warn(`[WAV-CALLBACK-${callbackId}] Unexpected status code: ${code}, msg: ${msg}`);
      await handleWavConversionError(code, msg, taskId, callbackId);
    }

  } catch (error) {
    console.error(`[WAV-CALLBACK-${callbackId}] Error processing WAV callback:`, error);
    // 最外层错误处理：尝试更新状态为 error
    try {
      // 如果 taskId 在函数开始时已获取，使用它；否则尝试从 callbackData 中获取
      const finalTaskId = taskId || callbackData?.data?.task_id;
      if (finalTaskId) {
        await updateTrackWavConversionByTaskId(finalTaskId, {
          status: 'error'
        });
      }
    } catch (statusError) {
      console.error(`[WAV-CALLBACK-${callbackId}] Failed to update status to error in outer catch:`, statusError);
    }
  }
}

/**
 * 处理 WAV 转换错误的辅助函数
 * 使用通用的 KIE API 错误处理函数
 */
async function handleWavConversionError(
  code: number,
  msg: string,
  taskId: string,
  callbackId: string
): Promise<void> {
  // 创建任务配置
  const taskConfig: TaskTypeConfig = {
    featureKey: 'convert_to_wav',
    descriptionKeywords: ['WAV', 'Convert to WAV', 'WAV conversion'],
    updateStatus: async (taskId: string, status: { status: string }) => {
      await updateTrackWavConversionByTaskId(taskId, {
        status: status.status as 'error' | 'generating' | 'completed' | 'expired'
      });
    },
    getUserId: async (taskId: string) => {
      // 获取 track 信息以获取 user_id
      const conversion = await getTrackWavConversionByTaskId(taskId);
      if (!conversion) {
        return null;
      }

      const trackResult = await query(
        `SELECT 
          mt.id as track_id,
          mg.user_id
        FROM tracks mt
        INNER JOIN music mg ON mt.music_id = mg.id
        WHERE mt.id = $1::uuid
          AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)`,
        [conversion.trackId || (conversion as any).track_id]
      );

      if (trackResult.rows.length > 0) {
        return trackResult.rows[0].user_id;
      }

      return null;
    },
  };

  await handleKieApiErrorByCode(code, msg, taskId, callbackId, taskConfig);
}

