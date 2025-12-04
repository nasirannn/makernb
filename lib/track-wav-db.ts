import { query } from './db-query-builder';
import { validateRequiredParams } from './db-utils';
import {
  TrackWavConversion,
  CreateTrackWavConversionData,
  UpdateTrackWavConversionData
} from '@/types/track';

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Creates a new WAV conversion record
 */
export const createTrackWavConversion = async (
  data: CreateTrackWavConversionData
): Promise<TrackWavConversion> => {
  try {
    // 验证必需字段（支持驼峰和蛇形命名）
    const trackId = data.trackId || (data as any).track_id;
    const taskId = data.taskId || (data as any).task_id;
    
    if (!trackId || !taskId) {
      throw new Error('Missing required parameter: trackId and taskId are required');
    }

    const result = await query(
      `INSERT INTO track_wav_conversions (
        track_id, task_id, status, wav_url, wav_r2_url
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        trackId,
        taskId,
        data.status || 'generating',
        data.wavUrl || (data as any).wav_url || null,
        data.wavR2Url || (data as any).wav_r2_url || null
      ]
    );

    // 将数据库返回的蛇形命名转换为驼峰命名
    const row = result.rows[0];
    return {
      id: row.id,
      trackId: row.track_id,
      taskId: row.task_id,
      wavUrl: row.wav_url,
      wavR2Url: row.wav_r2_url,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  } catch (error) {
    console.error('Error creating track WAV conversion:', error);
    throw error;
  }
};

/**
 * Creates or updates a WAV conversion record (upsert)
 * If a record with the same task_id exists, it will be updated
 * Otherwise, a new record will be created
 */
export const upsertTrackWavConversion = async (
  data: CreateTrackWavConversionData
): Promise<TrackWavConversion> => {
  try {
    // 验证必需字段（支持驼峰和蛇形命名）
    const trackId = data.trackId || (data as any).track_id;
    const taskId = data.taskId || (data as any).task_id;
    
    if (!trackId || !taskId) {
      throw new Error('Missing required parameter: trackId and taskId are required');
    }

    const result = await query(
      `INSERT INTO track_wav_conversions (
        track_id, task_id, status, wav_url, wav_r2_url
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (task_id) 
      DO UPDATE SET
        track_id = EXCLUDED.track_id,
        status = EXCLUDED.status,
        wav_url = COALESCE(EXCLUDED.wav_url, track_wav_conversions.wav_url),
        wav_r2_url = COALESCE(EXCLUDED.wav_r2_url, track_wav_conversions.wav_r2_url),
        updated_at = NOW()
      RETURNING *`,
      [
        trackId,
        taskId,
        data.status || 'generating',
        data.wavUrl || (data as any).wav_url || null,
        data.wavR2Url || (data as any).wav_r2_url || null
      ]
    );

    // 将数据库返回的蛇形命名转换为驼峰命名
    const row = result.rows[0];
    return {
      id: row.id,
      trackId: row.track_id,
      taskId: row.task_id,
      wavUrl: row.wav_url,
      wavR2Url: row.wav_r2_url,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  } catch (error) {
    console.error('Error upserting track WAV conversion:', error);
    throw error;
  }
};

/**
 * Gets WAV conversion by task_id
 */
export const getTrackWavConversionByTaskId = async (
  taskId: string
): Promise<TrackWavConversion | null> => {
  try {
    validateRequiredParams({ taskId }, ['taskId']);

    const result = await query(
      'SELECT * FROM track_wav_conversions WHERE task_id = $1',
      [taskId]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting track WAV conversion by task_id:', error);
    throw error;
  }
};

/**
 * Gets WAV conversion by track_id (gets the latest valid conversion)
 */
export const getTrackWavConversionByTrackId = async (
  trackId: string
): Promise<TrackWavConversion | null> => {
  try {
    validateRequiredParams({ trackId }, ['trackId']);

    // 获取最新的有效WAV转换（成功状态）
    const result = await query(
      `SELECT * FROM track_wav_conversions 
       WHERE track_id = $1 
         AND status = 'completed'
       ORDER BY created_at DESC 
       LIMIT 1`,
      [trackId]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting track WAV conversion by track_id:', error);
    throw error;
  }
};

/**
 * Updates WAV conversion record by task_id
 */
export const updateTrackWavConversionByTaskId = async (
  taskId: string,
  data: UpdateTrackWavConversionData
): Promise<TrackWavConversion> => {
  try {
    validateRequiredParams({ taskId }, ['taskId']);

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // 支持驼峰和蛇形命名
    const wavUrl = data.wavUrl !== undefined ? data.wavUrl : (data as any).wav_url;
    const wavR2Url = data.wavR2Url !== undefined ? data.wavR2Url : (data as any).wav_r2_url;

    if (wavUrl !== undefined) {
      updateFields.push(`wav_url = $${paramIndex++}`);
      values.push(wavUrl);
    }

    if (wavR2Url !== undefined) {
      updateFields.push(`wav_r2_url = $${paramIndex++}`);
      values.push(wavR2Url);
    }

    if (data.status !== undefined && data.status !== null) {
      // 验证 status 值是否符合数据库约束
      const validStatuses = ['generating', 'completed', 'error', 'expired'];
      if (!validStatuses.includes(data.status)) {
        throw new Error(`Invalid status value: ${data.status}. Must be one of: ${validStatuses.join(', ')}`);
      }
      updateFields.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    // 添加 updated_at
    updateFields.push('updated_at = NOW()');
    values.push(taskId);

    const result = await query(
      `UPDATE track_wav_conversions 
       SET ${updateFields.join(', ')} 
       WHERE task_id = $${paramIndex} 
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Track WAV conversion not found');
    }

    // 将数据库返回的蛇形命名转换为驼峰命名
    const row = result.rows[0];
    return {
      id: row.id,
      trackId: row.track_id,
      taskId: row.task_id,
      wavUrl: row.wav_url,
      wavR2Url: row.wav_r2_url,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  } catch (error) {
    console.error('Error updating track WAV conversion by task_id:', error);
    throw error;
  }
};

/**
 * Gets all valid WAV conversions for a track (including expired ones)
 */
export const getTrackWavConversionsByTrackId = async (
  trackId: string
): Promise<TrackWavConversion[]> => {
  try {
    validateRequiredParams({ trackId }, ['trackId']);

    const result = await query(
      `SELECT * FROM track_wav_conversions 
       WHERE track_id = $1 
       ORDER BY created_at DESC`,
      [trackId]
    );

    return result.rows;
  } catch (error) {
    console.error('Error getting track WAV conversions by track_id:', error);
    throw error;
  }
};

/**
 * Deletes a WAV conversion record by ID
 * Use this for cleanup operations
 */
export const deleteTrackWavConversion = async (
  conversionId: string
): Promise<boolean> => {
  try {
    validateRequiredParams({ conversionId }, ['conversionId']);

    const result = await query(
      'DELETE FROM track_wav_conversions WHERE id = $1 RETURNING id',
      [conversionId]
    );

    return result.rows.length > 0;
  } catch (error) {
    console.error('Error deleting track WAV conversion:', error);
    throw error;
  }
};

/**
 * Gets WAV conversion status by track_id
 * Returns the status of the latest conversion attempt
 */
export const getTrackWavConversionStatus = async (
  trackId: string
): Promise<'none' | 'generating' | 'completed' | 'error' | 'expired'> => {
  try {
    const conversion = await getTrackWavConversionByTrackId(trackId);
    
    if (!conversion) {
      // 检查是否有其他转换记录（可能是失败的）
      const allConversions = await getTrackWavConversionsByTrackId(trackId);
      if (allConversions.length === 0) {
        return 'none';
      }
      // 返回最新记录的状态
      return allConversions[0].status as any;
    }

    return conversion.status as any;
  } catch (error) {
    console.error('Error getting track WAV conversion status:', error);
    return 'none';
  }
};

