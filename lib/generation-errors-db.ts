import { query } from './db-query-builder';

export interface GenerationError {
  id: string;
  error_type: 'music_generation' | 'lyrics_generation';
  reference_id: string;
  error_code?: string;
  error_message: string;
  created_at: string;
  updated_at: string;
}

// 创建生成错误记录
export const createGenerationError = async (
  errorType: 'music_generation' | 'lyrics_generation',
  referenceId: string,
  errorMessage: string,
  errorCode?: string
): Promise<GenerationError> => {
  try {
    const result = await query(
      `INSERT INTO generation_errors (
        error_type, reference_id, error_code, error_message
      ) VALUES ($1, $2, $3, $4) 
      RETURNING *`,
      [errorType, referenceId, errorCode, errorMessage]
    );

    return result.rows[0] as GenerationError;
  } catch (error) {
    console.error('Failed to create generation error:', error);
    throw error;
  }
};

// 根据引用ID获取错误信息
export const getGenerationErrorByReferenceId = async (
  errorType: 'music_generation' | 'lyrics_generation',
  referenceId: string
): Promise<GenerationError | null> => {
  try {
    const result = await query(
      `SELECT * FROM generation_errors 
       WHERE error_type = $1 AND reference_id = $2 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [errorType, referenceId]
    );

    return result.rows[0] as GenerationError || null;
  } catch (error) {
    console.error('Failed to get generation error:', error);
    throw error;
  }
};

// 获取用户的所有错误记录
export const getUserGenerationErrors = async (
  userId: string,
  errorType?: 'music_generation' | 'lyrics_generation',
  limit: number = 50
): Promise<GenerationError[]> => {
  try {
    let queryText = `
      SELECT ge.* FROM generation_errors ge
      JOIN music_generations mg ON ge.reference_id = mg.id
      WHERE mg.user_id = $1
    `;
    const params: any[] = [userId];

    if (errorType) {
      queryText += ` AND ge.error_type = $2`;
      params.push(errorType);
      queryText += ` ORDER BY ge.created_at DESC LIMIT $3`;
      params.push(limit);
    } else {
      queryText += ` ORDER BY ge.created_at DESC LIMIT $2`;
      params.push(limit);
    }

    const result = await query(queryText, params);
    return result.rows as GenerationError[];
  } catch (error) {
    console.error('Failed to get user generation errors:', error);
    throw error;
  }
};

// 删除错误记录
export const deleteGenerationError = async (errorId: string): Promise<boolean> => {
  try {
    const result = await query(
      `DELETE FROM generation_errors WHERE id = $1`,
      [errorId]
    );

    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Failed to delete generation error:', error);
    throw error;
  }
};

// 根据引用ID删除错误记录
export const deleteGenerationErrorByReferenceId = async (
  errorType: 'music_generation' | 'lyrics_generation',
  referenceId: string
): Promise<boolean> => {
  try {
    const result = await query(
      `DELETE FROM generation_errors 
       WHERE error_type = $1 AND reference_id = $2`,
      [errorType, referenceId]
    );

    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Failed to delete generation error by reference ID:', error);
    throw error;
  }
};

// 清理过期的错误记录（超过30天）
export const cleanupExpiredErrors = async (): Promise<number> => {
  try {
    const result = await query(
      `DELETE FROM generation_errors 
       WHERE created_at < NOW() - INTERVAL '30 days'`
    );

    return result.rowCount ?? 0;
  } catch (error) {
    console.error('Failed to cleanup expired errors:', error);
    throw error;
  }
};
