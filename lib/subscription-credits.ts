import { query, withTransaction } from './db-query-builder';
import type { QueryResultRow } from 'pg';
import { addUserCredits } from './user-db';

export interface SubscriptionPlanRow {
  code: string;
  name: string;
  product_id: string;
  mode: 'test' | 'prod' | 'sandbox' | 'local';
  credits_per_period: number;
  billing_period: 'monthly' | 'yearly';
  price: number;
  tier_code: string;
  is_active: boolean;
}

type QueryFn = <T extends QueryResultRow = any>(sql: string, params?: any[]) => Promise<{ rows: T[] }>;

const LEGACY_PLAN_ID_MAP: Record<string, string> = {
  monthly_basic: 'monthly_starter',
  monthly_premium: 'monthly_hobby',
  yearly_basic: 'yearly_starter',
  yearly_premium: 'yearly_hobby',
};

const normalizePlanId = (planId: string): string => {
  return LEGACY_PLAN_ID_MAP[planId] || planId;
};

export const getSubscriptionPlanByProductId = async (
  productId: string,
  mode: SubscriptionPlanRow["mode"],
  queryFn: QueryFn = query
): Promise<SubscriptionPlanRow | null> => {
  const result = await queryFn<SubscriptionPlanRow>(
    `SELECT code, name, product_id, mode, credits_per_period, billing_period, price, tier_code, is_active
     FROM subscription_plans
     WHERE product_id = $1 AND mode = $2
     LIMIT 1`,
    [productId, mode]
  );

  return result.rows[0] || null;
};

export const getSubscriptionPlanByCode = async (
  planCode: string,
  mode: SubscriptionPlanRow["mode"],
  queryFn: QueryFn = query
): Promise<SubscriptionPlanRow | null> => {
  const result = await queryFn<SubscriptionPlanRow>(
    `SELECT code, name, product_id, mode, credits_per_period, billing_period, price, tier_code, is_active
     FROM subscription_plans
     WHERE code = $1 AND mode = $2
     LIMIT 1`,
    [planCode, mode]
  );

  return result.rows[0] || null;
};

export const getSubscriptionPlanByProductIdAnyMode = async (
  productId: string,
  queryFn: QueryFn = query
): Promise<SubscriptionPlanRow | null> => {
  const result = await queryFn<SubscriptionPlanRow>(
    `SELECT code, name, product_id, mode, credits_per_period, billing_period, price, tier_code, is_active
     FROM subscription_plans
     WHERE product_id = $1
     LIMIT 1`,
    [productId]
  );

  return result.rows[0] || null;
};

export interface UserSubscription {
  id: string;
  user_id: string;
  subscription_id: string;
  customer_id?: string | null;
  product_id: string;
  plan_id: string;
  tier_id?: string;  // 外键关联到 subscription_tiers 表
  status: 'active' | 'cancelled' | 'expired' | 'past_due';
  current_period_start: string;
  current_period_end: string;
  next_credit_grant_date: string;
  credits_per_period: number;
  cancel_at_period_end?: boolean;
  cancel_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 创建或更新用户订阅记录
 */
export const createOrUpdateUserSubscription = async (
  userId: string,
  subscriptionData: {
    subscriptionId: string;
    customerId?: string | null;
    productId: string;
    mode: SubscriptionPlanRow["mode"];
    status: 'active' | 'cancelled' | 'expired' | 'past_due';
    currentPeriodStart: string;
    currentPeriodEnd: string;
  }
): Promise<UserSubscription> => {
  try {
    // 查找对应的订阅计划
    const plan = await getSubscriptionPlanByProductId(subscriptionData.productId, subscriptionData.mode);
    if (!plan) {
      throw new Error(`Unknown product ID: ${subscriptionData.productId} (${subscriptionData.mode})`);
    }
    if (!plan.is_active) {
      console.warn(`Subscription plan is inactive: ${plan.code}`);
    }

    // 计算下次积分发放日期
    const nextCreditGrantDate = new Date(subscriptionData.currentPeriodEnd);
    nextCreditGrantDate.setDate(nextCreditGrantDate.getDate() + 1); // 订阅期结束后第二天发放

    // 根据 plan_id 确定 tier_code，然后查询对应的 tier_id
    // monthly_starter / yearly_starter → starter
    // monthly_hobby / yearly_hobby → hobby
    const tierCode = plan.tier_code || (plan.code.includes("hobby") || plan.code.includes("premium") ? "hobby" : "starter");
    
    return await withTransaction(async (queryFn) => {
      // 查询 tier_id
      let tierResult = await queryFn('SELECT id FROM subscription_tiers WHERE code = $1', [tierCode]);

      // Backward compatibility: old DB codes (basic/premium)
      if (tierResult.rows.length === 0) {
        const legacyTierCode = plan.code.includes("hobby") || plan.code.includes("premium") ? "premium" : "basic";
        tierResult = await queryFn('SELECT id FROM subscription_tiers WHERE code = $1', [legacyTierCode]);
      }
      
      if (tierResult.rows.length === 0) {
        throw new Error(`Subscription tier not found for plan '${plan.code}'`);
      }
      
      const tierId = tierResult.rows[0].id;

      // 检查是否已存在订阅记录
      const existingSubscription = await queryFn(
        'SELECT * FROM user_subscriptions WHERE user_id = $1::uuid AND subscription_id = $2',
        [userId, subscriptionData.subscriptionId]
      );

      if (existingSubscription.rows.length > 0) {
        // 更新现有订阅（同时更新 tier_id）
        const result = await queryFn(
          `UPDATE user_subscriptions SET
            status = $1,
            current_period_start = $2,
            current_period_end = $3,
            next_credit_grant_date = $4,
            tier_id = $5,
            product_id = $6,
            plan_id = $7,
            credits_per_period = $8,
            customer_id = COALESCE($9, customer_id),
            cancel_at_period_end = FALSE,
            cancel_at = NULL,
            cancelled_at = NULL,
            updated_at = NOW()
          WHERE user_id = $10::uuid AND subscription_id = $11
          RETURNING *`,
          [
            subscriptionData.status,
            subscriptionData.currentPeriodStart,
            subscriptionData.currentPeriodEnd,
            nextCreditGrantDate.toISOString(),
            tierId,
            subscriptionData.productId,
            plan.code,
            plan.credits_per_period,
            subscriptionData.customerId || null,
            userId,
            subscriptionData.subscriptionId
          ]
        );
        return result.rows[0];
      } else {
        // 创建新订阅记录（包含 tier_id）
        const result = await queryFn(
          `INSERT INTO user_subscriptions (
            user_id, subscription_id, customer_id, product_id, plan_id, tier_id, status,
            current_period_start, current_period_end, next_credit_grant_date,
            credits_per_period, cancel_at_period_end, cancel_at, cancelled_at,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, FALSE, NULL, NULL, NOW(), NOW())
          RETURNING *`,
          [
            userId,
            subscriptionData.subscriptionId,
            subscriptionData.customerId || null,
            subscriptionData.productId,
            plan.code,
            tierId,
            subscriptionData.status,
            subscriptionData.currentPeriodStart,
            subscriptionData.currentPeriodEnd,
            nextCreditGrantDate.toISOString(),
            plan.credits_per_period
          ]
        );
        return result.rows[0];
      }
    });
  } catch (error) {
    console.error('Error creating/updating user subscription:', error);
    throw error;
  }
};

/**
 * 获取需要发放积分的活跃订阅用户
 */
export const getActiveSubscriptionsForCreditGrant = async (): Promise<UserSubscription[]> => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    const result = await query(
      `SELECT * FROM user_subscriptions 
       WHERE status = 'active' 
       AND (cancel_at_period_end IS NULL OR cancel_at_period_end = FALSE)
       AND next_credit_grant_date <= $1
       ORDER BY next_credit_grant_date ASC`,
      [today]
    );

    return result.rows;
  } catch (error) {
    console.error('Error getting active subscriptions for credit grant:', error);
    throw error;
  }
};

/**
 * 标记订阅在周期结束后取消
 */
export const scheduleSubscriptionCancellation = async (
  userId: string,
  subscriptionId: string,
  cancelAt?: string | null
): Promise<UserSubscription | null> => {
  try {
    const result = await query(
      `UPDATE user_subscriptions SET
        cancel_at_period_end = TRUE,
        cancel_at = COALESCE($3, current_period_end),
        current_period_end = COALESCE($3, current_period_end),
        updated_at = NOW()
      WHERE user_id = $1::uuid AND subscription_id = $2 AND status = 'active'
      RETURNING *`,
      [userId, subscriptionId, cancelAt || null]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error scheduling subscription cancellation:', error);
    throw error;
  }
};

/**
 * 到期取消订阅（在周期结束后生效）
 */
export const expireCancelledSubscriptions = async (asOf: Date = new Date()): Promise<UserSubscription[]> => {
  try {
    const result = await query(
      `UPDATE user_subscriptions SET
        status = 'cancelled',
        cancelled_at = NOW(),
        updated_at = NOW()
      WHERE status = 'active'
        AND cancel_at_period_end = TRUE
        AND current_period_end <= $1
      RETURNING *`,
      [asOf.toISOString()]
    );

    return result.rows;
  } catch (error) {
    console.error('Error expiring cancelled subscriptions:', error);
    throw error;
  }
};

/**
 * 给订阅用户发放积分
 */
export const grantSubscriptionCredits = async (subscription: UserSubscription): Promise<boolean> => {
  try {
    return await withTransaction(async (queryFn) => {
      // 发放积分
      const success = await addUserCredits(
        subscription.user_id,
        subscription.credits_per_period,
        `Subscription credits - ${subscription.plan_id}`,
        `subscription_${subscription.subscription_id}_${Date.now()}`,
        'subscription_credit'
      );

      if (!success) {
        throw new Error('Failed to add credits');
      }

      // 更新下次发放日期
      const nextGrantDate = new Date(subscription.next_credit_grant_date);
      
      // 根据订阅类型计算下次发放日期
      const plan = await getSubscriptionPlanByProductIdAnyMode(
        subscription.product_id,
        queryFn
      );
      if (plan) {
        if (plan.billing_period === 'monthly') {
          nextGrantDate.setMonth(nextGrantDate.getMonth() + 1);
        } else if (plan.billing_period === 'yearly') {
          nextGrantDate.setFullYear(nextGrantDate.getFullYear() + 1);
        }
      } else {
        throw new Error(`Unknown subscription plan: ${subscription.plan_id}`);
      }

      await queryFn(
        `UPDATE user_subscriptions SET
          next_credit_grant_date = $1,
          updated_at = NOW()
        WHERE id = $2`,
        [nextGrantDate.toISOString(), subscription.id]
      );

      console.log(`Granted ${subscription.credits_per_period} credits to user ${subscription.user_id} for subscription ${subscription.subscription_id}`);
      return true;
    });
  } catch (error) {
    console.error('Error granting subscription credits:', error);
    throw error;
  }
};

/**
 * 处理所有到期的订阅积分发放
 */
export const processSubscriptionCreditGrants = async (): Promise<{
  processedCount: number;
  successCount: number;
  errorCount: number;
  errors: string[];
}> => {
  const startTime = Date.now();
  console.log(`[SUBSCRIPTION-CREDITS] Starting subscription credit grant process at ${new Date().toISOString()}`);

  try {
    const expired = await expireCancelledSubscriptions();
    if (expired.length > 0) {
      console.log(`[SUBSCRIPTION-CREDITS] Expired ${expired.length} cancelled subscriptions`);
    }

    const subscriptions = await getActiveSubscriptionsForCreditGrant();
    console.log(`[SUBSCRIPTION-CREDITS] Found ${subscriptions.length} subscriptions eligible for credit grant`);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const subscription of subscriptions) {
      try {
        await grantSubscriptionCredits(subscription);
        successCount++;
      } catch (error) {
        errorCount++;
        const errorMessage = `Failed to grant credits for subscription ${subscription.subscription_id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMessage);
        console.error(`[SUBSCRIPTION-CREDITS] ${errorMessage}`);
      }
    }

    const duration = Date.now() - startTime;
    const message = `Processed ${subscriptions.length} subscriptions: ${successCount} successful, ${errorCount} failed in ${duration}ms`;
    
    console.log(`[SUBSCRIPTION-CREDITS] ${message}`);
    
    return {
      processedCount: subscriptions.length,
      successCount,
      errorCount,
      errors
    };
  } catch (error) {
    console.error('[SUBSCRIPTION-CREDITS] Error in subscription credit grant process:', error);
    throw error;
  }
};

/**
 * 取消用户订阅
 */
export const cancelUserSubscription = async (
  userId: string,
  subscriptionId: string
): Promise<boolean> => {
  try {
    const result = await query(
      `UPDATE user_subscriptions SET
        status = 'cancelled',
        cancel_at_period_end = FALSE,
        cancel_at = NULL,
        cancelled_at = NOW(),
        updated_at = NOW()
      WHERE user_id = $1::uuid AND subscription_id = $2
      RETURNING *`,
      [userId, subscriptionId]
    );

    return result.rows.length > 0;
  } catch (error) {
    console.error('Error cancelling user subscription:', error);
    throw error;
  }
};

/**
 * 恢复到期取消的订阅（清除取消计划）
 */
export const clearScheduledCancellation = async (
  userId: string,
  subscriptionId: string
): Promise<UserSubscription | null> => {
  try {
    const result = await query(
      `UPDATE user_subscriptions SET
        cancel_at_period_end = FALSE,
        cancel_at = NULL,
        updated_at = NOW()
      WHERE user_id = $1::uuid AND subscription_id = $2 AND status = 'active'
      RETURNING *`,
      [userId, subscriptionId]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error clearing scheduled cancellation:', error);
    throw error;
  }
};

/**
 * 根据订阅ID获取订阅记录
 */
export const getSubscriptionById = async (subscriptionId: string): Promise<UserSubscription | null> => {
  try {
    const result = await query(
      'SELECT * FROM user_subscriptions WHERE subscription_id = $1 ORDER BY created_at DESC LIMIT 1',
      [subscriptionId]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting subscription by id:', error);
    throw error;
  }
};

/**
 * 根据客户ID获取订阅记录
 */
export const getSubscriptionByCustomerId = async (customerId: string): Promise<UserSubscription | null> => {
  try {
    const result = await query(
      'SELECT * FROM user_subscriptions WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1',
      [customerId]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting subscription by customer id:', error);
    throw error;
  }
};

/**
 * 获取用户的订阅信息
 */
export const getUserSubscriptions = async (userId: string): Promise<UserSubscription[]> => {
  try {
    const result = await query(
      'SELECT * FROM user_subscriptions WHERE user_id = $1::uuid ORDER BY created_at DESC',
      [userId]
    );

    return result.rows;
  } catch (error) {
    console.error('Error getting user subscriptions:', error);
    throw error;
  }
};
