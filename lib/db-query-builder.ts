import { query, batchQuery, withTransaction } from './db-pool';
import type { QueryResultRow } from 'pg';

// ============================================================================
// QUERY BUILDER UTILITIES
// ============================================================================

interface WhereCondition {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'IN' | 'NOT IN' | 'LIKE' | 'ILIKE' | 'IS NULL' | 'IS NOT NULL';
  value?: any;
}

interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

/**
 * Build WHERE clause from conditions
 */
export const buildWhereClause = (conditions: WhereCondition[]): { clause: string; values: any[] } => {
  if (conditions.length === 0) {
    return { clause: '', values: [] };
  }

  const clauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const condition of conditions) {
    const { field, operator, value } = condition;

    switch (operator) {
      case 'IS NULL':
      case 'IS NOT NULL':
        clauses.push(`${field} ${operator}`);
        break;
      case 'IN':
      case 'NOT IN':
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map(() => `$${paramIndex++}`).join(', ');
          clauses.push(`${field} ${operator} (${placeholders})`);
          values.push(...value);
        }
        break;
      default:
        clauses.push(`${field} ${operator} $${paramIndex++}`);
        values.push(value);
    }
  }

  return {
    clause: `WHERE ${clauses.join(' AND ')}`,
    values
  };
};

/**
 * Build ORDER BY and LIMIT clauses
 */
export const buildQuerySuffix = (options: QueryOptions): string => {
  const parts: string[] = [];

  if (options.orderBy) {
    parts.push(`ORDER BY ${options.orderBy} ${options.orderDirection || 'ASC'}`);
  }

  if (options.limit) {
    parts.push(`LIMIT ${options.limit}`);
  }

  if (options.offset) {
    parts.push(`OFFSET ${options.offset}`);
  }

  return parts.join(' ');
};

// ============================================================================
// OPTIMIZED QUERY FUNCTIONS
// ============================================================================

/**
 * Generic select query with conditions and options
 */
export const selectQuery = async <T extends QueryResultRow = any>(
  table: string,
  fields: string[] = ['*'],
  conditions: WhereCondition[] = [],
  options: QueryOptions = {}
): Promise<T[]> => {
  const { clause: whereClause, values } = buildWhereClause(conditions);
  const suffix = buildQuerySuffix(options);

  const sql = `
    SELECT ${fields.join(', ')}
    FROM ${table}
    ${whereClause}
    ${suffix}
  `.trim();

  const result = await query<T>(sql, values);
  return result.rows;
};

/**
 * Count query with conditions
 */
export const countQuery = async (
  table: string,
  conditions: WhereCondition[] = []
): Promise<number> => {
  const { clause: whereClause, values } = buildWhereClause(conditions);

  const sql = `
    SELECT COUNT(*) as count
    FROM ${table}
    ${whereClause}
  `.trim();

  const result = await query<{ count: string }>(sql, values);
  return parseInt(result.rows[0].count, 10);
};

/**
 * Insert query with returning
 */
export const insertQuery = async <T extends QueryResultRow = any>(
  table: string,
  data: Record<string, any>,
  returning: string[] = ['*']
): Promise<T> => {
  const fields = Object.keys(data);
  const values = Object.values(data);
  const placeholders = values.map((_, index) => `$${index + 1}`);

  const sql = `
    INSERT INTO ${table} (${fields.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING ${returning.join(', ')}
  `;

  const result = await query<T>(sql, values);
  return result.rows[0];
};

/**
 * Update query with conditions
 */
export const updateQuery = async <T extends QueryResultRow = any>(
  table: string,
  data: Record<string, any>,
  conditions: WhereCondition[],
  returning: string[] = ['*']
): Promise<T[]> => {
  const fields = Object.keys(data);
  const values = Object.values(data);

  // Build SET clause
  const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');

  // Build WHERE clause (parameters start after SET values)
  const { clause: whereClause, values: whereValues } = buildWhereClause(conditions);
  const adjustedWhereClause = whereClause.replace(/\$(\d+)/g, (match, num) => {
    return `$${parseInt(num) + fields.length}`;
  });

  const sql = `
    UPDATE ${table}
    SET ${setClause}, updated_at = NOW()
    ${adjustedWhereClause}
    RETURNING ${returning.join(', ')}
  `;

  const result = await query<T>(sql, [...values, ...whereValues]);
  return result.rows;
};

/**
 * Delete query with conditions
 */
export const deleteQuery = async (
  table: string,
  conditions: WhereCondition[]
): Promise<number> => {
  const { clause: whereClause, values } = buildWhereClause(conditions);

  const sql = `
    DELETE FROM ${table}
    ${whereClause}
  `;

  const result = await query(sql, values);
  return result.rowCount || 0;
};

// ============================================================================
// OPTIMIZED MUSIC QUERIES
// ============================================================================

/**
 * Get user music generations with efficient pagination
 */
export const getUserMusicGenerationsOptimized = async (
  userId: string,
  limit: number = 10,
  offset: number = 0
) => {
  // Single optimized query with proper JOINs and indexing
  // 只返回至少有一个未删除 track 的 music 记录
  const sql = `
    WITH user_generations AS (
      SELECT DISTINCT mg.id, mg.title, mg.genre, mg.tags, mg.prompt, mg.is_instrumental, mg.status, mg.model, mg.created_at, mg.updated_at,
             mg.original_music_id, mg.type
      FROM music mg
      INNER JOIN tracks mt ON mg.id = mt.music_id
      WHERE mg.user_id = $1::uuid
        AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
      ORDER BY mg.created_at DESC
      LIMIT $2 OFFSET $3
    ),
    generation_tracks AS (
      SELECT
        ug.id as generation_id,
        ug.title, ug.genre, ug.tags, ug.prompt, ug.is_instrumental, ug.status, ug.model,
        ug.created_at as generation_created_at, ug.updated_at as generation_updated_at,
        ug.original_music_id, ug.type,
        mt.id as track_id, mt.suno_track_id, mt.audio_url, mt.stream_audio_url, mt.duration,
        mt.is_published, mt.is_pinned, mt.created_at as track_created_at,
        mt.cover_image_url as cover_r2_url,
        mt.original_track_id,
        mt.source_type,
        COALESCE(mt.title, ug.title) as track_title,
        ml.content as lyrics_content,
        uf.created_at as favorited_at,
        COALESCE(omt.title, omg.title) as original_track_title
      FROM user_generations ug
      LEFT JOIN tracks mt ON ug.id = mt.music_id
        AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
      LEFT JOIN lyrics ml ON ug.id = ml.music_id
      LEFT JOIN tracks omt ON mt.original_track_id = omt.id
      LEFT JOIN music omg ON ug.original_music_id = omg.id
      LEFT JOIN user_favorites uf ON uf.track_id = mt.id AND uf.user_id = $1::uuid
    ),
    error_info AS (
      SELECT reference_id, error_message, error_code, created_at
      FROM generation_errors
      WHERE error_type = 'music_generation'
        AND reference_id IN (SELECT id::text FROM user_generations)
    )
    SELECT gt.*, ei.error_message, ei.error_code
    FROM generation_tracks gt
    LEFT JOIN error_info ei ON gt.generation_id::text = ei.reference_id
    ORDER BY gt.generation_created_at DESC, gt.track_id ASC
  `;

  const result = await query(sql, [userId, limit, offset]);
  return result.rows;
};

/**
 * Batch check favorites for multiple tracks
 */
export const batchCheckFavorites = async (userId: string, trackIds: string[]): Promise<Record<string, boolean>> => {
  if (trackIds.length === 0) return {};

  const sql = `
    SELECT track_id
    FROM user_favorites
    WHERE user_id = $1::uuid AND track_id = ANY($2)
  `;

  const result = await query<{ track_id: string }>(sql, [userId, trackIds]);
  const favoriteSet = new Set(result.rows.map(row => row.track_id));

  // Return a map with all track IDs
  const favorites: Record<string, boolean> = {};
  trackIds.forEach(id => {
    favorites[id] = favoriteSet.has(id);
  });

  return favorites;
};

/**
 * Get credits with transaction history in one query
 */
export const getUserCreditsWithHistory = async (userId: string, transactionLimit: number = 10) => {
  const queries = [
    {
      text: 'SELECT * FROM user_credits WHERE user_id = $1::uuid',
      params: [userId]
    },
    {
      text: `
        SELECT transaction_type, amount, balance_after, description, reference_id, created_at
        FROM credit_transactions
        WHERE user_id = $1::uuid
        ORDER BY created_at DESC
        LIMIT $2
      `,
      params: [userId, transactionLimit]
    }
  ];

  const results = await batchQuery(queries);
  return {
    credits: results[0].rows[0] || null,
    transactions: results[1].rows
  };
};

// ============================================================================
// CACHING UTILITIES
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();

  set(key: string, data: T, ttlMs: number = 300000): void { // 5 minutes default
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Global cache instances
export const queryCache = new SimpleCache<any>();
export const userCache = new SimpleCache<any>();

/**
 * Clear cache for specific user's music data
 */
export const clearUserMusicCache = (userId: string): void => {
  // Clear all cache entries that start with user-music:userId
  const keysToDelete: string[] = [];
  const cache = queryCache['cache'] as Map<string, CacheEntry<any>>;
  
  Array.from(cache.keys()).forEach(key => {
    if (key.startsWith(`user-music:${userId}:`)) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => {
    cache.delete(key);
  });
  
  console.log(`[CACHE] Cleared ${keysToDelete.length} cache entries for user ${userId}`);
};

// ============================================================================
// EXPORTS
// ============================================================================

// Re-export Neon-optimized database functions
export { 
  query, 
  withTransaction, 
  getPoolStats, 
  testConnection, 
  batchQuery,
  closePool 
} from './db-pool';

// Export pool for backward compatibility
export { pool_legacy as pool } from './db-pool';
