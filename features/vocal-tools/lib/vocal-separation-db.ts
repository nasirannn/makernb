import { query } from '@/lib/db-query-builder';
import { validateRequiredParams, buildUpdateClause } from '@/lib/db-utils';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface VocalSeparation {
  id: string;
  user_id: string;
  prediction_id: string; // Replicate预测ID
  status: 'processing' | 'completed' | 'error';
  original_audio_url?: string;
  vocal_audio_url?: string;
  instrumental_audio_url?: string;
  created_at: string;
  updated_at: string;
  original_filename: string;
}

export interface CreateVocalSeparationData {
  prediction_id: string;
  status?: 'processing' | 'completed' | 'error';
  original_audio_url?: string;
  vocal_audio_url?: string;
  instrumental_audio_url?: string;
  original_filename: string;
}

export interface VocalSeparationWithTrack {
  id: string;
  user_id: string;
  prediction_id: string;
  status: 'processing' | 'completed' | 'error';
  original_audio_url?: string;
  vocal_audio_url?: string;
  instrumental_audio_url?: string;
  created_at: string;
  updated_at: string;
  original_filename: string;
  // 关联的原始轨道信息
  original_track?: {
    id: string;
    title: string;
    audio_url: string;
    duration: number;
  };
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Creates a new vocal separation record
 */
export const createVocalSeparation = async (
  userId: string,
  data: CreateVocalSeparationData
): Promise<VocalSeparation> => {
  try {
    validateRequiredParams({ userId }, ['userId']);

    const result = await query(
      `INSERT INTO vocal_separations (
        user_id, prediction_id, status, original_audio_url, vocal_audio_url, instrumental_audio_url,
        original_filename
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        userId,
        data.prediction_id,
        data.status || 'processing',
        data.original_audio_url || null,
        data.vocal_audio_url || null,
        data.instrumental_audio_url || null,
        data.original_filename
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error creating vocal separation:', error);
    throw error;
  }
};

/**
 * Gets vocal separation by prediction_id
 */
export const getVocalSeparationByPredictionId = async (predictionId: string): Promise<VocalSeparation | null> => {
  try {
    validateRequiredParams({ predictionId }, ['predictionId']);

    const result = await query(
      'SELECT * FROM vocal_separations WHERE prediction_id = $1',
      [predictionId]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting vocal separation by prediction_id:', error);
    throw error;
  }
};

/**
 * Gets latest vocal separation by original audio URL (cache lookup)
 */
export const getLatestVocalSeparationByOriginalAudioUrl = async (
  userId: string,
  originalAudioUrl: string
): Promise<VocalSeparation | null> => {
  try {
    validateRequiredParams({ userId, originalAudioUrl }, ['userId', 'originalAudioUrl']);

    const result = await query(
      `SELECT *
       FROM vocal_separations
       WHERE user_id = $1::uuid
         AND original_audio_url = $2
       ORDER BY updated_at DESC NULLS LAST, created_at DESC
       LIMIT 1`,
      [userId, originalAudioUrl]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting vocal separation by original_audio_url:', error);
    throw error;
  }
};

/**
 * Updates vocal separation record by task_id
 */
export const updateVocalSeparationByPredictionId = async (
  predictionId: string,
  data: Partial<VocalSeparation>
): Promise<VocalSeparation> => {
  try {
    validateRequiredParams({ predictionId }, ['predictionId']);

    const excludeFields = ['id', 'user_id', 'created_at'];
    const { setClause, values } = buildUpdateClause(data, excludeFields);

    const result = await query(
      `UPDATE vocal_separations SET ${setClause}, updated_at = NOW() WHERE prediction_id = $1 RETURNING *`,
      [predictionId, ...values]
    );

    if (result.rows.length === 0) {
      throw new Error('Vocal separation not found');
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error updating vocal separation by prediction_id:', error);
    throw error;
  }
};

/**
 * Gets user's vocal separations with original track info
 */
export const getUserVocalSeparations = async (
  userId: string,
  _limit: number = 10,
  _offset: number = 0
): Promise<VocalSeparationWithTrack[]> => {
  try {
    // 历史记录已关闭：不做持久化，直接返回空列表以避免访问不存在的列
    // 这样也避免了与旧schema (original_track_id 等) 的不兼容查询
    validateRequiredParams({ userId }, ['userId']);
    return [];
  } catch (error) {
    console.error('Error getting user vocal separations:', error);
    throw error;
  }
};

/**
 * Deletes a vocal separation record
 */
export const deleteVocalSeparation = async (separationId: string, userId: string): Promise<boolean> => {
  try {
    validateRequiredParams({ separationId, userId }, ['separationId', 'userId']);

    const result = await query(
      `DELETE FROM vocal_separations
       WHERE id = $1 AND user_id = $2::uuid
       RETURNING id`,
      [separationId, userId]
    );

    return result.rows.length > 0;
  } catch (error) {
    console.error('Error deleting vocal separation:', error);
    throw error;
  }
};

/**
 * Gets vocal separation by ID
 */
export const getVocalSeparationById = async (
  separationId: string,
  userId: string
): Promise<VocalSeparation | null> => {
  try {
    validateRequiredParams({ separationId, userId }, ['separationId', 'userId']);

    const result = await query(
      `SELECT *
       FROM vocal_separations
       WHERE id = $1 AND user_id = $2::uuid`,
      [separationId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error getting vocal separation by ID:', error);
    throw error;
  }
};

/**
 * Gets all vocal separation audio URLs for cleanup
 */
export const getAllVocalSeparationAudioUrls = async (): Promise<string[]> => {
  try {
    const result = await query(
      `SELECT
        COALESCE(original_audio_url, '') as original_audio_url,
        COALESCE(vocal_audio_url, '') as vocal_audio_url,
        COALESCE(instrumental_audio_url, '') as instrumental_audio_url
      FROM vocal_separations`
    );

    const urls: string[] = [];
    
    result.rows.forEach(row => {
      if (row.original_audio_url) urls.push(row.original_audio_url);
      if (row.vocal_audio_url) urls.push(row.vocal_audio_url);
      if (row.instrumental_audio_url) urls.push(row.instrumental_audio_url);
    });

    return urls.filter(url => url && url.trim() !== '');
  } catch (error) {
    console.error('Error getting all vocal separation audio URLs:', error);
    throw error;
  }
};
