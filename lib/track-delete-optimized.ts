import { query } from './db-query-builder';

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
        mg.user_id,
        mg.is_deleted as generation_deleted
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

    if (track.generation_deleted) {
      return {
        success: false,
        error: 'Parent generation is deleted',
        statusCode: 410
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
        mg.user_id,
        mg.is_deleted as generation_deleted
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

    if (track.generation_deleted) {
      return { deletable: false, reason: 'Parent generation deleted' };
    }

    return { deletable: true };

  } catch (error) {
    console.error('Error in checkTrackDeletable:', error);
    return { deletable: false, reason: 'Database error' };
  }
}