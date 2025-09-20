import { query, pool } from './neon';
import { createCreditTransaction } from './credit-transactions-db';

export interface UserCredits {
  user_id: string;
  credits: number;
  total_earned: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

// 获取或创建用户积分记录
export const getOrCreateUserCredits = async (userId: string): Promise<UserCredits> => {
  try {
    // 先尝试获取现有积分记录
    const existingCredits = await query(
      'SELECT * FROM user_credits WHERE user_id = $1',
      [userId]
    );

    if (existingCredits.rows.length > 0) {
      return existingCredits.rows[0];
    }

    // 如果积分记录不存在，创建新记录
    const newCredits = await query(
      'INSERT INTO user_credits (user_id, credits) VALUES ($1, $2) RETURNING *',
      [userId, 10]
    );

    return newCredits.rows[0];
  } catch (error) {
    console.error('Error getting or creating user credits:', error);
    throw error;
  }
};

// 更新用户积分
export const updateUserCredits = async (userId: string, credits: number): Promise<UserCredits> => {
  try {
    const result = await query(
      'UPDATE user_credits SET credits = $1, updated_at = NOW() WHERE user_id = $2 RETURNING *',
      [credits, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User credits not found');
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error updating user credits:', error);
    throw error;
  }
};

// 消费用户积分
export const consumeUserCredit = async (
  userId: string, 
  creditAmount: number = 1,
  description?: string, 
  referenceId?: string, 
  referenceType?: string
): Promise<boolean> => {
  try {
    // 使用事务确保数据一致性
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 检查并更新积分
      const result = await client.query(
        'UPDATE user_credits SET credits = credits - $1, total_spent = total_spent + $1, updated_at = NOW() WHERE user_id = $2 AND credits >= $1 RETURNING *',
        [creditAmount, userId]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      const newBalance = result.rows[0].credits;

      // 创建交易记录
      await createCreditTransaction(
        userId,
        'spend',
        -creditAmount,
        newBalance,
        description || 'Music generation',
        referenceId,
        referenceType
      );

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error consuming user credit:', error);
    throw error;
  }
};

// 获取用户积分
export const getUserCredits = async (userId: string): Promise<UserCredits | null> => {
  try {
    const result = await query(
      'SELECT * FROM user_credits WHERE user_id = $1',
      [userId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error getting user credits:', error);
    throw error;
  }
};

// 添加积分（用于奖励、充值等）
export const addUserCredits = async (
  userId: string, 
  amount: number,
  description?: string, 
  referenceId?: string, 
  referenceType?: string
): Promise<boolean> => {
  try {
    // 使用事务确保数据一致性
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 更新积分和total_earned
      const result = await client.query(
        'UPDATE user_credits SET credits = credits + $1, total_earned = total_earned + $1, updated_at = NOW() WHERE user_id = $2 RETURNING *',
        [amount, userId]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      const newBalance = result.rows[0].credits;

      // 创建交易记录
      await createCreditTransaction(
        userId,
        'earn',
        amount,
        newBalance,
        description || 'Credits added',
        referenceId,
        referenceType
      );

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error adding user credits:', error);
    throw error;
  }
};
