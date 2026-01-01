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
    const adminId = process.env.ADMIN_ID;
    if (adminId && userId === adminId) {
      return null;
    }

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
// 清理过期的每日登录积分（批量）
// ============================================================================

export const cleanupExpiredDailyCredits = async (): Promise<number> => {
  try {
    const schema = await detectCreditTransactionSchema();
    if (!schema.hasBalanceAfter) {
      return 0;
    }

    return await withTransaction(async (queryFn) => {
      const today = getDateKey(new Date());
      const yesterday = getDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
      const todayStart = new Date(`${today}T00:00:00Z`).toISOString();
      const yesterdayStart = new Date(`${yesterday}T00:00:00Z`).toISOString();

      const selectColumns = [
        'ct.id',
        'ct.user_id',
        'ct.amount as daily_amount',
        'ct.balance_after',
        'uc.credits as current_credits',
      ];
      if (schema.hasBalanceBefore) {
        selectColumns.push('ct.balance_before');
      }

      const yesterdayCredits = await queryFn(
        `SELECT ${selectColumns.join(', ')}
         FROM credit_transactions ct
         JOIN user_credits uc ON ct.user_id = uc.user_id
         WHERE ct.transaction_type = 'bonus'
         AND ct.reference_id LIKE $1
         AND NOT EXISTS (
           SELECT 1 FROM credit_transactions exp
           WHERE exp.user_id = ct.user_id
           AND exp.reference_id = ct.id::text
           AND exp.description = 'Daily login credits expired'
         )`,
        [`%_${yesterday}`]
      );

      let cleanedCount = 0;

      for (const row of yesterdayCredits.rows) {
        const userId = row.user_id;
        const transactionId = row.id;
        const dailyAmount = row.daily_amount;
        const currentCredits = row.current_credits;
        const loginBeforeBalance =
          schema.hasBalanceBefore ? row.balance_before : (row.balance_after - dailyAmount);
        const loginAfterBalance = row.balance_after;

        const lastYesterdayTransaction = await queryFn(
          `SELECT balance_after
           FROM credit_transactions
           WHERE user_id = $1::uuid
           AND created_at >= $2
           AND created_at < $3
           ORDER BY created_at DESC
           LIMIT 1`,
          [userId, yesterdayStart, todayStart]
        );

        const yesterdayRemainingCredits = lastYesterdayTransaction.rows.length > 0
          ? lastYesterdayTransaction.rows[0].balance_after
          : loginAfterBalance;

        if (yesterdayRemainingCredits >= loginBeforeBalance && loginBeforeBalance >= 0) {
          const remainingLoginCredits = Math.max(0, Math.min(dailyAmount, yesterdayRemainingCredits - loginBeforeBalance));
          const actualDeduction = Math.min(remainingLoginCredits, currentCredits);

          if (actualDeduction > 0) {
            const existingExpiredRecord = await queryFn(
              `SELECT id FROM credit_transactions
               WHERE user_id = $1::uuid
               AND reference_id = $2::text
               AND description = 'Daily login credits expired'
               AND created_at >= $3
               LIMIT 1`,
              [userId, transactionId, todayStart]
            );

            if (existingExpiredRecord.rows.length > 0) {
              continue;
            }

            const updateResult = await queryFn(
              'UPDATE user_credits SET credits = credits - $1, updated_at = NOW() WHERE user_id = $2::uuid RETURNING credits',
              [actualDeduction, userId]
            );

            const newBalance = updateResult.rows[0].credits;

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
    console.error('[cleanupExpiredDailyCredits] Error:', error);
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
      const yesterday = getDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
      const todayStart = new Date(`${today}T00:00:00Z`).toISOString();
      const yesterdayStart = new Date(`${yesterday}T00:00:00Z`).toISOString();

      const selectColumns = [
        'ct.id',
        'ct.user_id',
        'ct.amount as daily_amount',
        'ct.balance_after',
        'uc.credits as current_credits',
      ];
      if (schema.hasBalanceBefore) {
        selectColumns.push('ct.balance_before');
      }

      const yesterdayCredits = await queryFn(
        `SELECT ${selectColumns.join(', ')}
         FROM credit_transactions ct
         JOIN user_credits uc ON ct.user_id = uc.user_id
         WHERE ct.transaction_type = 'bonus'
         AND ct.reference_id LIKE $1
         AND ct.user_id = $2::uuid
         AND NOT EXISTS (
           SELECT 1 FROM credit_transactions exp
           WHERE exp.user_id = ct.user_id
           AND exp.reference_id = ct.id::text
           AND exp.description = 'Daily login credits expired'
         )`,
        [`%_${yesterday}`, userId]
      );

      if (yesterdayCredits.rows.length === 0) {
        return 0;
      }

      let cleanedCount = 0;

      for (const row of yesterdayCredits.rows) {
        const transactionId = row.id;
        const dailyAmount = row.daily_amount;
        const currentCredits = row.current_credits;
        const loginBeforeBalance =
          schema.hasBalanceBefore ? row.balance_before : (row.balance_after - dailyAmount);
        const loginAfterBalance = row.balance_after;

        const lastYesterdayTransaction = await queryFn(
          `SELECT balance_after
           FROM credit_transactions
           WHERE user_id = $1::uuid
           AND created_at >= $2
           AND created_at < $3
           ORDER BY created_at DESC
           LIMIT 1`,
          [userId, yesterdayStart, todayStart]
        );

        const yesterdayRemainingCredits = lastYesterdayTransaction.rows.length > 0
          ? lastYesterdayTransaction.rows[0].balance_after
          : loginAfterBalance;

        if (yesterdayRemainingCredits >= loginBeforeBalance && loginBeforeBalance >= 0) {
          const remainingLoginCredits = Math.max(0, Math.min(dailyAmount, yesterdayRemainingCredits - loginBeforeBalance));
          const actualDeduction = Math.min(remainingLoginCredits, currentCredits);

          if (actualDeduction > 0) {
            const existingExpiredRecord = await queryFn(
              `SELECT id FROM credit_transactions
               WHERE user_id = $1::uuid
               AND reference_id = $2::text
               AND description = 'Daily login credits expired'
               AND created_at >= $3
               LIMIT 1`,
              [userId, transactionId, todayStart]
            );

            if (existingExpiredRecord.rows.length > 0) {
              continue;
            }

            const updateResult = await queryFn(
              'UPDATE user_credits SET credits = credits - $1, updated_at = NOW() WHERE user_id = $2::uuid RETURNING credits',
              [actualDeduction, userId]
            );

            const newBalance = updateResult.rows[0].credits;

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
