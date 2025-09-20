import { query } from './neon';

export interface CoverImage {
  id: string;
  cover_generation_id: string;
  music_track_id?: string;
  r2_url: string;
  filename?: string;
  created_at: string;
}

// 创建封面图片记录
export const createCoverImage = async (
  coverGenerationId: string,
  r2Url: string,
  filename?: string
): Promise<CoverImage> => {
  try {
    const result = await query(
      `INSERT INTO cover_images (cover_generation_id, r2_url, filename)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [coverGenerationId, r2Url, filename]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error creating cover image:', error);
    throw error;
  }
};

// 批量创建封面图片记录
export const createCoverImages = async (
  coverGenerationId: string,
  r2Urls: string[], // R2 URLs
  originalFilenames?: string[] // 原始文件名数组
): Promise<CoverImage[]> => {
  try {
    const results: CoverImage[] = [];
    
    for (let i = 0; i < r2Urls.length; i++) {
      const r2Url = r2Urls[i];
      // 使用原始文件名，如果没有则使用默认命名
      const filename = originalFilenames?.[i] || `cover_${i + 1}.png`;
      
      const result = await createCoverImage(coverGenerationId, r2Url, filename);
      results.push(result);
    }
    
    return results;
  } catch (error) {
    console.error('Error creating cover images:', error);
    throw error;
  }
};

// 获取封面生成的所有图片
export const getCoverImages = async (coverGenerationId: string): Promise<CoverImage[]> => {
  try {
    const result = await query(
      `SELECT * FROM cover_images 
       WHERE cover_generation_id = $1 
       ORDER BY created_at ASC`,
      [coverGenerationId]
    );

    return result.rows;
  } catch (error) {
    console.error('Error getting cover images:', error);
    throw error;
  }
};

// 通过music_track_id获取封面图片（直接关联查询）
export const getCoverImagesByTrackId = async (musicTrackId: string): Promise<CoverImage[]> => {
  try {
    const result = await query(
      `SELECT * FROM cover_images 
       WHERE music_track_id = $1 
       ORDER BY created_at ASC`,
      [musicTrackId]
    );

    return result.rows;
  } catch (error) {
    console.error('Error getting cover images by track ID:', error);
    throw error;
  }
};

// 更新封面图片的R2 URL
export const updateCoverImageR2Url = async (
  id: string,
  r2Url: string
): Promise<void> => {
  try {
    await query(
      'UPDATE cover_images SET r2_url = $1 WHERE id = $2',
      [r2Url, id]
    );
  } catch (error) {
    console.error('Error updating cover image R2 URL:', error);
    throw error;
  }
};
