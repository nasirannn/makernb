import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-query-builder';

// 强制动态渲染
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // 直接查询置顶的歌曲
    const result = await query(`
      SELECT 
        mt.id,
        mt.audio_url,
        mt.duration,
        mt.side_letter,
        mt.created_at,
        mt.updated_at,
        mg.id as music_generation_id,
        mg.title,
        mg.genre,
        mg.tags,
        mg.prompt,
        mg.created_at as generation_created_at,
        mg.user_id as track_owner_id,
        (
          SELECT ci.r2_url
          FROM cover_images ci
          WHERE ci.music_track_id = mt.id
          ORDER BY ci.created_at ASC
          LIMIT 1
        ) as cover_r2_url
      FROM music_tracks mt
      JOIN music_generations mg ON mt.music_generation_id = mg.id
      WHERE mt.is_pinned = TRUE
        AND mg.is_deleted = FALSE
      ORDER BY mt.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const pinnedTracks = result.rows;
    const hasMore = pinnedTracks.length === limit;

    return NextResponse.json({
      success: true,
      data: {
        tracks: pinnedTracks,
        count: pinnedTracks.length,
        limit,
        offset,
        hasMore
      }
    });

  } catch (error) {
    console.error('Error fetching pinned tracks:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error occurred while fetching pinned tracks',
        success: false 
      },
      { status: 500 }
    );
  }
}
