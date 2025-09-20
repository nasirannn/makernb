import { query, pool } from './neon';
import { addUserCredits } from './user-db';

export interface DailyCredits {
  id: string;
  user_id: string;
  daily_credits: number;
  last_login_date: string; // YYYY-MM-DD format
  created_at: string;
  updated_at: string;
}

// 检查用户今天是否已经获得登录积分
export const hasReceivedTodayCredits = async (userId: string): Promise<boolean> => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const result = await query(
      'SELECT id FROM daily_credits WHERE user_id = $1 AND last_login_date = $2 AND daily_credits > 0',
      [userId, today]
    );

    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking today credits:', error);
    throw error;
  }
};

// 给用户发放每日登录积分
export const grantDailyLoginCredits = async (userId: string): Promise<DailyCredits | null> => {
  try {
    // 检查是否是管理员
    const adminId = process.env.ADMIN_ID;
    if (adminId && userId === adminId) {
      console.log('Admin user, skipping daily login credits');
      return null;
    }

    // 检查今天是否已经获得积分
    const hasCredits = await hasReceivedTodayCredits(userId);
    if (hasCredits) {
      console.log('User already received today credits');
      return null;
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const creditsAmount = 15;

      // 创建或更新每日积分记录
      const creditsResult = await client.query(
        `INSERT INTO daily_credits (user_id, daily_credits, last_login_date) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (user_id) 
         DO UPDATE SET 
           daily_credits = CASE 
             WHEN daily_credits.last_login_date < $3 THEN $2 
             ELSE daily_credits.daily_credits 
           END,
           last_login_date = $3,
           updated_at = NOW()
         RETURNING *`,
        [userId, creditsAmount, today]
      );

      const credits = creditsResult.rows[0];
      
      // 如果今天已经有积分了，说明已经获得过积分
      if (credits.daily_credits === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      // 添加积分到用户账户
      const userCreditsResult = await client.query(
        'UPDATE user_credits SET credits = credits + $1, total_earned = total_earned + $1, updated_at = NOW() WHERE user_id = $2 RETURNING *',
        [creditsAmount, userId]
      );

      if (userCreditsResult.rows.length === 0) {
        // 如果用户积分记录不存在，创建一个
        await client.query(
          'INSERT INTO user_credits (user_id, credits, total_earned) VALUES ($1, $2, $3)',
          [userId, creditsAmount, creditsAmount]
        );
      }

      // 创建积分交易记录
      await client.query(
        `INSERT INTO credit_transactions (
          user_id, transaction_type, amount, balance_after, 
          description, reference_id, reference_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId, 
          'bonus', 
          creditsAmount, 
          userCreditsResult.rows[0]?.credits || creditsAmount,
          'Daily login credits',
          credits.id,
          'daily_login'
        ]
      );

      await client.query('COMMIT');
      
      console.log(`Daily login credits granted: ${creditsAmount} credits to user ${userId}`);
      return credits;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error granting daily login credits:', error);
    throw error;
  }
};

// 清理过期的每日登录积分（第二天凌晨清理前一天的积分）
export const cleanupExpiredDailyCredits = async (): Promise<number> => {
  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const today = new Date().toISOString().split('T')[0];
      
      // 查找所有过期的每日积分（不是今天的且有积分的）
      const expiredCredits = await client.query(
        `SELECT dc.*, uc.credits 
         FROM daily_credits dc
         JOIN user_credits uc ON dc.user_id = uc.user_id
         WHERE dc.last_login_date < $1 
         AND dc.daily_credits > 0
         AND NOT EXISTS (
           SELECT 1 FROM credit_transactions ct 
           WHERE ct.reference_id = dc.id 
           AND ct.reference_type = 'daily_login_expired'
         )`,
        [today]
      );

      let cleanedCount = 0;

      for (const credits of expiredCredits.rows) {
        // 检查用户当前积分是否足够扣除
        if (credits.credits >= credits.daily_credits) {
          // 扣除过期的每日登录积分
          await client.query(
            'UPDATE user_credits SET credits = credits - $1, updated_at = NOW() WHERE user_id = $2',
            [credits.daily_credits, credits.user_id]
          );

          // 清零每日积分
          await client.query(
            'UPDATE daily_credits SET daily_credits = 0, updated_at = NOW() WHERE user_id = $1',
            [credits.user_id]
          );

          // 创建过期扣除的交易记录
          await client.query(
            `INSERT INTO credit_transactions (
              user_id, transaction_type, amount, balance_after, 
              description, reference_id, reference_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              credits.user_id,
              'spend',
              -credits.daily_credits,
              credits.credits - credits.daily_credits,
              'Daily login credits expired',
              credits.id,
              'daily_login_expired'
            ]
          );

          cleanedCount++;
        }
      }

      await client.query('COMMIT');
      
      if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} expired daily login credits`);
      }
      
      return cleanedCount;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error cleaning up expired daily credits:', error);
    throw error;
  }
};

// 获取用户的每日登录积分历史
export const getUserDailyLoginHistory = async (
  userId: string, 
  limit: number = 30
): Promise<DailyCredits[]> => {
  try {
    const result = await query(
      'SELECT * FROM daily_credits WHERE user_id = $1 ORDER BY last_login_date DESC LIMIT $2',
      [userId, limit]
    );

    return result.rows;
  } catch (error) {
    console.error('Error getting user daily login history:', error);
    throw error;
  }
};

// 获取用户当前的每日积分状态
export const getUserDailyCreditsStatus = async (userId: string): Promise<DailyCredits | null> => {
  try {
    const result = await query(
      'SELECT * FROM daily_credits WHERE user_id = $1',
      [userId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error getting user daily credits status:', error);
    throw error;
  }
};
