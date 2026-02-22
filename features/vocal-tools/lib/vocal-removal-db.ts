import { query } from '@/lib/db-query-builder';
import { validateRequiredParams, buildUpdateClause } from '@/lib/db-utils';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface VocalRemoval {
  id: string;
  user_id: string;
  track_id: string;
  music_id?: string;
  track_title?: string;
  track_audio_url?: string;
  task_id: string; // KIE API任务ID
  audio_id: string; // Original audio's audioId
  separation_type?: 'separate_vocal' | 'split_stem';
  status: 'processing' | 'completed' | 'error';
  vocal_url?: string; // 临时 URL (from KIE API)
  instrumental_url?: string; // 临时 URL (from KIE API, renamed from accompaniment_url)
  stems_data?: Record<string, string> | null; // split_stem 的多轨 URL
  r2_vocal_url?: string; // R2 持久化 URL
  r2_instrumental_url?: string; // R2 持久化 URL
  error_code?: string | null;
  error_message?: string | null;
  is_deleted?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateVocalRemovalData {
  track_id: string;
  music_id?: string;
  task_id: string;
  audio_id: string;
  separation_type?: 'separate_vocal' | 'split_stem';
  status?: 'processing' | 'completed' | 'error';
  vocal_url?: string;
  instrumental_url?: string;
  stems_data?: Record<string, string> | null;
  r2_vocal_url?: string;
  r2_instrumental_url?: string;
}

export interface VocalRemovalWithTrack {
  id: string;
  user_id: string;
  track_id: string;
  music_id?: string;
  track_title?: string;
  track_audio_url?: string;
  task_id: string;
  audio_id: string;
  separation_type?: 'separate_vocal' | 'split_stem';
  status: 'processing' | 'completed' | 'error';
  vocal_url?: string; // 临时 URL (from KIE API)
  instrumental_url?: string; // 临时 URL (from KIE API)
  stems_data?: Record<string, string> | null;
  r2_vocal_url?: string; // R2 持久化 URL
  r2_instrumental_url?: string; // R2 持久化 URL
  error_code?: string | null;
  error_message?: string | null;
  is_deleted?: boolean;
  created_at: string;
  updated_at: string;
  // 关联的原始轨道信息
  original_track?: {
    id: string;
    title: string;
    audioUrl: string;
    duration: number;
  };
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Creates a new vocal removal record
 */
export const createVocalRemoval = async (
  userId: string,
  data: CreateVocalRemovalData
): Promise<VocalRemoval> => {
  try {
    validateRequiredParams({ userId }, ['userId']);

    const result = await query(
      `INSERT INTO vocal_removals (
        user_id, track_id, music_id, task_id, audio_id, separation_type, status, 
        vocal_url, instrumental_url, stems_data, r2_vocal_url, r2_instrumental_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)
      RETURNING *`,
      [
        userId,
        data.track_id,
        data.music_id || null,
        data.task_id,
        data.audio_id,
        data.separation_type || 'separate_vocal',
        data.status || 'processing',
        data.vocal_url || null,
        data.instrumental_url || null,
        data.stems_data ? JSON.stringify(data.stems_data) : null,
        data.r2_vocal_url || null,
        data.r2_instrumental_url || null
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error creating vocal removal:', error);
    throw error;
  }
};

/**
 * Gets vocal removal by task_id
 */
export const getVocalRemovalByTaskId = async (taskId: string): Promise<VocalRemoval | null> => {
  try {
    validateRequiredParams({ taskId }, ['taskId']);

    const result = await query(
      `SELECT * FROM vocal_removals 
       WHERE task_id = $1`,
      [taskId]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting vocal removal by task_id:', error);
    throw error;
  }
};

/**
 * Updates vocal removal record by task_id
 */
export const updateVocalRemovalByTaskId = async (
  taskId: string,
  data: Partial<VocalRemoval>
): Promise<VocalRemoval> => {
  try {
    validateRequiredParams({ taskId }, ['taskId']);

    const excludeFields = ['id', 'user_id', 'created_at'];
    const { setClause, values } = buildUpdateClause(data, excludeFields);

    const result = await query(
      `UPDATE vocal_removals SET ${setClause}, updated_at = NOW() WHERE task_id = $1 RETURNING *`,
      [taskId, ...values]
    );

    if (result.rows.length === 0) {
      throw new Error('Vocal removal not found');
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error updating vocal removal by task_id:', error);
    throw error;
  }
};

/**
 * Gets vocal removals by track_id
 */
export const getVocalRemovalsByTrackId = async (
  trackId: string,
  userId?: string
): Promise<VocalRemoval[]> => {
  try {
    validateRequiredParams({ trackId }, ['trackId']);

    let queryString = `
      SELECT * FROM vocal_removals 
      WHERE track_id = $1::uuid
        AND (is_deleted IS NULL OR is_deleted = FALSE)
      ORDER BY created_at DESC
    `;
    const params: any[] = [trackId];

    if (userId) {
      queryString = `
        SELECT * FROM vocal_removals 
        WHERE track_id = $1::uuid
          AND user_id = $2::uuid
          AND (is_deleted IS NULL OR is_deleted = FALSE)
        ORDER BY created_at DESC
      `;
      params.push(userId);
    }

    const result = await query(queryString, params);
    return result.rows;
  } catch (error) {
    console.error('Error getting vocal removals by track_id:', error);
    throw error;
  }
};

/**
 * Gets user's vocal removals
 */
export const getUserVocalRemovals = async (
  userId: string,
  limit: number = 10,
  offset: number = 0
): Promise<VocalRemoval[]> => {
  try {
    validateRequiredParams({ userId }, ['userId']);

    try {
      const result = await query(
        `SELECT
          vr.*,
          COALESCE(NULLIF(mt.title, ''), NULLIF(m.title, ''), NULL) AS track_title,
          NULLIF(mt.audio_url, '') AS track_audio_url
         FROM vocal_removals vr
         LEFT JOIN tracks mt ON vr.track_id = mt.id
         LEFT JOIN music m ON vr.music_id = m.id
         WHERE vr.user_id = $1::uuid
           AND (vr.is_deleted IS NULL OR vr.is_deleted = FALSE)
         ORDER BY vr.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      return result.rows;
    } catch (joinQueryError) {
      const errorCode = (joinQueryError as { code?: string })?.code;
      // Fallback query: avoid hard dependency on joined tables when schema differs across environments.
      if (errorCode === '42P01' || errorCode === '42703' || errorCode === '42883') {
        console.warn('Fallback to base vocal_removals query due to join query error:', joinQueryError);
        const fallbackResult = await query(
          `SELECT
            vr.*,
            NULL::text AS track_title,
            NULL::text AS track_audio_url
           FROM vocal_removals vr
           WHERE vr.user_id = $1::uuid
             AND (vr.is_deleted IS NULL OR vr.is_deleted = FALSE)
           ORDER BY vr.created_at DESC
           LIMIT $2 OFFSET $3`,
          [userId, limit, offset]
        );

        return fallbackResult.rows;
      }

      throw joinQueryError;
    }
  } catch (error) {
    console.error('Error getting user vocal removals:', error);
    throw error;
  }
};

/**
 * Gets vocal removal by ID
 */
export const getVocalRemovalById = async (
  removalId: string,
  userId: string
): Promise<VocalRemovalWithTrack | null> => {
  try {
    validateRequiredParams({ removalId, userId }, ['removalId', 'userId']);

    const result = await query(`
      SELECT 
        vr.*,
        mt.id as track_id,
        mt.title as track_title,
        mt.audio_url as track_audio_url,
        mt.duration as track_duration
      FROM vocal_removals vr
      LEFT JOIN tracks mt ON vr.track_id = mt.id
        AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
      WHERE vr.id = $1
        AND vr.user_id = $2::uuid
        AND (vr.is_deleted IS NULL OR vr.is_deleted = FALSE)
    `, [removalId, userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      user_id: row.user_id,
      track_id: row.track_id,
      music_id: row.music_id,
      task_id: row.task_id,
      audio_id: row.audio_id,
      status: row.status,
      vocal_url: row.vocal_url,
      instrumental_url: row.instrumental_url,
      stems_data: row.stems_data,
      separation_type: row.separation_type,
      r2_vocal_url: row.r2_vocal_url,
      r2_instrumental_url: row.r2_instrumental_url,
      error_code: row.error_code || null,
      error_message: row.error_message || null,
      is_deleted: row.is_deleted ?? false,
      created_at: row.created_at,
      updated_at: row.updated_at,
      original_track: row.track_id ? {
        id: row.track_id,
        title: row.track_title,
        audioUrl: row.track_audio_url,
        duration: row.track_duration
      } : undefined
    };
  } catch (error) {
    console.error('Error getting vocal removal by ID:', error);
    throw error;
  }
};

/**
 * Deletes a vocal removal record (logical delete)
 */
export const deleteVocalRemoval = async (removalId: string, userId: string): Promise<boolean> => {
  try {
    validateRequiredParams({ removalId, userId }, ['removalId', 'userId']);

    const result = await query(
      `UPDATE vocal_removals
       SET is_deleted = TRUE, updated_at = NOW()
       WHERE id = $1
         AND user_id = $2::uuid
         AND (is_deleted IS NULL OR is_deleted = FALSE)
       RETURNING id`,
      [removalId, userId]
    );

    return result.rows.length > 0;
  } catch (error) {
    console.error('Error deleting vocal removal:', error);
    throw error;
  }
};

/**
 * Gets all vocal removal audio URLs for cleanup
 */
export const getAllVocalRemovalAudioUrls = async (): Promise<string[]> => {
  try {
    const result = await query(`
      SELECT 
        COALESCE(vocal_url, '') as vocal_url,
        COALESCE(instrumental_url, '') as instrumental_url,
        stems_data,
        COALESCE(r2_vocal_url, '') as r2_vocal_url,
        COALESCE(r2_instrumental_url, '') as r2_instrumental_url
      FROM vocal_removals
    `);

    const urls: string[] = [];
    
    result.rows.forEach(row => {
      // 优先使用 R2 URL，如果没有则使用临时 URL
      if (row.r2_vocal_url) urls.push(row.r2_vocal_url);
      else if (row.vocal_url) urls.push(row.vocal_url);
      
      if (row.r2_instrumental_url) urls.push(row.r2_instrumental_url);
      else if (row.instrumental_url) urls.push(row.instrumental_url);

      // split_stem 多轨 URL
      if (row.stems_data && typeof row.stems_data === 'object') {
        Object.values(row.stems_data).forEach((url) => {
          if (typeof url === 'string' && url.trim()) {
            urls.push(url);
          }
        });
      }
    });

    return urls.filter(url => url && url.trim() !== '');
  } catch (error) {
    console.error('Error getting all vocal removal audio URLs:', error);
    throw error;
  }
};
