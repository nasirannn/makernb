import { query } from './db-query-builder';
import { validateRequiredParams } from './db-utils';
import {
  TrackMidiGeneration,
  CreateTrackMidiGenerationData,
  UpdateTrackMidiGenerationData,
} from '@/types/track';

const mapRowToTrackMidiGeneration = (row: any): TrackMidiGeneration => ({
  id: row.id,
  trackId: row.track_id,
  separationTaskId: row.separation_task_id,
  sourceAudioId: row.source_audio_id,
  taskId: row.task_id,
  midiData: row.midi_data || null,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Creates or updates a MIDI generation record by task_id
 */
export const upsertTrackMidiGeneration = async (
  data: CreateTrackMidiGenerationData
): Promise<TrackMidiGeneration> => {
  try {
    const trackId = data.trackId || (data as any).track_id;
    const separationTaskId = data.separationTaskId || (data as any).separation_task_id;
    const sourceAudioId =
      data.sourceAudioId !== undefined ? data.sourceAudioId : (data as any).source_audio_id || null;
    const taskId = data.taskId || (data as any).task_id;
    const midiData = data.midiData !== undefined ? data.midiData : (data as any).midi_data;

    if (!trackId || !separationTaskId || !taskId) {
      throw new Error('Missing required parameter: trackId, separationTaskId and taskId are required');
    }

    const result = await query(
      `INSERT INTO track_midi_generations (
        track_id, separation_task_id, source_audio_id, task_id, midi_data, status
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6)
      ON CONFLICT (task_id)
      DO UPDATE SET
        track_id = EXCLUDED.track_id,
        separation_task_id = EXCLUDED.separation_task_id,
        source_audio_id = EXCLUDED.source_audio_id,
        midi_data = COALESCE(EXCLUDED.midi_data, track_midi_generations.midi_data),
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING *`,
      [
        trackId,
        separationTaskId,
        sourceAudioId || null,
        taskId,
        midiData ? JSON.stringify(midiData) : null,
        data.status || 'generating',
      ]
    );

    return mapRowToTrackMidiGeneration(result.rows[0]);
  } catch (error) {
    console.error('Error upserting track MIDI generation:', error);
    throw error;
  }
};

/**
 * Gets MIDI generation by task_id
 */
export const getTrackMidiGenerationByTaskId = async (
  taskId: string
): Promise<TrackMidiGeneration | null> => {
  try {
    validateRequiredParams({ taskId }, ['taskId']);

    const result = await query(
      'SELECT * FROM track_midi_generations WHERE task_id = $1',
      [taskId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapRowToTrackMidiGeneration(result.rows[0]);
  } catch (error) {
    console.error('Error getting track MIDI generation by task_id:', error);
    throw error;
  }
};

/**
 * Gets latest MIDI generation by track/separation/audio scope
 */
export const getLatestTrackMidiGenerationByScope = async (
  trackId: string,
  separationTaskId: string,
  sourceAudioId: string | null = null
): Promise<TrackMidiGeneration | null> => {
  try {
    validateRequiredParams({ trackId, separationTaskId }, ['trackId', 'separationTaskId']);

    const result = await query(
      `SELECT *
       FROM track_midi_generations
       WHERE track_id = $1::uuid
         AND separation_task_id = $2
         AND (
           ($3::text IS NULL AND source_audio_id IS NULL)
           OR source_audio_id = $3
         )
       ORDER BY created_at DESC
       LIMIT 1`,
      [trackId, separationTaskId, sourceAudioId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapRowToTrackMidiGeneration(result.rows[0]);
  } catch (error) {
    console.error('Error getting latest track MIDI generation by scope:', error);
    throw error;
  }
};

/**
 * Gets all MIDI generations by track_id
 */
export const getTrackMidiGenerationsByTrackId = async (
  trackId: string
): Promise<TrackMidiGeneration[]> => {
  try {
    validateRequiredParams({ trackId }, ['trackId']);

    const result = await query(
      `SELECT *
       FROM track_midi_generations
       WHERE track_id = $1::uuid
       ORDER BY created_at DESC`,
      [trackId]
    );

    return result.rows.map(mapRowToTrackMidiGeneration);
  } catch (error) {
    console.error('Error getting track MIDI generations by track_id:', error);
    throw error;
  }
};

/**
 * Updates MIDI generation record by task_id
 */
export const updateTrackMidiGenerationByTaskId = async (
  taskId: string,
  data: UpdateTrackMidiGenerationData
): Promise<TrackMidiGeneration> => {
  try {
    validateRequiredParams({ taskId }, ['taskId']);

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const midiData = data.midiData !== undefined ? data.midiData : (data as any).midi_data;
    if (midiData !== undefined) {
      updateFields.push(`midi_data = $${paramIndex++}::jsonb`);
      values.push(midiData ? JSON.stringify(midiData) : null);
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
      `UPDATE track_midi_generations
       SET ${updateFields.join(', ')}
       WHERE task_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Track MIDI generation not found');
    }

    return mapRowToTrackMidiGeneration(result.rows[0]);
  } catch (error) {
    console.error('Error updating track MIDI generation by task_id:', error);
    throw error;
  }
};
