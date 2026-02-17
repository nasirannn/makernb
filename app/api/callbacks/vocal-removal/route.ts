import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-query-builder';
import { addUserCredits } from '@/lib/user-db';
import { updateVocalRemovalByTaskId, getVocalRemovalByTaskId } from '@/features/vocal-tools/lib/vocal-removal-db';
import { getFeatureCredits } from '@/lib/credits-config';
import { downloadFromUrl, uploadAudioFile } from '@/lib/r2-storage';
import { handleKieApiErrorByCode, TaskTypeConfig } from '@/lib/kie-api-error-handler';

// 强制动态渲染
export const dynamic = 'force-dynamic';

type VocalSeparationType = 'separate_vocal' | 'split_stem';

// 幂等处理 - 避免重复处理同一回调
const processedVocalRemovalTasks = new Set<string>();

const getStringValue = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
};

const pickUrlFromObject = (obj: any, keys: string[]): string | undefined => {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const key of keys) {
    const value = getStringValue(obj[key]);
    if (value) return value;
  }
  return undefined;
};

const toStemKey = (rawKey: string): string => rawKey.replace(/_url$/i, '').trim();

const extractStemDataFromInfo = (info: any): Record<string, string> => {
  const result: Record<string, string> = {};
  if (!info || typeof info !== 'object') return result;

  Object.entries(info).forEach(([key, value]) => {
    const url = getStringValue(value);
    if (!url) return;
    if (!key.endsWith('_url')) return;
    if (key === 'origin_url') return;

    const stemKey = toStemKey(key);
    if (stemKey) {
      result[stemKey] = url;
    }
  });

  return result;
};

const parseSplitStemType = (stemData: Record<string, string>): VocalSeparationType => {
  const splitStemSpecificKeys = [
    'backing_vocals',
    'drums',
    'bass',
    'guitar',
    'keyboard',
    'percussion',
    'strings',
    'synth',
    'fx',
    'brass',
    'woodwinds',
  ];

  return splitStemSpecificKeys.some((key) => !!stemData[key]) ? 'split_stem' : 'separate_vocal';
};

const extractVocalRemovalData = (
  data: any,
  existingType?: VocalSeparationType
): {
  vocalUrl?: string;
  instrumentalUrl?: string;
  originUrl?: string;
  stemData: Record<string, string>;
  separationType: VocalSeparationType;
} => {
  const vocalRemovalInfo = data?.vocal_removal_info || data?.vocal_separation_info || data?.separation_info;
  const stemData = extractStemDataFromInfo(vocalRemovalInfo);

  const vocalUrl = pickUrlFromObject(vocalRemovalInfo, ['vocal_url', 'vocalUrl', 'vocals_url', 'vocalsUrl']) || stemData.vocal;
  let instrumentalUrl = pickUrlFromObject(vocalRemovalInfo, [
    'instrumental_url',
    'instrumentalUrl',
    'accompaniment_url',
    'accompanimentUrl',
    'music_url',
    'musicUrl',
  ]);
  if (!instrumentalUrl) {
    instrumentalUrl = stemData.instrumental || stemData.accompaniment;
  }
  const originUrl = pickUrlFromObject(vocalRemovalInfo, ['origin_url', 'originUrl']);

  const separationType =
    existingType === 'split_stem' || parseSplitStemType(stemData) === 'split_stem'
      ? 'split_stem'
      : 'separate_vocal';

  return { vocalUrl, instrumentalUrl, originUrl, stemData, separationType };
};

/**
 * 处理人声移除回调
 * 接收 KIE AI 的回调通知，更新人声移除状态和 URL
 */
export async function POST(request: NextRequest) {
  const callbackId = `vocal_removal_callback_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  try {
    // 1. 快速响应 - 必须在15秒内返回响应
    const callbackData = await request.json();
    console.log(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Received callback:`, JSON.stringify(callbackData, null, 2));

    const { code, msg, data } = callbackData;
    const taskId = data?.task_id;

    // 验证回调数据
    if (!taskId) {
      console.error(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Invalid callback data: missing task_id`);
      return NextResponse.json(
        { status: 'error', message: 'Missing task_id' },
        { status: 400 }
      );
    }

    // 幂等处理 - 避免重复处理同一回调
    const taskKey = `${taskId}_${code}`;
    if (processedVocalRemovalTasks.has(taskKey)) {
      console.log(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Task ${taskId} with code ${code} already processed, skipping duplicate`);
      return NextResponse.json({ status: 'received' });
    }

    // 标记为已处理
    processedVocalRemovalTasks.add(taskKey);

    // 快速响应，异步处理复杂逻辑
    const response = NextResponse.json({ status: 'received' });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 异步处理复杂逻辑
    setImmediate(() => {
      processVocalRemovalCallbackAsync(callbackData, callbackId);
    });

    return response;

  } catch (error) {
    console.error(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Callback processing error:`, error);

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
 * 异步处理人声移除回调的核心函数
 */
async function processVocalRemovalCallbackAsync(callbackData: any, callbackId: string) {
  try {
    const { code, msg, data } = callbackData;
    const taskId = data?.task_id;

    console.log(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Processing callback for taskId: ${taskId}, code: ${code}`);

    // 查询人声移除记录
    const removal = await getVocalRemovalByTaskId(taskId);

    if (!removal) {
      console.error(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Vocal removal record not found for taskId: ${taskId}`);
      return;
    }

    // 处理不同的状态码
    if (code === 200) {
      // 成功：更新 URL 和状态（兼容 separate_vocal / split_stem 回调结构）
      const { vocalUrl, instrumentalUrl, originUrl, stemData, separationType } = extractVocalRemovalData(
        data,
        removal.separation_type
      );

      console.log(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Success callback data:`, {
        taskId,
        separationType,
        vocalUrl,
        instrumentalUrl,
        stemKeys: Object.keys(stemData),
        originUrl,
        fullData: JSON.stringify(data, null, 2)
      });

      // split_stem 可能不存在可直接映射的 vocal/instrumental URL，允许空 URL 但任务仍记为 completed
      if (!vocalUrl && !instrumentalUrl) {
        console.warn(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] No direct vocal/instrumental URL found, marking task as completed`);
      }

      try {
        // 第一步：立即更新数据库记录（存储临时 URL）
        await updateVocalRemovalByTaskId(taskId, {
          status: 'completed',
          separation_type: separationType,
          vocal_url: vocalUrl || undefined,
          instrumental_url: instrumentalUrl || undefined,
          stems_data: Object.keys(stemData).length > 0 ? stemData : null
        });

        console.log(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Successfully updated vocal removal record for taskId: ${taskId}`);

        // 第二步：异步下载并上传到 R2（不阻塞回调响应）
        // 使用 setImmediate 确保回调已返回，然后再处理持久化
        if (vocalUrl || instrumentalUrl) {
          setImmediate(async () => {
            try {
              // 获取 track 信息用于生成文件名
              const trackResult = await query(
                `SELECT title FROM tracks WHERE id = $1::uuid`,
                [removal.track_id]
              );
              const trackTitle = trackResult.rows[0]?.title || 'vocal_removal';
              const timestamp = Date.now();

              // 上传 vocal 文件到 R2（如果存在）
              if (vocalUrl) {
                try {
                  const vocalBuffer = await downloadFromUrl(vocalUrl);
                  const vocalFilename = `${trackTitle.replace(/[^a-zA-Z0-9]/g, '_')}_vocal_${timestamp}.mp3`;
                  const vocalR2Url = await uploadAudioFile(vocalBuffer, taskId, vocalFilename, removal.user_id);
                  
                  await updateVocalRemovalByTaskId(taskId, {
                    r2_vocal_url: vocalR2Url
                  });
                  
                  console.log(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Successfully uploaded vocal file to R2: ${vocalR2Url}`);
                } catch (vocalR2Error) {
                  console.error(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Error uploading vocal file to R2:`, vocalR2Error);
                  // R2 上传失败不影响已保存的临时 URL，用户仍可下载
                }
              }

              // 上传 instrumental 文件到 R2（如果存在）
              if (instrumentalUrl) {
                try {
                  const instrumentalBuffer = await downloadFromUrl(instrumentalUrl);
                  const instrumentalFilename = `${trackTitle.replace(/[^a-zA-Z0-9]/g, '_')}_instrumental_${timestamp}.mp3`;
                  const instrumentalR2Url = await uploadAudioFile(instrumentalBuffer, taskId, instrumentalFilename, removal.user_id);
                  
                  await updateVocalRemovalByTaskId(taskId, {
                    r2_instrumental_url: instrumentalR2Url
                  });
                  
                  console.log(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Successfully uploaded instrumental file to R2: ${instrumentalR2Url}`);
                } catch (instrumentalR2Error) {
                  console.error(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Error uploading instrumental file to R2:`, instrumentalR2Error);
                  // R2 上传失败不影响已保存的临时 URL，用户仍可下载
                }
              }
            } catch (r2Error) {
              console.error(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Error during async R2 upload:`, r2Error);
              // R2 上传失败不影响已保存的临时 URL，用户仍可下载
            }
          });
        }

        // 扣除积分（任务成功即可扣除，不等待 R2 上传）
        try {
          const creditFeatureKey: 'split_stem_from_music_studio' | 'separate_vocals_from_music_studio' =
            separationType === 'split_stem'
              ? 'split_stem_from_music_studio'
              : 'separate_vocals_from_music_studio';
          const creditCost = getFeatureCredits(creditFeatureKey);
          const creditDescription = separationType === 'split_stem' ? 'Split stem' : 'Vocal removal';
          
          await addUserCredits(
            removal.user_id,
            -creditCost,
            creditDescription,
            taskId,
            creditFeatureKey
          );

          console.log(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Deducted ${creditCost} credits from user ${removal.user_id}`);
        } catch (creditError) {
          console.error(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Error deducting credits:`, creditError);
          // 积分扣除失败不影响任务完成的记录
        }

      } catch (error) {
        console.error(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Error processing vocal removal callback:`, error);
        // 如果处理失败，尝试更新状态为错误
        try {
          await updateVocalRemovalByTaskId(taskId, {
            status: 'error'
          });
        } catch (fallbackError) {
          console.error(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Failed to update status to error:`, fallbackError);
        }
      }

    } else if (code === 202) {
      // 202: 进行中，保持 processing 状态
      console.log(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Task ${taskId} is still processing`);
      
    } else if (code === 400) {
      // 400: 验证错误 - 歌词包含受版权保护的内容
      console.error(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Vocal removal validation error (400) for taskId: ${taskId}, msg: ${msg}`);
      await handleVocalRemovalError(code, msg, taskId, callbackId);

    } else if (code === 401) {
      // 401: 未授权 - 身份验证凭据缺失或无效
      console.error(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Vocal removal unauthorized (401) for taskId: ${taskId}, msg: ${msg}`);
      await handleVocalRemovalError(code, msg, taskId, callbackId);

    } else if (code === 402) {
      // 402: 积分不足 - 账户没有足够的积分执行此操作
      console.error(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Vocal removal insufficient credits (402) for taskId: ${taskId}, msg: ${msg}`);
      await handleVocalRemovalError(code, msg, taskId, callbackId);

    } else if (code === 404) {
      // 404: 未找到 - 请求的资源或端点不存在
      console.error(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Vocal removal not found (404) for taskId: ${taskId}, msg: ${msg}`);
      await handleVocalRemovalError(code, msg, taskId, callbackId);

    } else if (code === 408) {
      // 408: 超出限制 - 超时
      console.error(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Vocal removal timeout (408) for taskId: ${taskId}, msg: ${msg}`);
      await handleVocalRemovalError(code, msg, taskId, callbackId);

    } else if (code === 409) {
      // 409: 冲突 - 记录已存在
      console.error(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Vocal removal conflict (409) for taskId: ${taskId}, msg: ${msg}`);
      await handleVocalRemovalError(code, msg, taskId, callbackId);

    } else if (code === 413) {
      // 413: 冲突 - 上传的音频与现有艺术作品匹配
      console.error(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Vocal removal duplicate content (413) for taskId: ${taskId}, msg: ${msg}`);
      await handleVocalRemovalError(code, msg, taskId, callbackId);

    } else if (code === 422) {
      // 422: 验证错误 - 请求参数未通过验证检查
      console.error(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Vocal removal validation error (422) for taskId: ${taskId}, msg: ${msg}`);
      await handleVocalRemovalError(code, msg, taskId, callbackId);

    } else if (code === 429) {
      // 429: 超出限制 - 已超过对此资源的请求限制
      console.error(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Vocal removal rate limited (429) for taskId: ${taskId}, msg: ${msg}`);
      await handleVocalRemovalError(code, msg, taskId, callbackId);

    } else if (code === 451) {
      // 451: 未授权 - 获取图像失败
      console.error(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Vocal removal image access failed (451) for taskId: ${taskId}, msg: ${msg}`);
      await handleVocalRemovalError(code, msg, taskId, callbackId);

    } else if (code === 455) {
      // 455: 服务不可用 - 系统当前正在进行维护
      console.error(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Vocal removal service unavailable (455) for taskId: ${taskId}, msg: ${msg}`);
      await handleVocalRemovalError(code, msg, taskId, callbackId);

    } else if (code === 500 || code === 501) {
      // 500: 服务器错误 - 处理请求时发生意外错误
      // 501: 音频生成失败
      console.error(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Vocal removal failed (${code}) for taskId: ${taskId}, msg: ${msg}`);
      await handleVocalRemovalError(code, msg, taskId, callbackId);

    } else if (code === 531) {
      // 531: 服务器错误 - 抱歉，由于问题生成失败。您的积分已退还。请重试
      console.error(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Vocal removal failed with credit refund (531) for taskId: ${taskId}, msg: ${msg}`);
      await handleVocalRemovalError(code, msg, taskId, callbackId);

    } else {
      // 其他未知状态码
      console.warn(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Unexpected status code: ${code}, msg: ${msg}`);
      await handleVocalRemovalError(code, msg, taskId, callbackId);
    }

  } catch (error) {
    console.error(`[VOCAL-REMOVAL-CALLBACK-${callbackId}] Error processing vocal removal callback:`, error);
  }
}

/**
 * 处理人声移除错误的辅助函数
 */
async function handleVocalRemovalError(
  code: number,
  msg: string,
  taskId: string,
  callbackId: string
): Promise<void> {
  const removal = await getVocalRemovalByTaskId(taskId);
  const isSplitStem = removal?.separation_type === 'split_stem';
  const featureKey: 'split_stem_from_music_studio' | 'separate_vocals_from_music_studio' = isSplitStem
    ? 'split_stem_from_music_studio'
    : 'separate_vocals_from_music_studio';
  const descriptionKeywords = isSplitStem
    ? ['Split stem', 'Split Stem', 'split_stem']
    : ['Vocal removal', 'Vocal Removal', 'separate_vocals'];

  // 创建任务配置
  const taskConfig: TaskTypeConfig = {
    featureKey,
    descriptionKeywords,
    updateStatus: async (taskId: string, status: { status: string }) => {
      await updateVocalRemovalByTaskId(taskId, {
        status: status.status as 'error' | 'processing' | 'completed'
      });
    },
    getUserId: async () => removal?.user_id || null,
  };

  await handleKieApiErrorByCode(code, msg, taskId, callbackId, taskConfig);
}
