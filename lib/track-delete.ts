import { query, withTransaction } from './db-query-builder';
import { deleteAudioFiles, extractKeyFromR2Url } from './r2-storage';

const normalizeDomain = (value: string | undefined) => {
  if (!value) return null;
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

const r2PublicDomain = normalizeDomain(process.env.R2_PUBLIC_DOMAIN);

const shouldDeleteUrl = (url: string) => {
  if (!r2PublicDomain) return true;
  return url.startsWith(r2PublicDomain);
};

const collectR2Keys = (urls: Array<string | null | undefined>) => {
  const keys: string[] = [];
  urls.forEach((url) => {
    if (!url || !shouldDeleteUrl(url)) return;
    const key = extractKeyFromR2Url(url);
    if (key) {
      keys.push(key);
    }
  });
  return keys;
};

// 优化的删除track函数
export async function deleteTrackOptimized(trackId: string, userId: string): Promise<{
  success: boolean;
  error?: string;
  statusCode?: number;
}> {
  try {
    // 使用单个优化的SQL语句进行删除操作
    // 这个查询使用JOIN而不是子查询，性能更好
    const result = await query(`
      UPDATE tracks
      SET is_deleted = TRUE, updated_at = NOW()
      FROM music mg
      WHERE tracks.id = $1
        AND tracks.music_id = mg.id
        AND mg.user_id = $2::uuid
        AND (tracks.is_deleted IS NULL OR tracks.is_deleted = FALSE)
      RETURNING tracks.id, tracks.music_id
    `, [trackId, userId]);

    if (result.rows.length > 0) {
      return { success: true };
    }

    // 如果删除失败，快速诊断原因
    const diagnosticResult = await query(`
      SELECT
        mt.id,
        mt.is_deleted as track_deleted,
        mg.user_id
      FROM tracks mt
      LEFT JOIN music mg ON mt.music_id = mg.id
      WHERE mt.id = $1
    `, [trackId]);

    if (diagnosticResult.rows.length === 0) {
      return {
        success: false,
        error: 'Track not found',
        statusCode: 404
      };
    }

    const track = diagnosticResult.rows[0];

    if (!track.user_id) {
      return {
        success: false,
        error: 'Track\'s generation not found',
        statusCode: 404
      };
    }

    if (track.user_id !== userId) {
      return {
        success: false,
        error: 'Unauthorized: You can only delete your own tracks',
        statusCode: 403
      };
    }

    if (track.track_deleted) {
      return {
        success: false,
        error: 'Track is already deleted',
        statusCode: 409
      };
    }


    return {
      success: false,
      error: 'Delete operation failed for unknown reason',
      statusCode: 500
    };

  } catch (error) {
    console.error('Error in deleteTrackOptimized:', error);
    return {
      success: false,
      error: 'Database error occurred',
      statusCode: 500
    };
  }
}

export async function hardDeleteTrack(trackId: string, userId: string): Promise<{
  success: boolean;
  error?: string;
  statusCode?: number;
}> {
  try {
    const trackResult = await query(
      `SELECT
        mt.id,
        mt.music_id,
        mt.audio_url,
        mt.stream_audio_url,
        mt.cover_image_url,
        mg.user_id
      FROM tracks mt
      INNER JOIN music mg ON mt.music_id = mg.id
      WHERE mt.id = $1::uuid`,
      [trackId]
    );

    if (trackResult.rows.length === 0) {
      return { success: false, error: 'Track not found', statusCode: 404 };
    }

    const track = trackResult.rows[0];
    if (track.user_id !== userId) {
      return { success: false, error: 'Forbidden', statusCode: 403 };
    }

    const wavResult = await query(
      `SELECT wav_r2_url
       FROM track_wav_conversions
       WHERE track_id = $1::uuid`,
      [trackId]
    );

    const vocalRemovalResult = await query(
      `SELECT r2_vocal_url, r2_instrumental_url
       FROM vocal_removals
       WHERE track_id = $1::uuid`,
      [trackId]
    );

    const r2Keys = collectR2Keys([
      track.audio_url,
      track.stream_audio_url,
      track.cover_image_url,
      ...wavResult.rows.map((row) => row.wav_r2_url),
      ...vocalRemovalResult.rows.flatMap((row) => [row.r2_vocal_url, row.r2_instrumental_url]),
    ]);

    if (r2Keys.length > 0) {
      try {
        await deleteAudioFiles(r2Keys);
      } catch (error) {
        console.error('[TRACK-DELETE] Failed to delete R2 assets:', error);
      }
    }

    const generationId = track.music_id;

    await withTransaction(async (queryFn) => {
      await queryFn(
        `UPDATE track_personas
         SET status = 'deleted', updated_at = NOW()
         WHERE track_id = $1::uuid
           AND COALESCE(status, 'active') = 'active'`,
        [trackId]
      );

      await queryFn(
        `DELETE FROM track_wav_conversions
         WHERE track_id = $1::uuid`,
        [trackId]
      );

      await queryFn(
        `DELETE FROM vocal_removals
         WHERE track_id = $1::uuid`,
        [trackId]
      );

      await queryFn(
        `DELETE FROM user_favorites
         WHERE track_id = $1::uuid`,
        [trackId]
      );

      await queryFn(
        `DELETE FROM tracks
         WHERE id = $1::uuid`,
        [trackId]
      );

      const remainingTracks = await queryFn(
        `SELECT id FROM tracks WHERE music_id = $1::uuid LIMIT 1`,
        [generationId]
      );

      if (remainingTracks.rows.length === 0) {
        await queryFn(
          `DELETE FROM lyrics
           WHERE music_id = $1::uuid`,
          [generationId]
        );

        await queryFn(
          `DELETE FROM generation_errors
           WHERE reference_id = $1`,
          [generationId]
        );

        await queryFn(
          `DELETE FROM music
           WHERE id = $1::uuid`,
          [generationId]
        );
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Error in hardDeleteTrack:', error);
    return { success: false, error: 'Database error occurred', statusCode: 500 };
  }
}

export async function hardDeleteMusicGeneration(generationId: string, userId: string): Promise<{
  success: boolean;
  error?: string;
  statusCode?: number;
}> {
  try {
    const generationResult = await query(
      `SELECT id
       FROM music
       WHERE id = $1::uuid AND user_id = $2::uuid`,
      [generationId, userId]
    );

    if (generationResult.rows.length === 0) {
      return { success: false, error: 'Generation not found', statusCode: 404 };
    }

    const tracksResult = await query(
      `SELECT id, audio_url, stream_audio_url, cover_image_url
       FROM tracks
       WHERE music_id = $1::uuid`,
      [generationId]
    );

    const trackIds = tracksResult.rows.map((row) => row.id);

    const wavResult = trackIds.length
      ? await query(
          `SELECT wav_r2_url, track_id
           FROM track_wav_conversions
           WHERE track_id = ANY($1)`,
          [trackIds]
        )
      : { rows: [] };

    const vocalRemovalResult = trackIds.length
      ? await query(
          `SELECT r2_vocal_url, r2_instrumental_url
           FROM vocal_removals
           WHERE track_id = ANY($1)`,
          [trackIds]
        )
      : { rows: [] };

    const r2Keys = collectR2Keys([
      ...tracksResult.rows.flatMap((row) => [row.audio_url, row.stream_audio_url, row.cover_image_url]),
      ...wavResult.rows.map((row) => row.wav_r2_url),
      ...vocalRemovalResult.rows.flatMap((row) => [row.r2_vocal_url, row.r2_instrumental_url]),
    ]);

    if (r2Keys.length > 0) {
      try {
        await deleteAudioFiles(r2Keys);
      } catch (error) {
        console.error('[GENERATION-DELETE] Failed to delete R2 assets:', error);
      }
    }

    await withTransaction(async (queryFn) => {
      if (trackIds.length > 0) {
        await queryFn(
          `UPDATE track_personas
           SET status = 'deleted', updated_at = NOW()
           WHERE track_id = ANY($1)
             AND COALESCE(status, 'active') = 'active'`,
          [trackIds]
        );

        await queryFn(
          `DELETE FROM track_wav_conversions
           WHERE track_id = ANY($1)`,
          [trackIds]
        );

        await queryFn(
          `DELETE FROM vocal_removals
           WHERE track_id = ANY($1)`,
          [trackIds]
        );

        await queryFn(
          `DELETE FROM user_favorites
           WHERE track_id = ANY($1)`,
          [trackIds]
        );

        await queryFn(
          `DELETE FROM tracks
           WHERE id = ANY($1)`,
          [trackIds]
        );
      }

      await queryFn(
        `DELETE FROM lyrics
         WHERE music_id = $1::uuid`,
        [generationId]
      );

      await queryFn(
        `DELETE FROM generation_errors
         WHERE reference_id = $1`,
        [generationId]
      );

      await queryFn(
        `DELETE FROM music
         WHERE id = $1::uuid`,
        [generationId]
      );
    });

    return { success: true };
  } catch (error) {
    console.error('Error in hardDeleteMusicGeneration:', error);
    return { success: false, error: 'Database error occurred', statusCode: 500 };
  }
}

// 批量删除tracks的优化函数
export async function deleteMultipleTracksOptimized(trackIds: string[], userId: string): Promise<{
  success: boolean;
  deletedCount: number;
  failedTrackIds?: string[];
  error?: string;
}> {
  try {
    if (trackIds.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    // 批量删除操作
    const result = await query(`
      UPDATE tracks
      SET is_deleted = TRUE, updated_at = NOW()
      FROM music mg
      WHERE tracks.id = ANY($1)
        AND tracks.music_id = mg.id
        AND mg.user_id = $2::uuid
        AND (tracks.is_deleted IS NULL OR tracks.is_deleted = FALSE)
      RETURNING tracks.id
    `, [trackIds, userId]);

    const deletedIds = result.rows.map(row => row.id);
    const failedTrackIds = trackIds.filter(id => !deletedIds.includes(id));

    return {
      success: true,
      deletedCount: deletedIds.length,
      failedTrackIds: failedTrackIds.length > 0 ? failedTrackIds : undefined
    };

  } catch (error) {
    console.error('Error in deleteMultipleTracksOptimized:', error);
    return {
      success: false,
      deletedCount: 0,
      error: 'Database error occurred'
    };
  }
}

// 检查track是否可以被删除（不实际删除）
export async function checkTrackDeletable(trackId: string, userId: string): Promise<{
  deletable: boolean;
  reason?: string;
}> {
  try {
    const result = await query(`
      SELECT
        mt.id,
        mt.is_deleted as track_deleted,
        mg.user_id
      FROM tracks mt
      JOIN music mg ON mt.music_id = mg.id
      WHERE mt.id = $1
    `, [trackId]);

    if (result.rows.length === 0) {
      return { deletable: false, reason: 'Track not found' };
    }

    const track = result.rows[0];

    if (track.user_id !== userId) {
      return { deletable: false, reason: 'Unauthorized' };
    }

    if (track.track_deleted) {
      return { deletable: false, reason: 'Already deleted' };
    }


    return { deletable: true };

  } catch (error) {
    console.error('Error in checkTrackDeletable:', error);
    return { deletable: false, reason: 'Database error' };
  }
}
