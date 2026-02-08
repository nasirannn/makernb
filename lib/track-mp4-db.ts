import { query } from './db-query-builder';
import { validateRequiredParams } from './db-utils';
import {
  TrackMp4Generation,
  CreateTrackMp4GenerationData,
  UpdateTrackMp4GenerationData,
} from '@/types/track';

/**
 * Creates or updates an MP4 generation record by task_id
 */
export const upsertTrackMp4Generation = async (
  data: CreateTrackMp4GenerationData
): Promise<TrackMp4Generation> => {
  try {
    const trackId = data.trackId || (data as any).track_id;
    const taskId = data.taskId || (data as any).task_id;

    if (!trackId || !taskId) {
      throw new Error('Missing required parameter: trackId and taskId are required');
    }

    const result = await query(
      `INSERT INTO track_mp4_generations (
        track_id, task_id, status, video_url
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT (task_id)
      DO UPDATE SET
        track_id = EXCLUDED.track_id,
        status = EXCLUDED.status,
        video_url = COALESCE(EXCLUDED.video_url, track_mp4_generations.video_url),
        updated_at = NOW()
      RETURNING *`,
      [
        trackId,
        taskId,
        data.status || 'generating',
        data.videoUrl || (data as any).video_url || null,
      ]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      trackId: row.track_id,
      taskId: row.task_id,
      videoUrl: row.video_url,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (error) {
    console.error('Error upserting track MP4 generation:', error);
    throw error;
  }
};

/**
 * Gets MP4 generation by task_id
 */
export const getTrackMp4GenerationByTaskId = async (
  taskId: string
): Promise<TrackMp4Generation | null> => {
  try {
    validateRequiredParams({ taskId }, ['taskId']);

    const result = await query(
      'SELECT * FROM track_mp4_generations WHERE task_id = $1',
      [taskId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      trackId: row.track_id,
      taskId: row.task_id,
      videoUrl: row.video_url,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (error) {
    console.error('Error getting track MP4 generation by task_id:', error);
    throw error;
  }
};

/**
 * Updates MP4 generation record by task_id
 */
export const updateTrackMp4GenerationByTaskId = async (
  taskId: string,
  data: UpdateTrackMp4GenerationData
): Promise<TrackMp4Generation> => {
  try {
    validateRequiredParams({ taskId }, ['taskId']);

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const videoUrl = data.videoUrl !== undefined ? data.videoUrl : (data as any).video_url;

    if (videoUrl !== undefined) {
      updateFields.push(`video_url = $${paramIndex++}`);
      values.push(videoUrl);
    }

    if (data.status !== undefined && data.status !== null) {
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

    updateFields.push('updated_at = NOW()');
    values.push(taskId);

    const result = await query(
      `UPDATE track_mp4_generations
       SET ${updateFields.join(', ')}
       WHERE task_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Track MP4 generation not found');
    }

    const row = result.rows[0];
    return {
      id: row.id,
      trackId: row.track_id,
      taskId: row.task_id,
      videoUrl: row.video_url,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (error) {
    console.error('Error updating track MP4 generation by task_id:', error);
    throw error;
  }
};

