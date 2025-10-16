import { query, withTransaction } from './db-query-builder';
import { addUserCredits } from './user-db';

// 检查用户今天是否已经获得登录积分
export const hasReceivedTodayCredits = async (userId: string): Promise<boolean> => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const result = await query(
      `SELECT id FROM credit_transactions 
       WHERE user_id = $1 
       AND reference_type = 'daily_login' 
       AND DATE(created_at AT TIME ZONE 'UTC') = $2`,
      [userId, today]
    );

    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking today credits:', error);
    throw error;
  }
};

// 给用户发放每日登录积分
export const grantDailyLoginCredits = async (userId: string): Promise<{ id: string; daily_credits: number; last_login_date: string } | null> => {
  try {
    // 检查是否是管理员
    const adminId = process.env.ADMIN_ID;
    if (adminId && userId === adminId) {
      return null;
    }

    // 检查今天是否已经获得积分
    const hasCredits = await hasReceivedTodayCredits(userId);
    if (hasCredits) {
      return null;
    }

    return await withTransaction(async (queryFn) => {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const creditsAmount = 15;

      // 添加积分到用户账户
      const userCreditsResult = await queryFn(
        'UPDATE user_credits SET credits = credits + $1, total_earned = total_earned + $1, updated_at = NOW() WHERE user_id = $2 RETURNING *',
        [creditsAmount, userId]
      );

      if (userCreditsResult.rows.length === 0) {
        // 如果用户积分记录不存在，创建一个
        const newUserCreditsResult = await queryFn(
          'INSERT INTO user_credits (user_id, credits, total_earned) VALUES ($1, $2, $3) RETURNING *',
          [userId, creditsAmount, creditsAmount]
        );
        const newBalance = newUserCreditsResult.rows[0].credits;

        // 创建积分交易记录
        const loginRewardId = `daily_login_${userId.slice(0, 8)}_${today}`;
        const transactionResult = await queryFn(
          `INSERT INTO credit_transactions (
            user_id, transaction_type, amount, balance_after,
            description, reference_id
          ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [
            userId,
            'bonus',
            creditsAmount,
            newBalance,
            'Daily login bonus',
            loginRewardId
          ]
        );

        return {
          id: transactionResult.rows[0].id,
          daily_credits: creditsAmount,
          last_login_date: today
        };
      }

      const newBalance = userCreditsResult.rows[0].credits;

      // 创建积分交易记录
      const loginRewardId = `daily_login_${userId.slice(0, 8)}_${today}`;
      const transactionResult = await queryFn(
        `INSERT INTO credit_transactions (
          user_id, transaction_type, amount, balance_after,
          description, reference_id
        ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          userId,
          'bonus',
          creditsAmount,
          newBalance,
          'Daily login bonus',
          loginRewardId
        ]
      );

      // 返回类似原来的结构，但使用 transaction id
      return {
        id: transactionResult.rows[0].id,
        daily_credits: creditsAmount,
        last_login_date: today
      };
    });

  } catch (error) {
    console.error('[grantDailyLoginCredits] Error:', error);
    throw error;
  }
};

// 清理过期的每日登录积分（第二天凌晨清理前一天的积分）
export const cleanupExpiredDailyCredits = async (): Promise<number> => {
  try {
    return await withTransaction(async (queryFn) => {
      const today = new Date().toISOString().split('T')[0];

      // 查找所有过期的每日登录积分（不是今天的且有积分的）
      const expiredCredits = await queryFn(
        `SELECT ct.*, uc.credits, DATE(ct.created_at AT TIME ZONE 'UTC') as grant_date
         FROM credit_transactions ct
         JOIN user_credits uc ON ct.user_id = uc.user_id
         WHERE ct.reference_type = 'daily_login'
         AND DATE(ct.created_at AT TIME ZONE 'UTC') < $1
         AND ct.amount > 0
         AND NOT EXISTS (
           SELECT 1 FROM credit_transactions ct2
           WHERE ct2.reference_id = ct.id
           AND ct2.reference_type = 'daily_login_expired'
         )`,
        [today]
      );

      let cleanedCount = 0;

      for (const credit of expiredCredits.rows) {
        // 检查用户当前积分是否足够扣除
        if (credit.credits >= credit.amount) {
          // 扣除过期的每日登录积分
          await queryFn(
            'UPDATE user_credits SET credits = credits - $1, updated_at = NOW() WHERE user_id = $2',
            [credit.amount, credit.user_id]
          );

          // 创建过期扣除的交易记录
          await queryFn(
            `INSERT INTO credit_transactions (
              user_id, transaction_type, amount, balance_after,
              description, reference_id, reference_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              credit.user_id,
              'spend',
              -credit.amount,
              credit.credits - credit.amount,
              'Daily login credits expired',
              credit.id,
              'daily_login_expired'
            ]
          );

          cleanedCount++;
        }
      }

      return cleanedCount;
    });

  } catch (error) {
    console.error('Error cleaning up expired daily credits:', error);
    throw error;
  }
};

// 获取用户的每日登录积分历史
export const getUserDailyLoginHistory = async (
  userId: string, 
  limit: number = 30
): Promise<{ id: string; daily_credits: number; last_login_date: string; created_at: string }[]> => {
  try {
    const result = await query(
      `SELECT id, amount as daily_credits, DATE(created_at) as last_login_date, created_at 
       FROM credit_transactions 
       WHERE user_id = $1 AND reference_type = 'daily_login' 
       ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  } catch (error) {
    console.error('Error getting user daily login history:', error);
    throw error;
  }
};

// 获取用户当前的每日积分状态
export const getUserDailyCreditsStatus = async (userId: string): Promise<{ id: string; daily_credits: number; last_login_date: string; created_at: string } | null> => {
  try {
    const result = await query(
      `SELECT id, amount as daily_credits, DATE(created_at) as last_login_date, created_at 
       FROM credit_transactions 
       WHERE user_id = $1 AND reference_type = 'daily_login' 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error getting user daily credits status:', error);
    throw error;
  }
};
