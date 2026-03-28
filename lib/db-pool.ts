import { Pool, PoolClient, QueryResultRow, types } from 'pg';

const PG_NUMERIC_OID = 1700;

types.setTypeParser(PG_NUMERIC_OID, (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
});

// ============================================================================
// NEON FREE TIER OPTIMIZED DATABASE POOL
// ============================================================================

/**
 * Neon 免费版特性：
 * - 连接限制：1-2 个并发连接
 * - 自动休眠：空闲后自动断开
 * - 连接超时：对空闲连接有严格限制
 * 
 * 优化策略：
 * - 使用极小的连接池 (max: 1)
 * - 短空闲超时 (30秒)
 * - 按需连接，用完立即释放
 * - 自动重连机制
 */

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number | null;
  command: string;
}

// ============================================================================
// POOL CONFIGURATION
// ============================================================================

const POOL_CONFIG = {
  // Neon 免费版连接限制
  max: 1,                    // 最大 1 个连接
  min: 0,                    // 不保持最小连接
  idleTimeoutMillis: 20000,  // 20秒空闲超时（减少以避免Neon自动断开）
  connectionTimeoutMillis: 8000,  // 8秒连接超时（减少等待时间）

  // 查询超时（针对Neon免费版优化）
  query_timeout: 25000,      // 25秒查询超时
  statement_timeout: 25000,  // 25秒语句超时

  // 连接配置
  ssl: {
    // 默认保持与当前线上行为一致；如需严格校验可通过环境变量开启
    rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED === 'true'
  },

  // Neon specific
  application_name: 'rnb-music-gen',

  // 额外的Neon优化配置
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
};

// ============================================================================
// POOL INSTANCE (Lazy Initialization)
// ============================================================================

let pool: Pool | null = null;
let poolInitializing = false;
let lastConnectionError: Error | null = null;
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5;
let poolResetPromise: Promise<void> | null = null;

const CLOSED_POOL_ERROR = 'cannot use a pool after calling end on the pool';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function withJitter(delayMs: number): number {
  // 20% 抖动，避免错误高峰时所有请求在同一时刻重试
  const jitterFactor = 0.9 + Math.random() * 0.2;
  return Math.max(50, Math.round(delayMs * jitterFactor));
}

function getRetryDelayMs(attempt: number, useNeonBackoff: boolean): number {
  const baseDelay = useNeonBackoff
    ? Math.min(2000 * Math.pow(1.5, attempt - 1), 8000)
    : Math.min(1000 * Math.pow(2, attempt - 1), 5000);
  return withJitter(baseDelay);
}

/**
 * 创建数据库连接池
 */
function createPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  
  const newPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ...POOL_CONFIG,
  });

  // 连接成功事件
  newPool.on('connect', (_client: PoolClient) => {
    consecutiveErrors = 0; // 重置错误计数
  });

  // 连接错误事件
  newPool.on('error', (err: Error) => {
    console.error('[DB-POOL] Pool error:', err.message);
    lastConnectionError = err;
    consecutiveErrors++;
    
    // 如果连续错误过多，重置连接池
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      console.error('[DB-POOL] Too many consecutive errors, resetting pool');
      void resetPool('pool_error_threshold').catch((resetError) => {
        console.error('[DB-POOL] Failed to reset pool from pool error handler:', resetError);
      });
    }
  });

  return newPool;
}

/**
 * 获取连接池实例（懒加载）
 */
function getPool(): Pool {
  // 检查 pool 是否存在且未关闭
  if (pool && (pool as any).ended) {
    console.warn('[DB-POOL] Detected closed pool, resetting...');
    pool = null;
  }
  
  if (!pool && !poolInitializing) {
    poolInitializing = true;
    try {
      pool = createPool();
    } finally {
      poolInitializing = false;
    }
  }
  
  if (!pool) {
    throw new Error('Failed to initialize database pool');
  }
  
  return pool;
}

/**
 * 重置连接池
 */
async function resetPool(reason: string = 'unknown'): Promise<void> {
  if (poolResetPromise) {
    return poolResetPromise;
  }

  poolResetPromise = (async () => {
    console.log(`[DB-POOL] Resetting connection pool (reason: ${reason})...`);

    if (pool) {
      try {
        await pool.end();
      } catch (error) {
        console.error('[DB-POOL] Error ending pool:', error);
      }
      pool = null;
    }

    consecutiveErrors = 0;
    lastConnectionError = null;

    // 给上层重试留一点缓冲时间，避免立即重连打到同一故障窗口
    await sleep(500);
    console.log('[DB-POOL] Pool reset complete');
  })();

  try {
    await poolResetPromise;
  } finally {
    poolResetPromise = null;
  }
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * 检查错误是否可重试
 */
function isRetryableError(error: any): boolean {
  if (!error) return false;

  const retryableMessages = [
    'connection terminated unexpectedly',
    'connection terminated',
    'connection lost',
    'connection closed',
    'timeout',
    'ECONNRESET',
    'ENOTFOUND',
    'EHOSTUNREACH',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'cannot get a connection',
    'pool is destroyed',
    'cannot use a pool after calling end on the pool',  // 添加这个错误
    // Neon 特定错误
    'compute time limit exceeded',
    'too many connections',
    'connection limit exceeded',
    'database is temporarily unavailable',
    'server temporarily unavailable',
  ];

  const errorMessage = (error.message || '').toLowerCase();
  return retryableMessages.some(msg => errorMessage.includes(msg.toLowerCase()));
}

/**
 * 检查是否是Neon特定的连接错误
 */
function isNeonConnectionError(error: any): boolean {
  const neonErrors = [
    'compute time limit exceeded',
    'too many connections',
    'connection limit exceeded',
    'database is temporarily unavailable',
    'server temporarily unavailable',
    'connection terminated unexpectedly',
    'pool is destroyed',
  ];

  const errorMessage = (error.message || '').toLowerCase();
  return neonErrors.some(msg => errorMessage.includes(msg.toLowerCase()));
}

/**
 * 执行查询（带重试机制）
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[],
  maxRetries: number = 3
): Promise<QueryResult<T>> {
  const startTime = Date.now();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let client: PoolClient | null = null;
    const attemptStartTime = Date.now();

    try {
      const currentPool = getPool();

      // 获取客户端（添加时间监控）
      const connectStartTime = Date.now();
      client = await currentPool.connect();
      const connectTime = Date.now() - connectStartTime;

      if (connectTime > 3000) {
        console.warn(`[DB-POOL] Slow connection: ${connectTime}ms`);
      }

      // 执行查询（添加时间监控）
      const queryStartTime = Date.now();
      const result = await client.query<T>(text, params);
      const queryTime = Date.now() - queryStartTime;

      // 性能监控日志
      const totalTime = Date.now() - startTime;
      if (queryTime > 5000 || totalTime > 8000) {
        console.warn(`[DB-POOL] Slow query detected:`, {
          queryTime: `${queryTime}ms`,
          totalTime: `${totalTime}ms`,
          attempt,
          query: text.substring(0, 80) + (text.length > 80 ? '...' : ''),
        });
      }

      // 成功后重置错误计数
      consecutiveErrors = 0;

      return {
        rows: result.rows,
        rowCount: result.rowCount,
        command: result.command,
      };

    } catch (error) {
      lastError = error as Error;
      const attemptTime = Date.now() - attemptStartTime;

      console.error(`[DB-POOL] Query error (attempt ${attempt}/${maxRetries}):`, {
        error: lastError.message,
        attemptTime: `${attemptTime}ms`,
        query: text.substring(0, 100),
        isNeonError: isNeonConnectionError(error),
        isRetryable: isRetryableError(error),
      });

      // 如果是可重试的错误且不是最后一次尝试
      if (attempt < maxRetries && isRetryableError(error)) {
        // 检查是否是已关闭的 pool 错误
        const normalizedErrorMessage = (lastError.message || '').toLowerCase();
        const isClosedPoolError = normalizedErrorMessage.includes(CLOSED_POOL_ERROR);
        
        // 针对不同错误的特殊延迟策略
        let delayMs: number;
        if (isClosedPoolError) {
          // Pool 已关闭，立即重置并重试
          pool = null; // 直接设置为 null，让 getPool() 重新创建
          delayMs = withJitter(120); // 短暂延迟
        } else if (isNeonConnectionError(error)) {
          // Neon错误需要更长的等待时间
          delayMs = getRetryDelayMs(attempt, true);
          console.log(`[DB-POOL] Neon-specific error detected, longer retry delay: ${delayMs}ms`);

          // 重置连接池以处理Neon的连接状态问题
          await resetPool('neon_retry');
        } else {
          // 标准指数退避
          delayMs = getRetryDelayMs(attempt, false);
          
          // 如果是连接相关错误，重置连接池
          if (isConnectionError(error)) {
            await resetPool('connection_error_retry');
          }
        }
        await sleep(delayMs);

        continue;
      }

      // 不可重试或最后一次尝试失败
      break;

    } finally {
      // 始终释放客户端
      if (client) {
        try {
          client.release();
        } catch (releaseError) {
          console.error('[DB-POOL] Error releasing client:', releaseError);
        }
      }
    }
  }

  throw lastError || new Error('Query failed after retries');
}

/**
 * 检查是否是连接错误
 */
function isConnectionError(error: any): boolean {
  const connectionErrors = [
    'connection terminated',
    'connection lost',
    'connection closed',
    'ECONNRESET',
    'ECONNREFUSED',
    'pool is destroyed',
    'cannot use a pool after calling end on the pool',
  ];
  
  const errorMessage = (error.message || '').toLowerCase();
  return connectionErrors.some(msg => errorMessage.includes(msg.toLowerCase()));
}

/**
 * 执行事务
 */
export async function withTransaction<T>(
  callback: (queryFn: (text: string, params?: any[]) => Promise<QueryResult>) => Promise<T>
): Promise<T> {
  const currentPool = getPool();
  const client = await currentPool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 事务内的查询函数
    const queryFn = async (text: string, params?: any[]) => {
      const result = await client.query(text, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount,
        command: result.command,
      };
    };
    
    const result = await callback(queryFn);
    
    await client.query('COMMIT');
    return result;
    
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('[DB-POOL] Rollback error:', rollbackError);
    }
    throw error;
    
  } finally {
    client.release();
  }
}
