import { query } from './db-query-builder';
import { 
  TrackWavConversion, 
  CreateTrackWavConversionData, 
  UpdateTrackWavConversionData 
} from '@/types/track';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validates required parameters for database operations
 */
const validateRequiredParams = (params: Record<string, any>, requiredFields: string[]): void => {
  for (const field of requiredFields) {
    if (!params[field]) {
      throw new Error(`Missing required parameter: ${field}`);
    }
  }
};


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
    validateRequiredParams(data, ['track_id', 'task_id']);

    const result = await query(
      `INSERT INTO track_wav_conversions (
        track_id, task_id, status, wav_url, wav_r2_url
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        data.track_id,
        data.task_id,
        data.status || 'generating',
        data.wav_url || null,
        data.wav_r2_url || null
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error creating track WAV conversion:', error);
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
         AND status = 'complete'
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

    if (data.wav_url !== undefined) {
      updateFields.push(`wav_url = $${paramIndex++}`);
      values.push(data.wav_url);
    }

    if (data.wav_r2_url !== undefined) {
      updateFields.push(`wav_r2_url = $${paramIndex++}`);
      values.push(data.wav_r2_url);
    }

    if (data.status !== undefined) {
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

    return result.rows[0];
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
): Promise<'none' | 'generating' | 'complete' | 'error' | 'expired'> => {
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

