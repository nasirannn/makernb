import { query, withTransaction } from './db-query-builder';
import { addUserCredits } from './user-db';

export interface SubscriptionPlan {
  id: string;
  name: string;
  productId: string;
  creditsPerPeriod: number;
  periodType: 'monthly' | 'yearly';
  price: number;
}

// 订阅计划配置
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'monthly_basic',
    name: 'Monthly Basic',
    productId: process.env.NEXT_PUBLIC_MONTHLY_BASIC || '',
    creditsPerPeriod: 1000,
    periodType: 'monthly',
    price: 9.99
  },
  {
    id: 'monthly_premium',
    name: 'Monthly Premium',
    productId: process.env.NEXT_PUBLIC_MONTHLY_PREMIUM || '',
    creditsPerPeriod: 2500,
    periodType: 'monthly',
    price: 19.99
  },
  {
    id: 'yearly_basic',
    name: 'Yearly Basic',
    productId: process.env.NEXT_PUBLIC_YEARLY_BASIC || '',
    creditsPerPeriod: 12000,
    periodType: 'yearly',
    price: 99.99
  },
  {
    id: 'yearly_premium',
    name: 'Yearly Premium',
    productId: process.env.NEXT_PUBLIC_YEARLY_PREMIUM || '',
    creditsPerPeriod: 30000,
    periodType: 'yearly',
    price: 199.99
  }
];

export interface UserSubscription {
  id: string;
  user_id: string;
  subscription_id: string;
  product_id: string;
  plan_id: string;
  status: 'active' | 'cancelled' | 'expired' | 'past_due';
  current_period_start: string;
  current_period_end: string;
  next_credit_grant_date: string;
  credits_per_period: number;
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
    productId: string;
    status: 'active' | 'cancelled' | 'expired' | 'past_due';
    currentPeriodStart: string;
    currentPeriodEnd: string;
  }
): Promise<UserSubscription> => {
  try {
    // 查找对应的订阅计划
    const plan = SUBSCRIPTION_PLANS.find(p => p.productId === subscriptionData.productId);
    if (!plan) {
      throw new Error(`Unknown product ID: ${subscriptionData.productId}`);
    }

    // 计算下次积分发放日期
    const nextCreditGrantDate = new Date(subscriptionData.currentPeriodEnd);
    nextCreditGrantDate.setDate(nextCreditGrantDate.getDate() + 1); // 订阅期结束后第二天发放

    return await withTransaction(async (queryFn) => {
      // 检查是否已存在订阅记录
      const existingSubscription = await queryFn(
        'SELECT * FROM user_subscriptions WHERE user_id = $1 AND subscription_id = $2',
        [userId, subscriptionData.subscriptionId]
      );

      if (existingSubscription.rows.length > 0) {
        // 更新现有订阅
        const result = await queryFn(
          `UPDATE user_subscriptions SET
            status = $1,
            current_period_start = $2,
            current_period_end = $3,
            next_credit_grant_date = $4,
            updated_at = NOW()
          WHERE user_id = $5 AND subscription_id = $6
          RETURNING *`,
          [
            subscriptionData.status,
            subscriptionData.currentPeriodStart,
            subscriptionData.currentPeriodEnd,
            nextCreditGrantDate.toISOString(),
            userId,
            subscriptionData.subscriptionId
          ]
        );
        return result.rows[0];
      } else {
        // 创建新订阅记录
        const result = await queryFn(
          `INSERT INTO user_subscriptions (
            user_id, subscription_id, product_id, plan_id, status,
            current_period_start, current_period_end, next_credit_grant_date,
            credits_per_period, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
          RETURNING *`,
          [
            userId,
            subscriptionData.subscriptionId,
            subscriptionData.productId,
            plan.id,
            subscriptionData.status,
            subscriptionData.currentPeriodStart,
            subscriptionData.currentPeriodEnd,
            nextCreditGrantDate.toISOString(),
            plan.creditsPerPeriod
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
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === subscription.plan_id);
      if (plan) {
        if (plan.periodType === 'monthly') {
          nextGrantDate.setMonth(nextGrantDate.getMonth() + 1);
        } else if (plan.periodType === 'yearly') {
          nextGrantDate.setFullYear(nextGrantDate.getFullYear() + 1);
        }
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
        updated_at = NOW()
      WHERE user_id = $1 AND subscription_id = $2
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
 * 获取用户的订阅信息
 */
export const getUserSubscriptions = async (userId: string): Promise<UserSubscription[]> => {
  try {
    const result = await query(
      'SELECT * FROM user_subscriptions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    return result.rows;
  } catch (error) {
    console.error('Error getting user subscriptions:', error);
    throw error;
  }
};
