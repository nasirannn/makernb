import { query } from './neon';

export interface LyricsGeneration {
  id: string;
  task_id: string | null; // 可以为null，失败的生成没有task_id
  user_id: string; // 必需，用于积分扣减
  title: string;
  content: string;
  status: 'generating' | 'complete' | 'error';
  created_at: string;
  updated_at: string;
}

// 创建歌词生成记录
export const createLyricsGeneration = async (
  taskId: string | null,
  userId: string,
  data: {
    title: string;
    content: string;
    status?: 'generating' | 'complete' | 'error';
  }
): Promise<LyricsGeneration> => {
  try {
    const status = data.status || 'generating';
    const result = await query(
      `INSERT INTO lyrics_generations (task_id, user_id, title, content, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [taskId, userId, data.title, data.content, status]
    );

    return result.rows[0];
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
    const values = fields.map((field, index) => `$${index + 2}`);
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
      'SELECT * FROM lyrics_generations WHERE task_id = $1',
      [taskId]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting lyrics generation:', error);
    throw error;
  }
};

// 获取所有歌词生成记录（lyrics_generations表没有user_id字段）
export const getAllLyricsGenerations = async (
  limit: number = 10, 
  offset: number = 0
): Promise<LyricsGeneration[]> => {
  try {
    const result = await query(
      `SELECT * FROM lyrics_generations 
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

// 删除歌词生成记录（lyrics_generations表没有user_id字段）
export const deleteLyricsGeneration = async (taskId: string): Promise<boolean> => {
  try {
    const result = await query(
      `DELETE FROM lyrics_generations WHERE task_id = $1`,
      [taskId]
    );

    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Error deleting lyrics generation:', error);
    throw error;
  }
};
