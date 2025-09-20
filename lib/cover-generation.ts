import MusicApiService, { GenerateCoverRequest } from '@/lib/music-api';
import { createCoverGeneration } from '@/lib/cover-db';
import { query } from '@/lib/neon';


/**
 * 直接调用track cover生成逻辑（用于服务端回调）
 * @param taskId 音乐生成任务ID
 * @param userId 用户ID
 * @returns track cover生成结果
 */
export async function generateTrackCoversDirectly(taskId: string, userId: string) {
  try {
    // 获取该任务的所有tracks
    const musicGenQuery = await query(`
      SELECT id FROM music_generations WHERE task_id = $1
    `, [taskId]);
    
    const musicGenerationId = musicGenQuery.rows[0]?.id;
    if (!musicGenerationId) {
      return {
        success: false,
        error: 'Music generation not found'
      };
    }

    const tracksQuery = await query(`
      SELECT id, suno_track_id, title, tags FROM music_tracks 
      WHERE music_generation_id = $1
      ORDER BY created_at ASC
    `, [musicGenerationId]);
    
    const tracks = tracksQuery.rows;
    
    if (tracks.length === 0) {
      return {
        success: false,
        error: 'No tracks found for this task'
      };
    }

    const apiKey = process.env.SUNO_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: 'API key not configured'
      };
    }

    const musicApi = new MusicApiService(apiKey);
    const results = [];

    // 为每个track生成独立的封面
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      
      try {
        // 为每个track创建独立的封面生成记录
        const coverRecord = await createCoverGeneration(`${taskId}_track_${i + 1}`, {
          user_id: userId
        });
        
        // 封面数据现在通过cover_images表管理，不需要更新music_tracks表
        console.log(`Cover data managed through cover_images table for track: ${track.id}`);
        
        // 调用封面生成API
        const coverResult = await musicApi.generateCover({
          taskId: `${taskId}_track_${i + 1}` // 使用唯一的taskId
        });
        
        results.push({
          trackId: track.id,
          sunoTrackId: track.suno_track_id,
          title: track.title,
          coverGenerationId: coverRecord.id,
          coverResult
        });
        
        console.log(`Cover generation started for track ${i + 1}: ${track.title}`);
        
      } catch (error) {
        console.error(`Failed to generate cover for track ${i + 1}:`, error);
        results.push({
          trackId: track.id,
          sunoTrackId: track.suno_track_id,
          title: track.title,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      success: true,
      message: `Cover generation started for ${tracks.length} tracks`,
      results
    };

  } catch (error) {
    console.error('Track cover generation error:', error);
    return {
      success: false,
      error: 'Failed to generate track covers'
    };
  }
}
