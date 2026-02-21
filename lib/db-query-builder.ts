import { query } from './db-pool';

/**
 * Get user music generations with efficient pagination.
 * 只返回至少有一个未删除 track 的 music 记录。
 */
export const getUserMusicGenerationsOptimized = async (
  userId: string,
  limit: number = 10,
  offset: number = 0
) => {
  const sql = `
    WITH user_generations AS (
      SELECT DISTINCT mg.id, mg.title, COALESCE(NULLIF(mg.tags, ''), '') as genre, mg.tags, mg.prompt, mg.generation_mode, mg.is_instrumental, mg.status, mg.model, mg.created_at, mg.updated_at,
             mg.original_music_id, mg.type
      FROM music mg
      INNER JOIN tracks mt ON mg.id = mt.music_id
      WHERE mg.user_id = $1::uuid
        AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
        AND COALESCE(mt.is_disliked, FALSE) = FALSE
      ORDER BY mg.created_at DESC
      LIMIT $2 OFFSET $3
    ),
    generation_tracks AS (
      SELECT
        ug.id as generation_id,
        ug.title, ug.genre, ug.tags, ug.prompt, ug.generation_mode, ug.is_instrumental, ug.status, ug.model,
        ug.created_at as generation_created_at, ug.updated_at as generation_updated_at,
        ug.original_music_id, ug.type,
        mt.id as track_id, mt.suno_track_id, mt.audio_url, mt.stream_audio_url, mt.duration,
        mt.is_published, mt.is_pinned, mt.created_at as track_created_at,
        mt.cover_image_url as cover_r2_url,
        COALESCE(mt.is_liked, FALSE) as is_liked,
        COALESCE(mt.is_disliked, FALSE) as is_disliked,
        mt.original_track_id,
        mt.source_type,
        COALESCE(mt.title, ug.title) as track_title,
        ml.content as lyrics_content,
        uf.created_at as favorited_at,
        COALESCE(omt.title, omg.title) as original_track_title
      FROM user_generations ug
      LEFT JOIN tracks mt ON ug.id = mt.music_id
        AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
        AND COALESCE(mt.is_disliked, FALSE) = FALSE
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

export const getUserTrackSummary = async (userId: string): Promise<{ totalTracks: number; totalDuration: number }> => {
  const sql = `
    SELECT
      COUNT(*) as total_tracks,
      COALESCE(SUM(COALESCE(mt.duration, 0)), 0) as total_duration
    FROM tracks mt
    INNER JOIN music mg ON mg.id = mt.music_id
    WHERE mg.user_id = $1::uuid
      AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
      AND COALESCE(mt.is_disliked, FALSE) = FALSE
  `;

  const result = await query<{ total_tracks: string | number; total_duration: string | number }>(sql, [userId]);
  const row = result.rows[0] || { total_tracks: 0, total_duration: 0 };
  const totalTracks = typeof row.total_tracks === 'string' ? parseInt(row.total_tracks, 10) : Number(row.total_tracks || 0);
  const totalDuration = typeof row.total_duration === 'string' ? parseFloat(row.total_duration) : Number(row.total_duration || 0);

  return {
    totalTracks: Number.isFinite(totalTracks) ? totalTracks : 0,
    totalDuration: Number.isFinite(totalDuration) ? totalDuration : 0,
  };
};

/**
 * Batch check favorites for multiple tracks.
 */
export const batchCheckFavorites = async (userId: string, trackIds: string[]): Promise<Record<string, boolean>> => {
  if (trackIds.length === 0) {
    return {};
  }

  const sql = `
    SELECT track_id
    FROM user_favorites
    WHERE user_id = $1::uuid AND track_id = ANY($2)
  `;

  const result = await query<{ track_id: string }>(sql, [userId, trackIds]);
  const favoriteSet = new Set(result.rows.map((row) => row.track_id));

  const favorites: Record<string, boolean> = {};
  trackIds.forEach((id) => {
    favorites[id] = favoriteSet.has(id);
  });

  return favorites;
};

export { query, withTransaction } from './db-pool';
