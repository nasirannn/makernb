import { query } from './neon';

export interface UserPinnedTrack {
  id?: string;
  user_id: string;
  track_id: string;
  created_at?: string;
  updated_at?: string;
}

// 添加置顶
export async function addToPinned(userId: string, trackId: string): Promise<UserPinnedTrack> {
  try {
    const result = await query(`
      INSERT INTO user_pinned_tracks (user_id, track_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, track_id) DO NOTHING
      RETURNING *
    `, [userId, trackId]);
    
    if (result.rows.length === 0) {
      // 如果没有插入新记录，说明已经存在，返回现有记录
      const existingResult = await query(`
        SELECT * FROM user_pinned_tracks 
        WHERE user_id = $1 AND track_id = $2
      `, [userId, trackId]);
      return existingResult.rows[0];
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Error adding to pinned:', error);
    throw error;
  }
}

// 移除置顶
export async function removeFromPinned(userId: string, trackId: string): Promise<void> {
  try {
    await query(`
      DELETE FROM user_pinned_tracks 
      WHERE user_id = $1 AND track_id = $2
    `, [userId, trackId]);
  } catch (error) {
    console.error('Error removing from pinned:', error);
    throw error;
  }
}

// 检查是否已置顶
export async function isPinned(userId: string, trackId: string): Promise<boolean> {
  try {
    const result = await query(`
      SELECT id FROM user_pinned_tracks 
      WHERE user_id = $1 AND track_id = $2
    `, [userId, trackId]);
    
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking if pinned:', error);
    throw error;
  }
}

// 切换置顶状态
export async function togglePinned(userId: string, trackId: string): Promise<boolean> {
  try {
    const isCurrentlyPinned = await isPinned(userId, trackId);
    
    if (isCurrentlyPinned) {
      await removeFromPinned(userId, trackId);
      return false;
    } else {
      await addToPinned(userId, trackId);
      return true;
    }
  } catch (error) {
    console.error('Error toggling pinned:', error);
    throw error;
  }
}

// 获取用户的置顶歌曲列表
export async function getUserPinnedTracks(userId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
  try {
    const result = await query(`
      SELECT 
        upt.id as pinned_id,
        upt.created_at as pinned_at,
        mt.id,
        mt.audio_url,
        mt.duration,
        mt.side_letter,
        mt.created_at,
        mt.updated_at,
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
        ) as cover_r2_url
      FROM user_pinned_tracks upt
      JOIN music_tracks mt ON upt.track_id = mt.id
      JOIN music_generations mg ON mt.music_generation_id = mg.id
      WHERE upt.user_id = $1
      ORDER BY upt.created_at DESC
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
      SELECT track_id FROM user_pinned_tracks 
      WHERE user_id = $1 AND track_id = ANY($2)
    `, [userId, trackIds]);
    
    const pinnedTrackIds = new Set(result.rows.map(row => row.track_id));
    
    const pinnedStatus: Record<string, boolean> = {};
    trackIds.forEach(trackId => {
      pinnedStatus[trackId] = pinnedTrackIds.has(trackId);
    });
    
    return pinnedStatus;
  } catch (error) {
    console.error('Error checking multiple pinned:', error);
    throw error;
  }
}

// 获取用户置顶歌曲数量
export async function getUserPinnedTracksCount(userId: string): Promise<number> {
  try {
    const result = await query(`
      SELECT COUNT(*) as count
      FROM user_pinned_tracks 
      WHERE user_id = $1
    `, [userId]);
    
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error('Error getting pinned tracks count:', error);
    throw error;
  }
}
