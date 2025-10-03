import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-query-builder';

// 强制动态渲染
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const genre = searchParams.get('genre');

    // 获取公开的音乐tracks
    const result = await query(`
      SELECT 
        mt.id as track_id,
        mt.audio_url,
        mt.duration,
        mt.side_letter,
        mt.is_pinned,
        mt.created_at as track_created_at,
        mg.id as generation_id,
        mg.title,
        mg.genre,
        mg.tags,
        mg.prompt,
        mg.created_at as generation_created_at,
        mg.updated_at,
        ml.content as lyrics_content,
        ci.r2_url as cover_r2_url
      FROM music_tracks mt
      JOIN music_generations mg ON mt.music_generation_id = mg.id
      LEFT JOIN music_lyrics ml ON mg.id = ml.music_generation_id
      LEFT JOIN cover_images ci ON mt.id = ci.music_track_id
      WHERE mt.is_published = TRUE
        AND mg.status = 'complete'
        AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
        ${genre && genre !== 'all' ? `AND mg.genre = $3` : ''}
      ORDER BY 
        CASE WHEN mt.is_pinned = TRUE THEN 0 ELSE 1 END,
        mt.created_at DESC
      LIMIT $1 OFFSET $2
    `, genre && genre !== 'all' ? [limit, offset, genre] : [limit, offset]);

    // 将tracks数据转换为前端需要的格式
    const tracks = result.rows.map(row => ({
      id: row.track_id,
      title: row.title,
      genre: row.genre,
      tags: row.tags,
      prompt: row.prompt,
      lyrics: row.lyrics_content,
      createdAt: row.generation_created_at,
      updatedAt: row.updated_at,
      primaryTrack: {
        id: row.track_id,
        audio_url: row.audio_url,
        duration: row.duration,
        side_letter: row.side_letter,
        cover_r2_url: row.cover_r2_url
      },
      allTracks: [{
        id: row.track_id,
        audio_url: row.audio_url,
        duration: row.duration,
        side_letter: row.side_letter,
        cover_r2_url: row.cover_r2_url
      }],
      totalDuration: parseFloat(row.duration) || 0,
      trackCount: 1
    }));

    return NextResponse.json({
      success: true,
      data: {
        music: tracks,
        count: tracks.length,
        limit,
        offset
      }
    });
  } catch (error) {
    console.error('Error fetching public music:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch public music',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
