import { query } from './neon';

export interface CreditTransaction {
  id: string;
  user_id: string;
  transaction_type: 'earn' | 'spend' | 'refund' | 'bonus';
  amount: number;
  balance_after: number;
  description?: string;
  reference_id?: string;
  reference_type?: string;
  created_at: string;
}

// 创建积分交易记录
export const createCreditTransaction = async (
  userId: string,
  transactionType: 'earn' | 'spend' | 'refund' | 'bonus',
  amount: number,
  balanceAfter: number,
  description?: string,
  referenceId?: string,
  referenceType?: string
): Promise<CreditTransaction> => {
  try {
    const result = await query(
      `INSERT INTO credit_transactions (
        user_id, transaction_type, amount, balance_after, 
        description, reference_id, reference_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING *`,
      [userId, transactionType, amount, balanceAfter, description, referenceId, referenceType]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error creating credit transaction:', error);
    throw error;
  }
};

// 获取用户的积分交易历史
export const getUserCreditTransactions = async (
  userId: string, 
  limit: number = 20, 
  offset: number = 0
): Promise<CreditTransaction[]> => {
  try {
    const result = await query(
      'SELECT * FROM credit_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );

    return result.rows;
  } catch (error) {
    console.error('Error getting user credit transactions:', error);
    throw error;
  }
};

// 获取用户的积分交易统计
export const getUserCreditStats = async (userId: string) => {
  try {
    const result = await query(
      `SELECT 
        transaction_type,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM credit_transactions 
      WHERE user_id = $1 
      GROUP BY transaction_type`,
      [userId]
    );

    return result.rows;
  } catch (error) {
    console.error('Error getting user credit stats:', error);
    throw error;
  }
};

// 获取最近的积分交易记录
export const getRecentCreditTransactions = async (
  userId: string, 
  limit: number = 5
): Promise<CreditTransaction[]> => {
  try {
    const result = await query(
      'SELECT * FROM credit_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );

    return result.rows;
  } catch (error) {
    console.error('Error getting recent credit transactions:', error);
    throw error;
  }
};
