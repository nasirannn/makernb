import { query } from '@/lib/db-query-builder';
import { resolveLyricsTitle } from '@/lib/lyrics-title';

export interface LyricsGeneration {
  id: string;
  task_id: string | null; // 可以为null，失败的生成没有task_id
  user_id: string; // 必需，用于积分扣减
  title: string | null;
  user_prompt?: string | null;
  content: string | null;
  status: 'generating' | 'complete' | 'error';
  is_deleted?: boolean | null;
  created_at: string;
  updated_at: string;
}

// 创建歌词生成记录
export const createLyricsGeneration = async (
  taskId: string | null,
  userId: string,
  data: {
    title?: string | null;
    user_prompt?: string | null;
    content: string;
    status?: 'generating' | 'complete' | 'error';
  }
): Promise<LyricsGeneration> => {
  try {
    const status = data.status || 'generating';
    const title = resolveLyricsTitle(data.title, data.content);
    try {
      const result = await query(
        `INSERT INTO lyrics_generations (task_id, user_id, title, user_prompt, content, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [taskId, userId, title, data.user_prompt || null, data.content, status]
      );

      return result.rows[0];
    } catch (insertError) {
      // Backward-compatible fallback before DB migration is applied.
      const message = insertError instanceof Error ? insertError.message : '';
      const isMissingUserPromptColumn =
        /column .*user_prompt.* does not exist/i.test(message) ||
        /column \"user_prompt\" of relation \"lyrics_generations\" does not exist/i.test(message);

      if (!isMissingUserPromptColumn) {
        throw insertError;
      }

      const fallbackResult = await query(
        `INSERT INTO lyrics_generations (task_id, user_id, title, content, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [taskId, userId, title, data.content, status]
      );

      return fallbackResult.rows[0];
    }

  } catch (error) {
    console.error('Error creating lyrics generation:', error);
    throw error;
  }
};

// 更新歌词生成状态
export const updateLyricsGeneration = async (
  taskId: string,
  data: {
    status: 'generating' | 'complete' | 'error';
    title?: string;
    content?: string;
  }
): Promise<LyricsGeneration> => {
  try {
    const fields = Object.keys(data).filter(key => key !== 'taskId');
    const setClause = fields.map(field => `${field} = $${fields.indexOf(field) + 2}`).join(', ');
    
    const result = await query(
      `UPDATE lyrics_generations 
       SET ${setClause}, updated_at = NOW() 
       WHERE task_id = $1 
       RETURNING *`,
      [taskId, ...fields.map(field => data[field as keyof typeof data])]
    );

    if (result.rows.length === 0) {
      throw new Error('Lyrics generation not found');
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error updating lyrics generation:', error);
    throw error;
  }
};

// 获取歌词生成记录
export const getLyricsGeneration = async (taskId: string): Promise<LyricsGeneration | null> => {
  try {
    const result = await query(
      `SELECT *
       FROM lyrics_generations
       WHERE task_id = $1
         AND (is_deleted IS NULL OR is_deleted = FALSE)`,
      [taskId]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting lyrics generation:', error);
    throw error;
  }
};

// 获取所有未删除的歌词生成记录
export const getAllLyricsGenerations = async (
  limit: number = 10, 
  offset: number = 0
): Promise<LyricsGeneration[]> => {
  try {
    const result = await query(
      `SELECT * FROM lyrics_generations 
       WHERE (is_deleted IS NULL OR is_deleted = FALSE)
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return result.rows;
  } catch (error) {
    console.error('Error getting lyrics generations:', error);
    throw error;
  }
};

// 逻辑删除歌词生成记录
export const deleteLyricsGeneration = async (taskId: string): Promise<boolean> => {
  try {
    const result = await query(
      `UPDATE lyrics_generations
       SET is_deleted = TRUE, updated_at = NOW()
       WHERE task_id = $1
         AND (is_deleted IS NULL OR is_deleted = FALSE)`,
      [taskId]
    );

    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Error deleting lyrics generation:', error);
    throw error;
  }
};
