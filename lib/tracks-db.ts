import { query } from './neon';

export interface MusicTrack {
  id?: string;
  music_generation_id: string;
  suno_track_id: string;
  audio_url?: string;
  duration?: number;
  side_letter?: 'A' | 'B';
  created_at?: string;
  updated_at?: string;
}

export async function createMusicTrack(track: MusicTrack): Promise<string> {
  const result = await query(`
    INSERT INTO music_tracks (
      music_generation_id,
      suno_track_id,
      audio_url,
      duration,
      side_letter
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING id
  `, [
    track.music_generation_id,
    track.suno_track_id,
    track.audio_url || null,
    track.duration || null,
    track.side_letter || 'A'
  ]);
  
  return result.rows[0].id;
}

export async function getMusicTracksByGenerationId(musicGenerationId: string): Promise<any[]> {
  const result = await query(`
    SELECT 
      mt.*,
      ml.title as lyrics_title,
      ml.content as lyrics_content,
      mg.title as music_title,
      mg.genre,
      mg.style,
      mg.prompt
    FROM music_tracks mt
    LEFT JOIN music_lyrics ml ON mt.music_generation_id = ml.music_generation_id
    LEFT JOIN music_generations mg ON mt.music_generation_id = mg.id
    WHERE mt.music_generation_id = $1
    ORDER BY mt.created_at ASC
  `, [musicGenerationId]);
  
  return result.rows;
}

export async function updateMusicTrack(trackId: string, updates: Partial<MusicTrack>): Promise<void> {
  const updateFields = [];
  const updateValues = [];
  
  if (updates.audio_url !== undefined) {
    updateFields.push('audio_url = $' + (updateFields.length + 1));
    updateValues.push(updates.audio_url);
  }
  if (updates.duration !== undefined) {
    updateFields.push('duration = $' + (updateFields.length + 1));
    updateValues.push(updates.duration);
  }
  if (updates.side_letter !== undefined) {
    updateFields.push('side_letter = $' + (updateFields.length + 1));
    updateValues.push(updates.side_letter);
  }
  
  if (updateFields.length === 0) return;
  
  updateValues.push(trackId);
  
  await query(`
    UPDATE music_tracks 
    SET ${updateFields.join(', ')}
    WHERE id = $${updateValues.length}
  `, updateValues);
}

// 切换 track 的置顶状态
export async function toggleTrackPin(trackId: string): Promise<boolean> {
  try {
    const result = await query(`
      UPDATE music_tracks 
      SET is_pinned = NOT is_pinned, updated_at = NOW()
      WHERE id = $1
      RETURNING is_pinned
    `, [trackId]);
    
    return result.rows.length > 0 ? result.rows[0].is_pinned : false;
  } catch (error) {
    console.error('Error toggling track pin:', error);
    throw error;
  }
}

// 获取所有置顶的 tracks
export async function getPinnedTracks(): Promise<any[]> {
  try {
    const result = await query(`
      SELECT 
        t.*,
        mg.title as music_title,
        mg.genre,
        mg.style,
        mg.prompt,
        mg.created_at as generation_created_at,
        mg.user_id,
        (
          SELECT ci.r2_url
          FROM cover_images ci
          WHERE ci.music_track_id = t.id
          ORDER BY ci.created_at ASC
          LIMIT 1
        ) as cover_r2_url
      FROM music_tracks t
      LEFT JOIN music_generations mg ON t.music_generation_id = mg.id
      WHERE t.is_pinned = TRUE AND mg.is_deleted = FALSE
      ORDER BY t.updated_at DESC
    `);
    
    return result.rows;
  } catch (error) {
    console.error('Error getting pinned tracks:', error);
    throw error;
  }
}
