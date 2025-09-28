import { Client } from 'pg';

// 创建数据库连接函数 - 使用单连接而不是连接池
const createConnection = () => {
  return new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    // 优化连接配置
    connectionTimeoutMillis: 15000, // 15秒连接超时
    query_timeout: 30000, // 30秒查询超时
    statement_timeout: 30000, // 30秒语句超时
  });
};

// 导出查询函数 - 简化版本，每次创建新连接
export const query = async (text: string, params?: any[], retries = 2) => {
  let lastError: Error;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const client = createConnection();

    try {
      // 连接到数据库
      await client.connect();

      // 执行查询
      const result = await client.query(text, params);

      return result;
    } catch (error) {
      lastError = error as Error;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error(`Database query error (attempt ${attempt}/${retries}):`, {
        text: text.substring(0, 100),
        error: errorMessage,
        attempt,
        retries
      });

      // 如果不是最后一次尝试，等待后重试
      if (attempt < retries) {
        const delay = 1000 * attempt; // 1秒, 2秒
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } finally {
      // 确保连接被关闭
      try {
        await client.end();
      } catch (endError) {
        // 忽略关闭连接时的错误
      }
    }
  }

  throw lastError!;
};

// 测试数据库连接
export const testConnection = async () => {
  try {
    const result = await query('SELECT NOW() as current_time, version() as db_version');
    console.log('Database connected successfully:', {
      time: result.rows[0].current_time,
      version: result.rows[0].db_version.split(' ')[0] // 只显示PostgreSQL版本号
    });
    return true;
  } catch (error) {
    console.error('Database connection failed:', error instanceof Error ? error.message : String(error));
    return false;
  }
};

// 事务执行函数
export const withTransaction = async <T>(
  callback: (queryFn: (text: string, params?: any[]) => Promise<any>) => Promise<T>
): Promise<T> => {
  const client = createConnection();

  try {
    await client.connect();
    await client.query('BEGIN');

    // 创建一个查询函数，传递给回调
    const queryFn = async (text: string, params?: any[]) => {
      return await client.query(text, params);
    };

    const result = await callback(queryFn);

    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
    throw error;
  } finally {
    try {
      await client.end();
    } catch (endError) {
      // 忽略关闭连接时的错误
    }
  }
};

// 创建一个简单的连接池替代品（用于向后兼容）
export const pool = {
  totalCount: 0,
  idleCount: 0,
  waitingCount: 0,
  async connect() {
    // 为了向后兼容，返回一个模拟的客户端
    const client = createConnection();
    await client.connect();
    return {
      ...client,
      query: client.query.bind(client),
      release: () => client.end()
    };
  },
  async end() {
    console.log('Connection pool ended (no-op)');
  }
};
