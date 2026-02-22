import { query, withTransaction } from '@/lib/db-query-builder';
import { validateRequiredParams } from '@/lib/db-utils';

export type VocalSeparationHistorySourceFilter = 'all' | 'replicate' | 'kie';
export type VocalSeparationHistorySource = 'replicate' | 'kie';

export interface VocalSeparationHistoryRecord {
  source: 'replicate' | 'kie';
  id: string;
  user_id: string;
  status: string;
  separation_type?: string | null;
  prediction_id?: string | null;
  task_id?: string | null;
  track_id?: string | null;
  music_id?: string | null;
  original_filename?: string | null;
  original_audio_url?: string | null;
  vocal_url?: string | null;
  instrumental_url?: string | null;
  stems_data?: Record<string, string> | null;
  error_code?: string | null;
  error_message?: string | null;
  has_persistent_audio: boolean;
  is_deleted?: boolean | null;
  created_at: string;
  updated_at: string;
  resolved_title?: string | null;
  track_audio_url?: string | null;
}

export const getUserVocalSeparationHistory = async (
  userId: string,
  source: VocalSeparationHistorySourceFilter,
  limit: number = 20,
  offset: number = 0
): Promise<{ rows: VocalSeparationHistoryRecord[]; total: number }> => {
  validateRequiredParams({ userId }, ['userId']);

  const [rowsResult, countResult] = await Promise.all([
    query(
      `SELECT
        h.source,
        h.source_record_id::text AS id,
        h.user_id,
        h.status,
        h.separation_type,
        h.prediction_id,
        h.task_id,
        h.track_id::text,
        h.music_id::text,
        h.original_filename,
        h.original_audio_url,
        h.vocal_url,
        h.instrumental_url,
        h.stems_data,
        h.error_code,
        h.error_message,
        h.has_persistent_audio,
        h.is_deleted,
        h.created_at,
        h.updated_at,
        COALESCE(NULLIF(t.title, ''), NULLIF(m.title, ''), NULLIF(h.original_filename, '')) AS resolved_title,
        NULLIF(t.audio_url, '') AS track_audio_url
       FROM vocal_separation_history h
       LEFT JOIN tracks t ON h.track_id = t.id
       LEFT JOIN music m ON h.music_id = m.id
       WHERE h.user_id = $1::uuid
         AND (h.is_deleted IS NULL OR h.is_deleted = FALSE)
         AND ($2 = 'all' OR h.source = $2)
       ORDER BY h.created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, source, limit, offset]
    ),
    query(
      `SELECT COUNT(*)::int AS total
       FROM vocal_separation_history h
       WHERE h.user_id = $1::uuid
         AND (h.is_deleted IS NULL OR h.is_deleted = FALSE)
         AND ($2 = 'all' OR h.source = $2)`,
      [userId, source]
    ),
  ]);

  const total = Number(countResult.rows[0]?.total || 0);
  return {
    rows: rowsResult.rows as VocalSeparationHistoryRecord[],
    total,
  };
};

export const deleteUserVocalSeparationHistoryRecord = async (
  userId: string,
  source: VocalSeparationHistorySource,
  sourceRecordId: string
): Promise<boolean> => {
  validateRequiredParams({ userId, source, sourceRecordId }, ['userId', 'source', 'sourceRecordId']);

  return withTransaction(async (queryFn) => {
    const existing = await queryFn(
      `SELECT source_record_id
       FROM vocal_separation_history
       WHERE user_id = $1::uuid
         AND source = $2
         AND source_record_id = $3::uuid
         AND (is_deleted IS NULL OR is_deleted = FALSE)
       LIMIT 1`,
      [userId, source, sourceRecordId]
    );

    if (!existing.rowCount || existing.rowCount < 1) {
      return false;
    }

    const sourceDeleteResult =
      source === 'kie'
        ? await queryFn(
            `UPDATE vocal_removals
             SET is_deleted = TRUE, updated_at = NOW()
             WHERE id = $1::uuid
               AND user_id = $2::uuid
               AND (is_deleted IS NULL OR is_deleted = FALSE)
             RETURNING id`,
            [sourceRecordId, userId]
          )
        : await queryFn(
            `UPDATE vocal_separations
             SET is_deleted = TRUE, updated_at = NOW()
             WHERE id = $1::uuid
               AND user_id = $2::uuid
               AND (is_deleted IS NULL OR is_deleted = FALSE)
             RETURNING id`,
            [sourceRecordId, userId]
          );

    if ((sourceDeleteResult.rowCount || 0) > 0) {
      return true;
    }

    // Fallback: source table row may already be deleted or missing in edge cases.
    const historyDeleteResult = await queryFn(
      `UPDATE vocal_separation_history
       SET is_deleted = TRUE, updated_at = NOW()
       WHERE source = $1
         AND source_record_id = $2::uuid
         AND user_id = $3::uuid
         AND (is_deleted IS NULL OR is_deleted = FALSE)
       RETURNING source_record_id`,
      [source, sourceRecordId, userId]
    );

    return (historyDeleteResult.rowCount || 0) > 0;
  });
};
