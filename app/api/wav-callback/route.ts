import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-query-builder';
import { updateTrackWavConversionByTaskId, getTrackWavConversionByTaskId } from '@/lib/track-wav-db';
import { downloadFromUrl, uploadWavFile } from '@/lib/r2-storage';
import { consumeUserCredit } from '@/lib/user-db';
import { getFeatureCredits } from '@/lib/credits-config';

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
  try {
    const { code, msg, data } = callbackData;
    const taskId = data?.task_id;

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
        await updateTrackWavConversionByTaskId(taskId, {
          status: 'error'
        });
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
          [conversion.track_id]
        );

        if (trackResult.rows.length === 0) {
          console.error(`[WAV-CALLBACK-${callbackId}] Track not found for trackId: ${conversion.track_id}`);
          // 仍保存原始URL，立即提供给前端使用
          await updateTrackWavConversionByTaskId(taskId, {
            wav_url: wavUrl,
            status: 'complete'
          });
          return;
        }

        const track = trackResult.rows[0];
        const userId = track.user_id || 'anonymous';
        const trackTitle = track.title || 'track';

        // 第一步：立即保存接口返回的临时 URL，并标记为完成状态
        // 这样前端可以立即下载，无需等待 R2 上传完成
        await updateTrackWavConversionByTaskId(taskId, {
          wav_url: wavUrl,
          status: 'complete'
        });

        // 第二步：异步下载并上传到 R2（不阻塞回调响应）
        // 使用 setImmediate 确保回调已返回，然后再处理持久化
        setImmediate(async () => {
          try {
            // 下载WAV文件并上传到R2
            const wavBuffer = await downloadFromUrl(wavUrl);

            // 生成文件名
            const timestamp = Date.now();
            const filename = `${trackTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.wav`;

            // 上传到R2
            const r2Url = await uploadWavFile(wavBuffer, taskId, filename, userId);

            // 更新数据库记录：保存 R2 URL 到 wav_r2_url 字段
            await updateTrackWavConversionByTaskId(taskId, {
              wav_r2_url: r2Url
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
            wav_url: wavUrl,
            status: 'complete'
          });
        } catch (fallbackError) {
          console.error(`[WAV-CALLBACK-${callbackId}] Failed to save fallback URL:`, fallbackError);
        }
      }

    } else if (code === 501) {
      // 失败：更新状态为错误
      console.error(`[WAV-CALLBACK-${callbackId}] WAV conversion failed for taskId: ${taskId}, msg: ${msg}`);
      
      await updateTrackWavConversionByTaskId(taskId, {
        status: 'error'
      });

    } else {
      // 其他错误状态码
      console.warn(`[WAV-CALLBACK-${callbackId}] Unexpected status code: ${code}, msg: ${msg}`);
      
      await updateTrackWavConversionByTaskId(taskId, {
        status: 'error'
      });
    }

  } catch (error) {
    console.error(`[WAV-CALLBACK-${callbackId}] Error processing WAV callback:`, error);
  }
}

