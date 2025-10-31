import { query, withTransaction } from './db-query-builder';

// ============================================================================
// 每日登录积分系统 - 业务逻辑说明
// ============================================================================
//
// 【核心规则】
// 1. 每日登录奖励：用户每天首次登录获得 15 积分（transaction_type = 'bonus'）
// 2. 过期机制：登录奖励积分第二天凌晨清零，最多清理15积分
// 3. 订阅积分保护：只清理登录积分，订阅积分永久有效
//
// 【清理逻辑】
// 场景示例：
// - 用户A昨天登录获得15积分，使用了7积分，剩余8积分
// - 今天凌晨清理时，清理8积分（昨天剩余的登录积分），不管今天是否登录
// - 用户B有50订阅积分，昨天登录获得15积分，使用了10积分，剩余55积分
// - 今天凌晨清理时，只清理5积分（15-10），保留50订阅积分
//
// 清理策略：
// 1. 查找昨天获得登录积分的用户（不管今天是否登录）
// 2. 获取昨天登录前的余额（loginBeforeBalance）
// 3. 获取昨天结束时的积分余额（yesterdayRemainingCredits）
// 4. 计算昨天剩余的登录积分 = yesterdayRemainingCredits - loginBeforeBalance
// 5. 清理数量 = min(15积分, 剩余的登录积分)，确保不超过当前余额
// 6. 这样只清理登录积分，订阅积分不会被清理
//
// 【实现细节】
// - 通过 credit_transactions 表追踪积分变动
// - 通过 daily_logins 表记录每日登录
// - 使用 'bonus' 标记每日登录积分，使用 'subscription_credit' 标记订阅积分
// - 清理时创建 'expired' 类型的交易记录，便于审计
//
// ============================================================================

// ============================================================================
// 类型定义
// ============================================================================

export interface DailyLogin {
  id: string;
  user_id: string;
  login_date: string;
  login_time: string;
  credits_granted: number;
  transaction_id: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 检查用户今天是否已经获得登录积分
// ============================================================================

export const hasReceivedTodayCredits = async (userId: string): Promise<boolean> => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const result = await query(
      `SELECT id FROM daily_logins 
       WHERE user_id = $1::uuid 
       AND login_date = $2`,
      [userId, today]
    );

    return result.rows.length > 0;
  } catch (error) {
    console.error('[hasReceivedTodayCredits] Error:', error);
    throw error;
  }
};

// ============================================================================
// 给用户发放每日登录积分（使用唯一约束防止重复）
// ============================================================================

export const grantDailyLoginCredits = async (userId: string): Promise<{ id: string; daily_credits: number; last_login_date: string } | null> => {
  try {
    // 检查是否是管理员
    const adminId = process.env.ADMIN_ID;
    if (adminId && userId === adminId) {
      return null;
    }

    return await withTransaction(async (queryFn) => {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const creditsAmount = 15;

      // 尝试插入每日登录记录（唯一约束会自动防止重复）
      let loginRecord;
      try {
        const loginInsertResult = await queryFn(
          `INSERT INTO daily_logins (user_id, login_date, login_time, credits_granted)
           VALUES ($1::uuid, $2, NOW(), $3)
           RETURNING id, login_date`,
          [userId, today, creditsAmount]
        );
        loginRecord = loginInsertResult.rows[0];
      } catch (insertError: any) {
        // 如果是唯一约束冲突，说明今天已经获得过积分了
        if (insertError.code === '23505') {
          console.log(`[grantDailyLoginCredits] User ${userId} already received today's credits`);
          return null;
        }
        throw insertError;
      }

      // 🔒 锁定用户积分记录，防止并发更新
      const userCreditsResult = await queryFn(
        'SELECT credits, total_earned FROM user_credits WHERE user_id = $1::uuid FOR UPDATE',
        [userId]
      );

      let newBalance: number;
      let transactionId: string;

      if (userCreditsResult.rows.length === 0) {
        // 如果用户积分记录不存在，创建记录并直接给予每日登录积分
        const newUserCreditsResult = await queryFn(
          'INSERT INTO user_credits (user_id, credits, total_earned) VALUES ($1::uuid, $2, $3) RETURNING credits',
          [userId, creditsAmount, creditsAmount]
        );
        newBalance = newUserCreditsResult.rows[0].credits;
      } else {
        // 更新用户积分
        const updateResult = await queryFn(
          'UPDATE user_credits SET credits = credits + $1, total_earned = total_earned + $1, updated_at = NOW() WHERE user_id = $2::uuid RETURNING credits',
          [creditsAmount, userId]
        );
        newBalance = updateResult.rows[0].credits;
      }

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

      transactionId = transactionResult.rows[0].id;

      // 更新 daily_logins 表的 transaction_id
      await queryFn(
        'UPDATE daily_logins SET transaction_id = $1 WHERE id = $2',
        [transactionId, loginRecord.id]
      );

      return {
        id: loginRecord.id,
        daily_credits: creditsAmount,
        last_login_date: today
      };
    });

  } catch (error) {
    console.error('[grantDailyLoginCredits] Error:', error);
    throw error;
  }
};

// ============================================================================
// 清理过期的每日登录积分（第二天凌晨清理前一天剩余的积分）
// ============================================================================

export const cleanupExpiredDailyCredits = async (): Promise<number> => {
  try {
    return await withTransaction(async (queryFn) => {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 昨天的日期

      console.log(`[CLEANUP] Today: ${today}, Yesterday: ${yesterday}`);

      // 查找昨天获得每日登录积分的用户（使用新的 daily_logins 表）
      const yesterdayCredits = await queryFn(
        `SELECT dl.user_id, dl.transaction_id, dl.credits_granted as daily_amount, uc.credits as current_credits
         FROM daily_logins dl
         JOIN user_credits uc ON dl.user_id = uc.user_id
         WHERE dl.login_date = $1
         AND dl.transaction_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM credit_transactions ct
           WHERE ct.id = dl.transaction_id
           AND ct.description = 'Daily login credits expired'
         )`,
        [yesterday]
      );

      console.log(`[CLEANUP] Found ${yesterdayCredits.rows.length} users with yesterday's daily credits`);

      let cleanedCount = 0;
      const todayStart = new Date(today + 'T00:00:00Z').toISOString();

      // 处理每个用户
      for (const userCredit of yesterdayCredits.rows) {
        const { user_id: userId, transaction_id: transactionId, daily_amount: dailyAmount, current_credits: currentCredits } = userCredit;

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

        // 查找昨天登录时的交易记录，获取登录前的余额
        const loginTransaction = await queryFn(
          `SELECT balance_before, balance_after, created_at
           FROM credit_transactions
           WHERE id = $1::uuid
           AND user_id = $2::uuid
           LIMIT 1`,
          [transactionId, userId]
        );

        let loginBeforeBalance = 0;
        if (loginTransaction.rows.length > 0) {
          loginBeforeBalance = loginTransaction.rows[0].balance_before || 0;
        }

        console.log(`[CLEANUP] User ${userId}: Login before balance = ${loginBeforeBalance}, Yesterday remaining = ${yesterdayRemainingCredits}, Daily amount = ${dailyAmount}, Current = ${currentCredits}`);

        // 如果昨天有剩余积分，需要清理
        // 策略：只清理昨天新增的登录积分中剩余的部分
        // 例如：昨天登录获得15积分，消耗7积分，剩余8积分，则清理8积分
        // 这样可以确保只清理登录积分，不会清理订阅积分
        if (yesterdayRemainingCredits > 0 && loginBeforeBalance >= 0) {
          // 计算昨天获得的15积分中，还剩多少没有消耗
          // 昨天登录后余额 = 登录前余额 + 15
          // 昨天结束时余额 = 已知
          // 剩余的登录积分 = 昨天结束时余额 - 登录前余额（但不能超过15积分，也不能小于0）
          const remainingLoginCredits = Math.max(0, Math.min(dailyAmount, yesterdayRemainingCredits - loginBeforeBalance));
          
          // 应该清理的积分 = 剩余的登录积分（不能超过当前余额）
          const creditsToClean = remainingLoginCredits;
          
          // 确保不超过当前余额
          const actualDeduction = Math.min(creditsToClean, currentCredits);

          console.log(`[CLEANUP] User ${userId}: Login before = ${loginBeforeBalance}, Yesterday remaining = ${yesterdayRemainingCredits}, Remaining login credits = ${remainingLoginCredits}, Credits to clean = ${creditsToClean}, Actual deduction = ${actualDeduction}`);

          if (actualDeduction > 0) {
            // ✅ 防止重复执行：在插入过期记录之前，再次检查是否已经存在过期记录
            // 这样可以防止并发执行时重复创建过期记录
            const existingExpiredRecord = await queryFn(
              `SELECT id FROM credit_transactions 
               WHERE user_id = $1::uuid 
               AND reference_id = $2::uuid
               AND description = 'Daily login credits expired'
               AND created_at >= $3
               LIMIT 1`,
              [userId, transactionId, todayStart]
            );

            if (existingExpiredRecord.rows.length > 0) {
              console.log(`[CLEANUP] User ${userId} already has expired record for transaction ${transactionId}, skipping`);
              continue; // 已经处理过，跳过
            }

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
                transactionId
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
    console.error('[cleanupExpiredDailyCredits] Error:', error);
    throw error;
  }
};

// ============================================================================
// 获取用户的每日登录积分历史
// ============================================================================

export const getUserDailyLoginHistory = async (
  userId: string, 
  limit: number = 30
): Promise<{ id: string; daily_credits: number; last_login_date: string; created_at: string }[]> => {
  try {
    const result = await query(
      `SELECT id, credits_granted as daily_credits, login_date as last_login_date, login_time as created_at 
       FROM daily_logins 
       WHERE user_id = $1::uuid 
       ORDER BY login_date DESC, login_time DESC 
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  } catch (error) {
    console.error('[getUserDailyLoginHistory] Error:', error);
    throw error;
  }
};

// ============================================================================
// 获取用户当前的每日积分状态
// ============================================================================

export const getUserDailyCreditsStatus = async (userId: string): Promise<{ id: string; daily_credits: number; last_login_date: string; created_at: string } | null> => {
  try {
    const result = await query(
      `SELECT id, credits_granted as daily_credits, login_date as last_login_date, login_time as created_at 
       FROM daily_logins 
       WHERE user_id = $1::uuid 
       ORDER BY login_date DESC, login_time DESC 
       LIMIT 1`,
      [userId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('[getUserDailyCreditsStatus] Error:', error);
    throw error;
  }
};
