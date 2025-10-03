import { query } from './db-query-builder';

export interface UserPinnedTrack {
  id?: string;
  user_id: string;
  track_id: string;
  created_at?: string;
  updated_at?: string;
}

// 添加置顶 - 通过更新music_tracks表的is_pinned字段
export async function addToPinned(userId: string, trackId: string): Promise<UserPinnedTrack> {
  try {
    // 检查track是否属于该用户
    const trackResult = await query(`
      SELECT mt.id, mg.user_id
      FROM music_tracks mt
      JOIN music_generations mg ON mt.music_generation_id = mg.id
      WHERE mt.id = $1
    `, [trackId]);

    if (trackResult.rows.length === 0) {
      throw new Error('Track not found');
    }

    const track = trackResult.rows[0];
    if (track.user_id !== userId) {
      throw new Error('Unauthorized: Track does not belong to user');
    }

    // 更新is_pinned字段
    const result = await query(`
      UPDATE music_tracks
      SET is_pinned = true, updated_at = NOW()
      WHERE id = $1
      RETURNING id, music_generation_id, created_at, updated_at
    `, [trackId]);

    return {
      id: result.rows[0].id,
      user_id: userId,
      track_id: trackId,
      created_at: result.rows[0].created_at,
      updated_at: result.rows[0].updated_at
    };
  } catch (error) {
    console.error('Error adding to pinned:', error);
    throw error;
  }
}

// 移除置顶
export async function removeFromPinned(userId: string, trackId: string): Promise<boolean> {
  try {
    // 检查track是否属于该用户
    const trackResult = await query(`
      SELECT mt.id, mg.user_id
      FROM music_tracks mt
      JOIN music_generations mg ON mt.music_generation_id = mg.id
      WHERE mt.id = $1
    `, [trackId]);

    if (trackResult.rows.length === 0) {
      return false;
    }

    const track = trackResult.rows[0];
    if (track.user_id !== userId) {
      throw new Error('Unauthorized: Track does not belong to user');
    }

    const result = await query(`
      UPDATE music_tracks
      SET is_pinned = false, updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `, [trackId]);

    return result.rows.length > 0;
  } catch (error) {
    console.error('Error removing from pinned:', error);
    throw error;
  }
}

// 检查是否已置顶
export async function isPinned(userId: string, trackId: string): Promise<boolean> {
  try {
    const result = await query(`
      SELECT mt.is_pinned
      FROM music_tracks mt
      JOIN music_generations mg ON mt.music_generation_id = mg.id
      WHERE mt.id = $1 AND mg.user_id = $2
    `, [trackId, userId]);

    return result.rows.length > 0 ? result.rows[0].is_pinned : false;
  } catch (error) {
    console.error('Error checking if pinned:', error);
    throw error;
  }
}

// 切换置顶状态
export async function togglePinned(userId: string, trackId: string): Promise<boolean> {
  try {
    // 首先获取当前状态
    const currentResult = await query(`
      SELECT mt.is_pinned, mg.user_id
      FROM music_tracks mt
      JOIN music_generations mg ON mt.music_generation_id = mg.id
      WHERE mt.id = $1
    `, [trackId]);

    if (currentResult.rows.length === 0) {
      throw new Error('Track not found');
    }

    const track = currentResult.rows[0];
    if (track.user_id !== userId) {
      throw new Error('Unauthorized: Track does not belong to user');
    }

    const newPinnedState = !track.is_pinned;

    const result = await query(`
      UPDATE music_tracks
      SET is_pinned = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING is_pinned
    `, [newPinnedState, trackId]);

    return result.rows[0].is_pinned;
  } catch (error) {
    console.error('Error toggling pinned:', error);
    throw error;
  }
}

// 获取用户的置顶列表
export async function getUserPinnedTracks(userId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
  try {
    const result = await query(`
      SELECT
        mt.id,
        mt.audio_url,
        mt.duration,
        mt.side_letter,
        mt.created_at,
        mt.updated_at,
        mt.is_pinned,
        mg.title,
        mg.genre,
        mg.tags,
        mg.prompt,
        mg.user_id as track_owner_id,
        (
          SELECT ci.r2_url
          FROM cover_images ci
          WHERE ci.music_track_id = mt.id
          ORDER BY ci.created_at ASC
          LIMIT 1
        ) as cover_r2_url,
        (
          SELECT ml.content
          FROM music_lyrics ml
          WHERE ml.music_generation_id = mg.id
          ORDER BY ml.created_at ASC
          LIMIT 1
        ) as lyrics_content
      FROM music_tracks mt
      JOIN music_generations mg ON mt.music_generation_id = mg.id
      WHERE mg.user_id = $1
        AND mt.is_pinned = true
        AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
        AND (mg.is_deleted IS NULL OR mg.is_deleted = FALSE)
      ORDER BY mt.updated_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    return result.rows;
  } catch (error) {
    console.error('Error getting user pinned tracks:', error);
    throw error;
  }
}

// 批量检查置顶状态
export async function checkMultiplePinned(userId: string, trackIds: string[]): Promise<Record<string, boolean>> {
  try {
    if (trackIds.length === 0) {
      return {};
    }

    const result = await query(`
      SELECT mt.id, mt.is_pinned
      FROM music_tracks mt
      JOIN music_generations mg ON mt.music_generation_id = mg.id
      WHERE mg.user_id = $1 AND mt.id = ANY($2)
    `, [userId, trackIds]);

    const pinnedStatus: Record<string, boolean> = {};

    // 初始化所有track为false
    trackIds.forEach(trackId => {
      pinnedStatus[trackId] = false;
    });

    // 更新实际的pinned状态
    result.rows.forEach(row => {
      pinnedStatus[row.id] = row.is_pinned;
    });

    return pinnedStatus;
  } catch (error) {
    console.error('Error checking multiple pinned:', error);
    throw error;
  }
}

// 获取用户置顶数量
export async function getUserPinnedCount(userId: string): Promise<number> {
  try {
    const result = await query(`
      SELECT COUNT(*) as count
      FROM music_tracks mt
      JOIN music_generations mg ON mt.music_generation_id = mg.id
      WHERE mg.user_id = $1
        AND mt.is_pinned = true
        AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
        AND (mg.is_deleted IS NULL OR mg.is_deleted = FALSE)
    `, [userId]);

    return parseInt(result.rows[0].count) || 0;
  } catch (error) {
    console.error('Error getting user pinned count:', error);
    throw error;
  }
}