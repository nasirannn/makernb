import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-query-builder';
import { getUserIdFromRequest } from '@/lib/auth';

// 强制动态渲染
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { trackId: string } }
) {
  try {
    const trackId = params.trackId;

    if (!trackId) {
      return NextResponse.json(
        { error: 'Track ID is required' },
        { status: 400 }
      );
    }

    // 获取请求用户ID（用于收藏状态检查）
    const requestUserId = await getUserIdFromRequest(request);

    // 查询 track 信息
    const trackResult = await query(
      `SELECT 
        mt.id as track_id,
        mt.suno_track_id,
        mt.audio_url,
        mt.stream_audio_url,
        mt.duration,
        mt.is_published,
        mt.is_pinned,
        mt.created_at as track_created_at,
        mt.cover_image_url as cover_r2_url,
        mg.id as generation_id,
        COALESCE(mt.title, mg.title) as title,
        mg.genre,
        mg.tags,
        mg.prompt,
        mg.is_instrumental,
        mg.status,
        mg.user_id,
        mg.created_at as generation_created_at,
        ml.content as lyrics_content
      FROM tracks mt
      INNER JOIN music mg ON mt.music_id = mg.id
      LEFT JOIN lyrics ml ON mg.id = ml.music_id
      WHERE mt.id = $1::uuid
        AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
      ORDER BY ml.created_at ASC
      LIMIT 1`,
      [trackId]
    );

    if (trackResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 }
      );
    }

    const row = trackResult.rows[0];

    // 构建 track 信息
    const track: {
      id: any;
      suno_track_id: any;
      audioUrl: any;
      streamAudioUrl: any;
      duration: any;
      isPublished: any;
      isPinned: any;
      createdAt: any;
      coverImage: any;
      generationId: any;
      title: any;
      genre: any;
      tags: any;
      prompt: any;
      isInstrumental: any;
      status: any;
      userId: any;
      generationCreatedAt: any;
      lyrics: any;
      isFavorited: boolean;
    } = {
      id: row.track_id,
      suno_track_id: row.suno_track_id,
      audioUrl: row.audio_url,
      streamAudioUrl: row.stream_audio_url,
      duration: row.duration,
      isPublished: row.is_published,
      isPinned: row.is_pinned,
      createdAt: row.track_created_at,
      coverImage: row.cover_r2_url,
      generationId: row.generation_id,
      title: row.title,
      genre: row.genre,
      tags: row.tags,
      prompt: row.prompt,
      isInstrumental: row.is_instrumental,
      status: row.status,
      userId: row.user_id,
      generationCreatedAt: row.generation_created_at,
      lyrics: row.lyrics_content || '',
      isFavorited: false, // 初始值，稍后会根据用户状态更新
    };

    // 如果有请求用户，检查收藏状态
    if (requestUserId) {
      const favoriteResult = await query(
        'SELECT id FROM user_favorites WHERE user_id = $1::uuid AND track_id = $2::uuid',
        [requestUserId, trackId]
      );
      
      track.isFavorited = favoriteResult.rows.length > 0;
    } else {
      track.isFavorited = false;
    }

    return NextResponse.json({
      success: true,
      track
    });

  } catch (error) {
    console.error('Get track info error:', error);

    return NextResponse.json(
      {
        error: 'Failed to get track info',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
