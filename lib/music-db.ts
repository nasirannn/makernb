import { query } from './neon';
import { getGenerationErrorByReferenceId } from './generation-errors-db';

export interface MusicGeneration {
  id: string;
  user_id: string;
  title?: string;
  genre?: string;
  style?: string;
  prompt?: string;
  is_private: boolean;
  is_instrumental: boolean;
  task_id?: string;
  status?: 'generating' | 'text' | 'first' | 'complete' | 'error';
  created_at: string;
  updated_at: string;
}

// 创建音乐生成记录
export const createMusicGeneration = async (
  userId: string,
  data: {
    title?: string;
    genre?: string;
    style?: string;
    prompt?: string;
    is_private?: boolean;
    is_instrumental?: boolean;
    task_id?: string;
    status?: 'generating' | 'complete' | 'error' | 'text';
  }
): Promise<MusicGeneration> => {
  try {
    const result = await query(
      `INSERT INTO music_generations (
        user_id, title, genre, style, prompt,
        is_private, is_instrumental, task_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        userId,
        data.title,
        data.genre,
        data.style,
        data.prompt,
        data.is_private || false,
        data.is_instrumental || false,
        data.task_id,
        data.status || 'generating'
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error creating music generation:', error);
    throw error;
  }
};

// 软删除音乐生成记录
export const softDeleteMusicGeneration = async (generationId: string, userId: string): Promise<boolean> => {
  try {
    console.log('softDeleteMusicGeneration called with:', { generationId, userId });
    
    const result = await query(
      `UPDATE music_generations 
       SET is_deleted = TRUE, updated_at = NOW() 
       WHERE id = $1 AND user_id = $2 AND is_deleted = FALSE
       RETURNING id`,
      [generationId, userId]
    );

    console.log('Soft delete query result:', result.rows);
    console.log('Rows affected:', result.rows.length);

    return result.rows.length > 0;
  } catch (error) {
    console.error('Error soft deleting music generation:', error);
    throw error;
  }
};

// 获取用户的音乐generations（按music_generations分组，包含所有tracks）
export const getUserMusicGenerations = async (userId: string, limit: number = 10, offset: number = 0): Promise<any[]> => {
  try {
    // 首先获取music_generations列表（排除已删除的记录）
    const generationsResult = await query(`
      SELECT 
        mg.id,
        mg.title,
        mg.genre,
        mg.style,
        mg.prompt,
        mg.is_private,
        mg.is_instrumental,
        mg.status,
        mg.created_at,
        mg.updated_at,
        ml.content as lyrics_content
      FROM music_generations mg
      LEFT JOIN music_lyrics ml ON mg.id = ml.music_generation_id
      WHERE mg.user_id = $1 AND mg.is_deleted = FALSE
      ORDER BY mg.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    // 为每个music_generation获取其所有tracks
    const musicGenerations = [];
    
    for (const generation of generationsResult.rows) {
      const tracksResult = await query(`
        SELECT 
          mt.id,
          mt.suno_track_id,
          mt.audio_url,
          mt.duration,
          mt.side_letter,
          mt.created_at,
          mt.updated_at,
          (
            SELECT ci.r2_url 
            FROM cover_images ci 
            WHERE ci.music_track_id = mt.id 
            ORDER BY ci.created_at ASC 
            LIMIT 1
          ) as cover_r2_url
        FROM music_tracks mt
        WHERE mt.music_generation_id = $1 
          AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
        ORDER BY mt.side_letter ASC
      `, [generation.id]);

      // 计算总时长（所有tracks的duration之和，确保转换为数字）
      const totalDuration = tracksResult.rows.reduce((sum, track) => {
        const duration = track.duration;
        // 确保duration是数字类型
        const numericDuration = typeof duration === 'string' ? parseFloat(duration) : (duration || 0);
        return sum + numericDuration;
      }, 0);

      // 如果是错误状态，获取错误信息
      let errorInfo = null;
      if (generation.status === 'error') {
        try {
          errorInfo = await getGenerationErrorByReferenceId('music_generation', generation.id);
        } catch (error) {
          console.error('Failed to get error info for generation:', generation.id, error);
        }
      }

      musicGenerations.push({
        ...generation,
        allTracks: tracksResult.rows,
        totalDuration: totalDuration,
        errorInfo: errorInfo
      });
    }

    return musicGenerations;
  } catch (error) {
    console.error('Error getting user music generations:', error);
    throw error;
  }
};

// 获取公开的音乐生成记录
export const getPublicMusicGenerations = async (limit: number = 10, offset: number = 0): Promise<MusicGeneration[]> => {
  try {
    const result = await query(
      'SELECT * FROM music_generations WHERE is_private = false ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    return result.rows;
  } catch (error) {
    console.error('Error getting public music generations:', error);
    throw error;
  }
};

// 通过 task_id 查找音乐生成记录
export const getMusicGenerationByTaskId = async (taskId: string): Promise<MusicGeneration | null> => {
  try {
    const result = await query(
      'SELECT * FROM music_generations WHERE task_id = $1',
      [taskId]
    );
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting music generation by task_id:', error);
    throw error;
  }
};

// 通过 task_id 更新音乐生成记录
export const updateMusicGenerationByTaskId = async (
  taskId: string,
  data: Partial<MusicGeneration>
): Promise<MusicGeneration> => {
  try {
    const fields = Object.keys(data).filter(key => key !== 'id' && key !== 'user_id' && key !== 'created_at' && key !== 'task_id');
    const setClause = fields.map(field => `${field} = $${fields.indexOf(field) + 2}`).join(', ');
    
    const result = await query(
      `UPDATE music_generations SET ${setClause}, updated_at = NOW() WHERE task_id = $1 RETURNING *`,
      [taskId, ...fields.map(field => data[field as keyof MusicGeneration])]
    );

    if (result.rows.length === 0) {
      throw new Error('Music generation not found');
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error updating music generation by task_id:', error);
    throw error;
  }
};

// 更新音乐生成记录
export const updateMusicGeneration = async (
  id: string,
  data: Partial<MusicGeneration>
): Promise<MusicGeneration> => {
  try {
    const fields = Object.keys(data).filter(key => key !== 'id' && key !== 'user_id' && key !== 'created_at');
    const setClause = fields.map(field => `${field} = $${fields.indexOf(field) + 2}`).join(', ');
    
    const result = await query(
      `UPDATE music_generations SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...fields.map(field => data[field as keyof MusicGeneration])]
    );

    if (result.rows.length === 0) {
      throw new Error('Music generation not found');
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error updating music generation:', error);
    throw error;
  }
};

// 删除音乐生成记录
export const deleteMusicGeneration = async (id: string, userId: string): Promise<boolean> => {
  try {
    const result = await query(
      'DELETE FROM music_generations WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Error deleting music generation:', error);
    throw error;
  }
};

// 获取数据库中所有的音频URL（用于清理脚本）
export const getAllAudioUrls = async (): Promise<string[]> => {
  try {
    const result = await query(`
      SELECT audio_url 
      FROM music_tracks 
      WHERE audio_url IS NOT NULL 
        AND audio_url != ''
        AND (is_deleted IS NULL OR is_deleted = FALSE)
    `);

    return result.rows.map(row => row.audio_url).filter(url => url);
  } catch (error) {
    console.error('Error getting all audio URLs:', error);
    throw error;
  }
};
