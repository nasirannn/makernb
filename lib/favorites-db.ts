import { query } from './db-query-builder';

export interface UserFavorite {
  id?: string;
  user_id: string;
  track_id: string;
  created_at?: string;
  updated_at?: string;
}

// 添加收藏
export async function addToFavorites(userId: string, trackId: string): Promise<UserFavorite> {
  try {
    const result = await query(`
      INSERT INTO user_favorites (user_id, track_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, track_id) DO NOTHING
      RETURNING *
    `, [userId, trackId]);
    
    if (result.rows.length === 0) {
      // 如果没有插入新记录，说明已经存在，返回现有记录
      const existingResult = await query(`
        SELECT * FROM user_favorites 
        WHERE user_id = $1 AND track_id = $2
      `, [userId, trackId]);
      return existingResult.rows[0];
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Error adding to favorites:', error);
    throw error;
  }
}

// 移除收藏
export async function removeFromFavorites(userId: string, trackId: string): Promise<boolean> {
  try {
    const result = await query(`
      DELETE FROM user_favorites 
      WHERE user_id = $1 AND track_id = $2
      RETURNING id
    `, [userId, trackId]);
    
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error removing from favorites:', error);
    throw error;
  }
}

// 检查是否已收藏
export async function isFavorited(userId: string, trackId: string): Promise<boolean> {
  try {
    const result = await query(`
      SELECT id FROM user_favorites 
      WHERE user_id = $1 AND track_id = $2
    `, [userId, trackId]);
    
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking if favorited:', error);
    throw error;
  }
}

// 切换收藏状态 - 优化版本，减少数据库查询次数
export async function toggleFavorite(userId: string, trackId: string): Promise<boolean> {
  try {
    // 使用单个SQL语句进行toggle操作，避免多次查询
    const result = await query(`
      WITH current_check AS (
        SELECT EXISTS(
          SELECT 1 FROM user_favorites 
          WHERE user_id = $1 AND track_id = $2
        ) as currently_favorited
      ),
      toggle_result AS (
        INSERT INTO user_favorites (user_id, track_id)
        SELECT $1, $2
        WHERE NOT (SELECT currently_favorited FROM current_check)
        ON CONFLICT (user_id, track_id) DO NOTHING
        RETURNING true as was_inserted
      ),
      delete_result AS (
        DELETE FROM user_favorites 
        WHERE user_id = $1 AND track_id = $2
        AND (SELECT currently_favorited FROM current_check)
        RETURNING true as was_deleted
      )
      SELECT 
        CASE 
          WHEN (SELECT was_inserted FROM toggle_result) IS NOT NULL THEN true
          WHEN (SELECT was_deleted FROM delete_result) IS NOT NULL THEN false
          ELSE (SELECT currently_favorited FROM current_check)
        END as new_favorite_state
    `, [userId, trackId]);
    
    return result.rows[0].new_favorite_state;
  } catch (error) {
    console.error('Error toggling favorite:', error);
    throw error;
  }
}

// 获取用户的收藏列表
export async function getUserFavorites(userId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
  try {
    const result = await query(`
      SELECT 
        uf.id as favorite_id,
        uf.created_at as favorited_at,
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
        ) as cover_r2_url,
        (
          SELECT ml.content
          FROM music_lyrics ml
          WHERE ml.music_generation_id = mg.id
          ORDER BY ml.created_at ASC
          LIMIT 1
        ) as lyrics_content
      FROM user_favorites uf
      JOIN music_tracks mt ON uf.track_id = mt.id
      JOIN music_generations mg ON mt.music_generation_id = mg.id
      WHERE uf.user_id = $1 
        AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
        AND mg.is_deleted = FALSE
      ORDER BY uf.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);
    
    return result.rows;
  } catch (error) {
    console.error('Error getting user favorites:', error);
    throw error;
  }
}

// 获取用户收藏数量
export async function getUserFavoritesCount(userId: string): Promise<number> {
  try {
    const result = await query(`
      SELECT COUNT(*) as count
      FROM user_favorites uf
      JOIN music_tracks mt ON uf.track_id = mt.id
      JOIN music_generations mg ON mt.music_generation_id = mg.id
      WHERE uf.user_id = $1 
        AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
        AND mg.is_deleted = FALSE
    `, [userId]);
    
    return parseInt(result.rows[0].count) || 0;
  } catch (error) {
    console.error('Error getting user favorites count:', error);
    throw error;
  }
}

// 批量检查收藏状态
export async function checkMultipleFavorites(userId: string, trackIds: string[]): Promise<Record<string, boolean>> {
  try {
    if (trackIds.length === 0) {
      return {};
    }
    
    const result = await query(`
      SELECT track_id FROM user_favorites 
      WHERE user_id = $1 AND track_id = ANY($2)
    `, [userId, trackIds]);
    
    const favoritedTrackIds = new Set(result.rows.map(row => row.track_id));
    
    const favoriteStatus: Record<string, boolean> = {};
    trackIds.forEach(trackId => {
      favoriteStatus[trackId] = favoritedTrackIds.has(trackId);
    });
    
    return favoriteStatus;
  } catch (error) {
    console.error('Error checking multiple favorites:', error);
    throw error;
  }
}
