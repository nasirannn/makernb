/**
 * KIE API 通用错误处理工具
 * 
 * 统一处理 KIE API 回调中的错误状态码
 * 支持的错误码：401, 402, 404, 409, 422, 429, 451, 455, 500, 501
 * 
 * 根据 KIE API 文档：
 * - 200: 成功
 * - 401: 未授权 - 身份验证凭据缺失或无效
 * - 402: 积分不足 - 账户没有足够的积分执行此操作
 * - 404: 未找到 - 请求的资源或端点不存在
 * - 409: 冲突 - 记录已存在
 * - 422: 验证错误 - 请求参数未通过验证检查
 * - 429: 超出限制 - 已超过对此资源的请求限制
 * - 451: 未授权 - 获取图像失败
 * - 455: 服务不可用 - 系统当前正在进行维护
 * - 500: 服务器错误 - 处理请求时发生意外错误
 * - 501: 失败（旧版错误码，保留兼容性）
 */

import { query } from './db-query-builder';
import { addUserCredits } from './user-db';
import { getFeatureCredits } from './credits-config';

/**
 * 任务类型配置
 */
export interface TaskTypeConfig {
  /** 功能键（用于获取默认积分） */
  featureKey: string;
  /** 描述关键词（用于查找积分交易记录） */
  descriptionKeywords: string[];
  /** 更新状态函数 */
  updateStatus: (
    taskId: string,
    status: {
      status: string;
      errorCode?: number | string | null;
      errorMessage?: string | null;
    }
  ) => Promise<void>;
  /** 获取用户ID的函数 */
  getUserId: (taskId: string) => Promise<string | null>;
}

/**
 * 错误处理选项
 */
export interface ErrorHandlerOptions {
  /** 任务ID */
  taskId: string;
  /** 错误代码 */
  code: number;
  /** 错误消息 */
  msg: string;
  /** 回调ID（用于日志） */
  callbackId: string;
  /** 任务类型配置 */
  taskConfig: TaskTypeConfig;
  /** 是否应该回退积分（默认 true，402 错误通常为 false） */
  shouldRefund?: boolean;
  /** 自定义错误描述 */
  errorDescription?: string;
}

/**
 * 获取错误码的描述信息
 */
export function getErrorCodeDescription(code: number): string {
  const descriptions: Record<number, string> = {
    401: 'Unauthorized - authentication failed',
    402: 'Insufficient credits',
    404: 'Resource not found',
    409: 'Conflict - record already exists',
    422: 'Validation error',
    429: 'Rate limit exceeded',
    451: 'Image access failed - unauthorized',
    455: 'Service unavailable - maintenance',
    500: 'Server error',
    501: 'Conversion failed',
  };

  return descriptions[code] || `Unexpected error (${code})`;
}

/**
 * 判断错误码是否应该回退积分
 * 402 错误通常发生在请求时，可能没有扣除积分，所以不需要回退
 */
export function shouldRefundForErrorCode(code: number): boolean {
  // 402 错误通常不需要回退（可能没有扣除积分）
  if (code === 402) {
    return false;
  }
  // 其他错误都应该回退（如果已扣除积分）
  return true;
}

/**
 * 通用的 KIE API 错误处理函数
 * 
 * @param options 错误处理选项
 */
export async function handleKieApiError(options: ErrorHandlerOptions): Promise<void> {
  const {
    taskId,
    code,
    msg,
    callbackId,
    taskConfig,
    shouldRefund: shouldRefundOverride,
    errorDescription,
  } = options;

  try {
    // 更新状态为错误
    await taskConfig.updateStatus(taskId, {
      status: 'error',
      errorCode: code,
      errorMessage: msg || getErrorCodeDescription(code),
    });

    // 判断是否需要回退积分
    const shouldRefund = shouldRefundOverride !== undefined 
      ? shouldRefundOverride 
      : shouldRefundForErrorCode(code);

    // 如果需要回退积分，查找并回退
    if (shouldRefund) {
      try {
        // 获取用户ID
        const userId = await taskConfig.getUserId(taskId);

        if (!userId) {
          console.warn(`[KIE-ERROR-${callbackId}] User ID not found for taskId ${taskId}, cannot refund credits`);
          return;
        }

        // 从 credit_transactions 表中查找该 taskId 的积分消耗记录
        // 注意：consumeUserCredit 使用 transaction_type = 'spend'，所以通过 reference_id 和 description 来查找
        const descriptionConditions = taskConfig.descriptionKeywords
          .map((_keyword, index) => `description LIKE $${index + 2}`)
          .join(' OR ');

        const queryParams = [taskId, ...taskConfig.descriptionKeywords.map(k => `%${k}%`)];

        const creditTransactionResult = await query(
          `SELECT amount FROM credit_transactions 
           WHERE reference_id = $1 
           AND transaction_type = 'spend'
           AND (${descriptionConditions})
           ORDER BY created_at DESC LIMIT 1`,
          queryParams
        );

        // 优先从数据库获取已扣除的积分（最准确）
        let creditCost = getFeatureCredits(taskConfig.featureKey as any);
        if (creditTransactionResult.rows.length > 0) {
          // 消费记录是负数，退款应该是正数
          creditCost = Math.abs(creditTransactionResult.rows[0].amount);
        } else {
          console.warn(`[KIE-ERROR-${callbackId}] No credit transaction found for taskId ${taskId}, using default: ${creditCost} credits`);
        }

        // 回退积分
        const errorDesc = errorDescription || getErrorCodeDescription(code);
        const refundSuccess = await addUserCredits(
          userId,
          creditCost,
          `${taskConfig.featureKey} failed - refund (${errorDesc}: ${msg || 'API error'})`,
          taskId,
          'refund'
        );

        if (refundSuccess) {
          console.log(`[KIE-ERROR-${callbackId}] Successfully refunded ${creditCost} credits for failed task ${taskId}`);
        } else {
          console.error(`[KIE-ERROR-${callbackId}] Failed to refund credits for failed task: ${taskId}`);
        }
      } catch (refundError) {
        console.error(`[KIE-ERROR-${callbackId}] Error refunding credits for failed task:`, refundError);
        // 不抛出错误，避免影响错误状态的更新
      }
    } else {
      console.log(`[KIE-ERROR-${callbackId}] Skipping credit refund for error code ${code} (shouldRefund=false)`);
    }
  } catch (error) {
    console.error(`[KIE-ERROR-${callbackId}] Error handling KIE API error:`, error);
    // 即使处理失败，也尝试更新状态
    try {
      await taskConfig.updateStatus(taskId, {
        status: 'error'
      });
    } catch (statusError) {
      console.error(`[KIE-ERROR-${callbackId}] Failed to update status to error:`, statusError);
    }
  }
}

/**
 * 处理所有标准错误码的辅助函数
 * 根据错误码自动调用 handleKieApiError
 * 
 * @param code 错误代码
 * @param msg 错误消息
 * @param taskId 任务ID
 * @param callbackId 回调ID
 * @param taskConfig 任务类型配置
 */
export async function handleKieApiErrorByCode(
  code: number,
  msg: string,
  taskId: string,
  callbackId: string,
  taskConfig: TaskTypeConfig
): Promise<void> {
  const errorDescription = getErrorCodeDescription(code);
  const shouldRefund = shouldRefundForErrorCode(code);

  await handleKieApiError({
    taskId,
    code,
    msg,
    callbackId,
    taskConfig,
    shouldRefund,
    errorDescription,
  });
}
