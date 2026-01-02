import { query, withTransaction } from './db-query-builder';

// ============================================================================
// 每日登录积分系统 - 业务逻辑说明
// ============================================================================
//
// 【核心规则】
// 1. 每日登录奖励：用户每天首次登录获得 15 积分（transaction_type = 'bonus'）
// 2. 过期机制：登录奖励积分在过期后会被清理；登录时清理该用户所有已过期且未消耗的登录积分（逐条奖励清理，上限为该条奖励金额）
// 3. 订阅积分保护：只清理登录积分，订阅积分永久有效
//
// 【实现细节】
// - 使用 credit_transactions 表追踪每日登录积分（reference_id 唯一）
// - 清理时创建 'expired' 类型的交易记录，便于审计
// - 避免依赖 daily_logins 表，兼容历史/缺失结构
//
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

const getDateKey = (date: Date) => date.toISOString().split('T')[0];
const getDailyLoginReferenceId = (userId: string, dateKey: string) =>
  `daily_login_${userId.slice(0, 8)}_${dateKey}`;

let creditTransactionSchema:
  | { hasBalanceBefore: boolean; hasBalanceAfter: boolean }
  | null = null;

const detectCreditTransactionSchema = async () => {
  if (creditTransactionSchema) {
    return creditTransactionSchema;
  }

  try {
    const result = await query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'credit_transactions'
       AND column_name IN ('balance_before', 'balance_after')`
    );
    const columns = new Set<string>(result.rows.map((row: { column_name: string }) => row.column_name));
    creditTransactionSchema = {
      hasBalanceBefore: columns.has('balance_before'),
      hasBalanceAfter: columns.has('balance_after'),
    };
  } catch (error) {
    console.error('[daily-login-credits] Failed to detect credit_transactions columns:', error);
    creditTransactionSchema = { hasBalanceBefore: false, hasBalanceAfter: false };
  }

  return creditTransactionSchema;
};

const insertCreditTransaction = async (
  queryFn: typeof query,
  schema: { hasBalanceBefore: boolean; hasBalanceAfter: boolean },
  params: {
    userId: string;
    transactionType: string;
    amount: number;
    balanceBefore?: number;
    balanceAfter?: number;
    description: string;
    referenceId: string;
  }
) => {
  const columns = ['user_id', 'transaction_type', 'amount'];
  const values: Array<string | number | null> = [
    params.userId,
    params.transactionType,
    params.amount,
  ];

  if (schema.hasBalanceBefore) {
    columns.push('balance_before');
    values.push(params.balanceBefore ?? null);
  }

  if (schema.hasBalanceAfter) {
    if (typeof params.balanceAfter === 'undefined') {
      throw new Error('balance_after is required for credit_transactions schema');
    }
    columns.push('balance_after');
    values.push(params.balanceAfter);
  }

  columns.push('description', 'reference_id');
  values.push(params.description, params.referenceId);

  const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
  const result = await queryFn(
    `INSERT INTO credit_transactions (${columns.join(', ')})
     VALUES (${placeholders}) RETURNING id`,
    values
  );
  return result.rows[0].id as string;
};

// ============================================================================
// 检查用户今天是否已经获得登录积分
// ============================================================================

export const hasReceivedTodayCredits = async (userId: string): Promise<boolean> => {
  try {
    const today = getDateKey(new Date());
    const referenceId = getDailyLoginReferenceId(userId, today);

    const result = await query(
      `SELECT id FROM credit_transactions
       WHERE user_id = $1::uuid
       AND reference_id = $2
       AND transaction_type = 'bonus'
       LIMIT 1`,
      [userId, referenceId]
    );

    return result.rows.length > 0;
  } catch (error) {
    console.error('[hasReceivedTodayCredits] Error:', error);
    throw error;
  }
};

// ============================================================================
// 给用户发放每日登录积分（使用 reference_id 防止重复）
// ============================================================================

export const grantDailyLoginCredits = async (
  userId: string
): Promise<{ id: string; daily_credits: number; last_login_date: string } | null> => {
  try {
    const schema = await detectCreditTransactionSchema();

    return await withTransaction(async (queryFn) => {
      const today = getDateKey(new Date());
      const creditsAmount = 15;
      const referenceId = getDailyLoginReferenceId(userId, today);

      const existingCredit = await queryFn(
        `SELECT id FROM credit_transactions
         WHERE user_id = $1::uuid
         AND reference_id = $2
         AND transaction_type = 'bonus'
         LIMIT 1`,
        [userId, referenceId]
      );

      if (existingCredit.rows.length > 0) {
        return null;
      }

      const userCreditsResult = await queryFn(
        'SELECT credits, total_earned FROM user_credits WHERE user_id = $1::uuid FOR UPDATE',
        [userId]
      );

      let newBalance: number;
      let balanceBefore: number;

      if (userCreditsResult.rows.length === 0) {
        balanceBefore = 0;
        const newUserCreditsResult = await queryFn(
          'INSERT INTO user_credits (user_id, credits, total_earned) VALUES ($1::uuid, $2, $3) RETURNING credits',
          [userId, creditsAmount, creditsAmount]
        );
        newBalance = newUserCreditsResult.rows[0].credits;
      } else {
        balanceBefore = userCreditsResult.rows[0].credits;
        const updateResult = await queryFn(
          'UPDATE user_credits SET credits = credits + $1, total_earned = total_earned + $1, updated_at = NOW() WHERE user_id = $2::uuid RETURNING credits',
          [creditsAmount, userId]
        );
        newBalance = updateResult.rows[0].credits;
      }

      const transactionId = await insertCreditTransaction(queryFn, schema, {
        userId,
        transactionType: 'bonus',
        amount: creditsAmount,
        balanceBefore,
        balanceAfter: newBalance,
        description: 'Daily login bonus',
        referenceId,
      });

      return {
        id: transactionId,
        daily_credits: creditsAmount,
        last_login_date: today,
      };
    });
  } catch (error) {
    console.error('[grantDailyLoginCredits] Error:', error);
    throw error;
  }
};

// ============================================================================
// 清理指定用户的过期每日登录积分
// ============================================================================

export const cleanupExpiredDailyCreditsForUser = async (userId: string): Promise<number> => {
  try {
    const schema = await detectCreditTransactionSchema();
    if (!schema.hasBalanceAfter) {
      return 0;
    }

    return await withTransaction(async (queryFn) => {
      const today = getDateKey(new Date());

      const selectColumns = [
        'ct.id',
        'ct.user_id',
        'ct.amount as daily_amount',
        'ct.balance_after',
        'ct.reference_id',
      ];
      if (schema.hasBalanceBefore) {
        selectColumns.push('ct.balance_before');
      }

      const expiredCredits = await queryFn(
        `SELECT ${selectColumns.join(', ')}
         FROM credit_transactions ct
         WHERE ct.transaction_type = 'bonus'
         AND ct.user_id = $1::uuid
         AND NOT EXISTS (
           SELECT 1 FROM credit_transactions exp
           WHERE exp.user_id = ct.user_id
           AND exp.reference_id = ct.id::text
           AND exp.description = 'Daily login credits expired'
         )`,
        [userId]
      );

      if (expiredCredits.rows.length === 0) {
        return 0;
      }

      const userCredits = await queryFn(
        'SELECT credits FROM user_credits WHERE user_id = $1::uuid FOR UPDATE',
        [userId]
      );
      if (userCredits.rows.length === 0) {
        return 0;
      }
      let currentBalance = userCredits.rows[0].credits;

      let cleanedCount = 0;

      for (const row of expiredCredits.rows) {
        const transactionId = row.id;
        const dailyAmount = row.daily_amount;
        const loginBeforeBalance =
          schema.hasBalanceBefore ? row.balance_before : (row.balance_after - dailyAmount);
        const loginAfterBalance = row.balance_after;

        const referenceId = row.reference_id as string;
        const match = referenceId?.match(/(\\d{4}-\\d{2}-\\d{2})$/);
        if (!match) {
          continue;
        }
        const bonusDateKey = match[1];
        if (bonusDateKey >= today) {
          continue;
        }

        const dayStart = new Date(`${bonusDateKey}T00:00:00Z`).toISOString();
        const nextDayStart = new Date(`${bonusDateKey}T00:00:00Z`);
        nextDayStart.setUTCDate(nextDayStart.getUTCDate() + 1);
        const dayEnd = nextDayStart.toISOString();

        const lastDayTransaction = await queryFn(
          `SELECT balance_after
           FROM credit_transactions
           WHERE user_id = $1::uuid
           AND created_at >= $2
           AND created_at < $3
           ORDER BY created_at DESC
           LIMIT 1`,
          [userId, dayStart, dayEnd]
        );

        const dayRemainingCredits = lastDayTransaction.rows.length > 0
          ? lastDayTransaction.rows[0].balance_after
          : loginAfterBalance;

        if (dayRemainingCredits >= loginBeforeBalance && loginBeforeBalance >= 0) {
          const remainingLoginCredits = Math.max(0, Math.min(dailyAmount, dayRemainingCredits - loginBeforeBalance));
          const actualDeduction = Math.min(remainingLoginCredits, currentBalance);

          if (actualDeduction > 0) {
            const updateResult = await queryFn(
              'UPDATE user_credits SET credits = credits - $1, updated_at = NOW() WHERE user_id = $2::uuid RETURNING credits',
              [actualDeduction, userId]
            );

            const newBalance = updateResult.rows[0].credits;
            currentBalance = newBalance;

            await insertCreditTransaction(queryFn, schema, {
              userId,
              transactionType: 'expired',
              amount: -actualDeduction,
              balanceAfter: newBalance,
              description: 'Daily login credits expired',
              referenceId: transactionId,
            });

            cleanedCount++;
          }
        }
      }

      return cleanedCount;
    });
  } catch (error) {
    console.error('[cleanupExpiredDailyCreditsForUser] Error:', error);
    throw error;
  }
};

// ============================================================================
// 获取用户的每日登录积分历史
// ============================================================================

export const getUserDailyLoginHistory = async (
  userId: string
): Promise<{ id: string; daily_credits: number; last_login_date: string; created_at: string }[]> => {
  try {
    const result = await query(
      `SELECT id, amount as daily_credits, created_at as last_login_date, created_at
       FROM credit_transactions
       WHERE user_id = $1::uuid
       AND transaction_type = 'bonus'
       AND description = 'Daily login bonus'
       ORDER BY created_at DESC`,
      [userId]
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

export const getUserDailyCreditsStatus = async (
  userId: string
): Promise<{ id: string; daily_credits: number; last_login_date: string; created_at: string } | null> => {
  try {
    const result = await query(
      `SELECT id, amount as daily_credits, created_at as last_login_date, created_at
       FROM credit_transactions
       WHERE user_id = $1::uuid
       AND transaction_type = 'bonus'
       AND description = 'Daily login bonus'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('[getUserDailyCreditsStatus] Error:', error);
    throw error;
  }
};
