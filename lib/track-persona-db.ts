import { query } from './db-query-builder';
import { validateRequiredParams } from './db-utils';
import {
  TrackPersona,
  CreateTrackPersonaData,
  UpdateTrackPersonaData,
} from '@/types/track';

const mapTrackPersonaRow = (row: any): TrackPersona => ({
  id: row.id,
  trackId: row.track_id,
  taskId: row.task_id,
  audioId: row.audio_id,
  personaId: row.persona_id,
  status: row.status === 'deleted' ? 'deleted' : 'active',
  name: row.name,
  description: row.description,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const createTrackPersona = async (
  data: CreateTrackPersonaData
): Promise<TrackPersona> => {
  const trackId = data.trackId || (data as any).track_id;
  const taskId = data.taskId || (data as any).task_id;
  const audioId = data.audioId || (data as any).audio_id;
  const personaId = data.personaId || (data as any).persona_id;

  if (!trackId || !taskId || !audioId || !personaId) {
    throw new Error('Missing required parameter: trackId, taskId, audioId and personaId are required');
  }

  const result = await query(
    `INSERT INTO track_personas (
      track_id, task_id, audio_id, persona_id, status, name, description
    ) VALUES ($1, $2, $3, $4, 'active', $5, $6)
    ON CONFLICT (audio_id)
    DO UPDATE SET
      track_id = EXCLUDED.track_id,
      task_id = EXCLUDED.task_id,
      persona_id = EXCLUDED.persona_id,
      status = 'active',
      name = COALESCE(EXCLUDED.name, track_personas.name),
      description = COALESCE(EXCLUDED.description, track_personas.description),
      updated_at = NOW()
    RETURNING *`,
    [
      trackId,
      taskId,
      audioId,
      personaId,
      data.name?.trim() || null,
      data.description?.trim() || null,
    ]
  );

  return mapTrackPersonaRow(result.rows[0]);
};

export const getTrackPersonaByAudioId = async (audioId: string): Promise<TrackPersona | null> => {
  validateRequiredParams({ audioId }, ['audioId']);

  const result = await query(
    `SELECT *
     FROM track_personas
     WHERE audio_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [audioId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapTrackPersonaRow(result.rows[0]);
};

export const getTrackPersonaByTrackId = async (trackId: string): Promise<TrackPersona | null> => {
  validateRequiredParams({ trackId }, ['trackId']);

  const result = await query(
    `SELECT *
     FROM track_personas
     WHERE track_id = $1::uuid
     ORDER BY created_at DESC
     LIMIT 1`,
    [trackId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapTrackPersonaRow(result.rows[0]);
};

export const updateTrackPersonaById = async (
  personaRecordId: string,
  data: UpdateTrackPersonaData
): Promise<TrackPersona> => {
  validateRequiredParams({ personaRecordId }, ['personaRecordId']);

  const updateFields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  const name = data.name !== undefined ? data.name : (data as any).name;
  const description = data.description !== undefined ? data.description : (data as any).description;
  const status = data.status !== undefined ? data.status : (data as any).status;

  if (name !== undefined) {
    updateFields.push(`name = $${paramIndex++}`);
    values.push(name?.trim() || null);
  }

  if (description !== undefined) {
    updateFields.push(`description = $${paramIndex++}`);
    values.push(description?.trim() || null);
  }

  if (status !== undefined) {
    updateFields.push(`status = $${paramIndex++}`);
    values.push(status);
  }

  if (updateFields.length === 0) {
    throw new Error('No fields to update');
  }

  updateFields.push('updated_at = NOW()');
  values.push(personaRecordId);

  const result = await query(
    `UPDATE track_personas
     SET ${updateFields.join(', ')}
     WHERE id = $${paramIndex}::uuid
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    throw new Error('Track persona not found');
  }

  return mapTrackPersonaRow(result.rows[0]);
};

export const softDeleteTrackPersonaById = async (
  personaRecordId: string
): Promise<TrackPersona | null> => {
  validateRequiredParams({ personaRecordId }, ['personaRecordId']);

  const result = await query(
    `UPDATE track_personas
     SET status = 'deleted', updated_at = NOW()
     WHERE id = $1::uuid
       AND COALESCE(status, 'active') != 'deleted'
     RETURNING *`,
    [personaRecordId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapTrackPersonaRow(result.rows[0]);
};
