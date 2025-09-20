import { query } from './neon';

export interface CoverGeneration {
  id: string;
  task_id: string; // 封面生成请求response的taskId
  music_task_id?: string; // 原音乐的taskId
  user_id?: string;
  status: 'generating' | 'complete' | 'error';
  created_at: string;
  updated_at: string;
}

// 创建封面生成记录
export const createCoverGeneration = async (
  coverTaskId: string,
  data: {
    music_task_id?: string;
    user_id?: string;
    status?: string;
  }
): Promise<CoverGeneration> => {
  try {
    // 先尝试插入
    const result = await query(
      `INSERT INTO cover_generations (task_id, music_task_id, user_id, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [coverTaskId, data.music_task_id, data.user_id, data.status || 'generating']
    );

    return result.rows[0];
  } catch (error) {
    // 如果是重复键错误，尝试获取现有记录
    if (error instanceof Error && error.message.includes('duplicate key value violates unique constraint')) {
      console.log(`Cover generation with task_id ${coverTaskId} already exists, fetching existing record`);
      const existingResult = await query(
        `SELECT * FROM cover_generations WHERE task_id = $1`,
        [coverTaskId]
      );
      
      if (existingResult.rows.length > 0) {
        return existingResult.rows[0];
      }
    }
    
    console.error('Error creating cover generation:', error);
    throw error;
  }
};

// 更新封面生成状态
export const updateCoverGeneration = async (
  taskId: string,
  data: {
    status: 'generating' | 'complete' | 'error';
  }
): Promise<CoverGeneration> => {
  try {
    const fields = Object.keys(data).filter(key => key !== 'taskId');
    const values = fields.map((field, index) => `$${index + 2}`);
    const setClause = fields.map(field => `${field} = $${fields.indexOf(field) + 2}`).join(', ');
    
    const result = await query(
      `UPDATE cover_generations 
       SET ${setClause}, updated_at = NOW() 
       WHERE task_id = $1 
       RETURNING *`,
      [taskId, ...fields.map(field => data[field as keyof typeof data])]
    );

    if (result.rows.length === 0) {
      throw new Error('Cover generation not found');
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error updating cover generation:', error);
    throw error;
  }
};

// 获取封面生成记录
export const getCoverGeneration = async (taskId: string): Promise<CoverGeneration | null> => {
  try {
    const result = await query(
      'SELECT * FROM cover_generations WHERE task_id = $1',
      [taskId]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting cover generation:', error);
    throw error;
  }
};

// 获取音乐的封面生成记录（通过task_id关联）
export const getMusicCoverGenerations = async (musicId: string): Promise<CoverGeneration[]> => {
  try {
    // 先通过music_generations表获取task_id
    const musicResult = await query(
      `SELECT task_id FROM music_generations WHERE id = $1`,
      [musicId]
    );
    
    if (musicResult.rows.length === 0) {
      return [];
    }
    
    const taskId = musicResult.rows[0].task_id;
    
    const result = await query(
      `SELECT * FROM cover_generations 
       WHERE task_id = $1 
       ORDER BY created_at DESC`,
      [taskId]
    );

    return result.rows;
  } catch (error) {
    console.error('Error getting music cover generations:', error);
    throw error;
  }
};

// 获取用户的封面生成记录
export const getUserCoverGenerations = async (
  userId: string, 
  limit: number = 10, 
  offset: number = 0
): Promise<CoverGeneration[]> => {
  try {
    const result = await query(
      `SELECT * FROM cover_generations 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  } catch (error) {
    console.error('Error getting user cover generations:', error);
    throw error;
  }
};

// 删除封面生成记录
export const deleteCoverGeneration = async (taskId: string, userId?: string): Promise<boolean> => {
  try {
    const whereClause = userId ? 'task_id = $1 AND user_id = $2' : 'task_id = $1';
    const params = userId ? [taskId, userId] : [taskId];
    
    const result = await query(
      `DELETE FROM cover_generations WHERE ${whereClause}`,
      params
    );

    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Error deleting cover generation:', error);
    throw error;
  }
};
