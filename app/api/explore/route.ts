import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';

// 强制动态渲染
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 获取公开的音乐生成记录及其tracks
    const result = await query(`
      SELECT 
        mg.id,
        mg.title,
        mg.genre,
        mg.style,
        mg.prompt,
        mg.created_at,
        mg.updated_at,
        ml.content as lyrics_content,
        -- 获取第一个track的信息作为主要展示
        (
          SELECT json_build_object(
            'id', mt.id,
            'audio_url', mt.audio_url,
            'duration', mt.duration,
            'side_letter', mt.side_letter,
            'cover_r2_url', (
              SELECT ci.r2_url
              FROM cover_images ci
              WHERE ci.music_track_id = mt.id
              ORDER BY ci.created_at ASC
              LIMIT 1
            )
          )
          FROM music_tracks mt
          WHERE mt.music_generation_id = mg.id
            AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
          ORDER BY mt.side_letter ASC
          LIMIT 1
        ) as primary_track,
        -- 获取所有tracks信息
        (
          SELECT json_agg(
            json_build_object(
              'id', mt.id,
              'audio_url', mt.audio_url,
              'duration', mt.duration,
              'side_letter', mt.side_letter,
              'cover_r2_url', (
                SELECT ci.r2_url
                FROM cover_images ci
                WHERE ci.music_track_id = mt.id
                ORDER BY ci.created_at ASC
                LIMIT 1
              )
            ) ORDER BY mt.side_letter ASC
          )
          FROM music_tracks mt
          WHERE mt.music_generation_id = mg.id
            AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
        ) as all_tracks,
        -- 获取所有tracks的总时长
        (
          SELECT COALESCE(SUM(CAST(mt.duration AS NUMERIC)), 0)
          FROM music_tracks mt
          WHERE mt.music_generation_id = mg.id
            AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
        ) as total_duration,
        -- 获取tracks数量
        (
          SELECT COUNT(*)
          FROM music_tracks mt
          WHERE mt.music_generation_id = mg.id
            AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
        ) as track_count
      FROM music_generations mg
      LEFT JOIN music_lyrics ml ON mg.id = ml.music_generation_id
      WHERE mg.is_private = false 
        AND mg.status = 'complete'
      ORDER BY mg.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    // 过滤掉没有tracks的记录
    const musicGenerations = result.rows
      .filter(row => row.primary_track)
      .map(row => ({
        id: row.id,
        title: row.title,
        genre: row.genre,
        style: row.style,
        prompt: row.prompt,
        lyrics: row.lyrics_content,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        primaryTrack: row.primary_track,
        allTracks: row.all_tracks || [row.primary_track],
        totalDuration: parseFloat(row.total_duration) || 0,
        trackCount: parseInt(row.track_count) || 1
      }));

    return NextResponse.json({
      success: true,
      data: {
        music: musicGenerations,
        count: musicGenerations.length,
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
