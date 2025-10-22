import { query, withTransaction } from './db-query-builder';
// 检查用户今天是否已经获得登录积分
export const hasReceivedTodayCredits = async (userId: string): Promise<boolean> => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const result = await query(
      `SELECT id FROM credit_transactions 
       WHERE user_id = $1::uuid 
       AND description = 'Daily login bonus' 
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
        'UPDATE user_credits SET credits = credits + $1, total_earned = total_earned + $1, updated_at = NOW() WHERE user_id = $2::uuid RETURNING *',
        [creditsAmount, userId]
      );

      if (userCreditsResult.rows.length === 0) {
        // 如果用户积分记录不存在，创建记录并直接给予每日登录积分
        const newUserCreditsResult = await queryFn(
          'INSERT INTO user_credits (user_id, credits, total_earned) VALUES ($1::uuid, $2, $3) RETURNING *',
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

// 清理过期的每日登录积分（第二天凌晨清理前一天剩余的积分）
// 逻辑：昨天获得15积分，消耗了x积分，剩余y积分，则清理y积分
export const cleanupExpiredDailyCredits = async (): Promise<number> => {
  try {
    return await withTransaction(async (queryFn) => {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 昨天的日期

      console.log(`[CLEANUP] Today: ${today}, Yesterday: ${yesterday}`);

      // 查找昨天获得每日登录积分的用户
      const yesterdayCredits = await queryFn(
        `SELECT ct.user_id, ct.reference_id, ct.amount as daily_amount, uc.credits as current_credits
         FROM credit_transactions ct
         JOIN user_credits uc ON ct.user_id = uc.user_id
         WHERE ct.description = 'Daily login bonus'
         AND DATE(ct.created_at) = $1
         AND NOT EXISTS (
           SELECT 1 FROM credit_transactions ct2
           WHERE ct2.reference_id = ct.reference_id
           AND ct2.description = 'Daily login credits expired'
         )`,
        [yesterday]
      );

      console.log(`[CLEANUP] Found ${yesterdayCredits.rows.length} users with yesterday's daily credits`);

      let cleanedCount = 0;
      const todayStart = new Date(today + 'T00:00:00Z').toISOString();

      // 处理每个用户
      for (const userCredit of yesterdayCredits.rows) {
        const { user_id: userId, reference_id: refId, daily_amount: dailyAmount, current_credits: currentCredits } = userCredit;

        // 查找昨天结束时（今天凌晨之前）的最后一笔交易余额
        const lastYesterdayTransaction = await queryFn(
          `SELECT balance_after
           FROM credit_transactions
           WHERE user_id = $1::uuid
           AND created_at < $2
           ORDER BY created_at DESC
           LIMIT 1`,
          [userId, todayStart]
        );

        let yesterdayRemainingCredits = 0;
        
        if (lastYesterdayTransaction.rows.length > 0) {
          yesterdayRemainingCredits = lastYesterdayTransaction.rows[0].balance_after;
        }

        console.log(`[CLEANUP] User ${userId}: Yesterday remaining = ${yesterdayRemainingCredits}, Current = ${currentCredits}`);

        // 如果昨天有剩余积分，需要清理
        if (yesterdayRemainingCredits > 0) {
          // 实际要清理的积分数 = min(昨天剩余积分, 用户当前积分)
          const actualDeduction = Math.min(yesterdayRemainingCredits, currentCredits);

          if (actualDeduction > 0) {
            console.log(`[CLEANUP] Cleaning ${actualDeduction} credits for user ${userId}`);

            // 扣除过期的每日登录积分
            const updateResult = await queryFn(
              'UPDATE user_credits SET credits = credits - $1, updated_at = NOW() WHERE user_id = $2::uuid RETURNING credits',
              [actualDeduction, userId]
            );

            const newBalance = updateResult.rows[0].credits;

            // 创建过期积分交易记录
            await queryFn(
              `INSERT INTO credit_transactions (
                user_id, transaction_type, amount, balance_after,
                description, reference_id
              ) VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                userId,
                'expired',
                -actualDeduction,
                newBalance,
                'Daily login credits expired',
                refId
              ]
            );

            cleanedCount++;
          } else {
            console.log(`[CLEANUP] User ${userId} has no credits to clean up`);
          }
        } else {
          console.log(`[CLEANUP] User ${userId} had no remaining credits yesterday, skipping`);
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
       WHERE user_id = $1::uuid AND description = 'Daily login bonus' 
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
       WHERE user_id = $1::uuid AND description = 'Daily login bonus' 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error getting user daily credits status:', error);
    throw error;
  }
};
