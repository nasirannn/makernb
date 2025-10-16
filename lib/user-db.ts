import { query, withTransaction } from './db-query-builder';

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
    return await withTransaction(async (queryFn) => {
      // 检查并更新积分
      const result = await queryFn(
        'UPDATE user_credits SET credits = credits - $1, total_spent = total_spent + $1, updated_at = NOW() WHERE user_id = $2 AND credits >= $1 RETURNING *',
        [creditAmount, userId]
      );

      if (result.rows.length === 0) {
        return false;
      }

      const newBalance = result.rows[0].credits;

      // 创建交易记录
      await queryFn(
        `INSERT INTO credit_transactions (
          user_id, transaction_type, amount, balance_after,
          description, reference_id, reference_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, 'spend', -creditAmount, newBalance, description || 'Music generation', referenceId, referenceType]
      );

      return true;
    });
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

// 生成优化的交易描述
const generateTransactionDescription = (
  transactionType: string, 
  customDescription?: string,
  context?: any
): string => {
  // 如果提供了自定义描述，优先使用
  if (customDescription) {
    return customDescription;
  }

  // 根据交易类型生成标准描述
  switch (transactionType) {
    case 'subscription':
      return context?.billingPeriod && context?.creditsAmount 
        ? `Subscription payment - ${context.billingPeriod} - ${context.creditsAmount} credits`
        : 'Subscription payment';
    
    case 'purchase':
      return context?.creditsAmount 
        ? `One-time purchase - ${context.creditsAmount} credits`
        : 'One-time purchase';
    
    case 'refund':
      return context?.reason 
        ? `Refund - ${context.reason}`
        : 'Refund';
    
    case 'bonus':
      return 'Daily login bonus';
    
    case 'music_generation':
      return context?.modelVersion 
        ? `Music generation (${context.modelVersion})`
        : 'Music generation';
    
    case 'lyrics_generation':
      return 'Lyrics generation';
    
    case 'spend':
      return context?.service 
        ? `${context.service} consumption`
        : 'Credits spent';
    
    
    case 'system':
      return context?.operation 
        ? `System ${context.operation}`
        : 'System operation';
    
    default:
      return `${transactionType} transaction`;
  }
};

// 添加积分（用于奖励、充值等）
export const addUserCredits = async (
  userId: string, 
  amount: number,
  description?: string, 
  referenceId?: string, 
  transactionType: string = 'system',
  context?: any
): Promise<boolean> => {
  try {
    return await withTransaction(async (queryFn) => {
      // 更新积分和total_earned
      const result = await queryFn(
        'UPDATE user_credits SET credits = credits + $1, total_earned = total_earned + $1, updated_at = NOW() WHERE user_id = $2 RETURNING *',
        [amount, userId]
      );

      if (result.rows.length === 0) {
        return false;
      }

      const newBalance = result.rows[0].credits;

      // 确保引用完整性：如果没有提供引用，使用系统类型
      const finalReferenceId = referenceId || `system_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 生成优化的描述
      const finalDescription = generateTransactionDescription(transactionType, description, context);

      // 创建交易记录
      await queryFn(
        `INSERT INTO credit_transactions (
          user_id, transaction_type, amount, balance_after,
          description, reference_id
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, transactionType, amount, newBalance, finalDescription, finalReferenceId]
      );

      return true;
    });
  } catch (error) {
    console.error('Error adding user credits:', error);
    throw error;
  }
};
