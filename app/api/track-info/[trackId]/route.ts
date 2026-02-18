import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-query-builder';
import { getUserIdFromRequest } from '@/lib/auth';
import type { TrackInfoResponse } from '@/types/track';
import { ensureTrackReactionsSchema } from '@/lib/track-reactions-db';

// 强制动态渲染
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { trackId: string } }
) {
  try {
    // 使用解构方式获取 trackId，与其他路由保持一致
    const { trackId } = params;

    if (!trackId) {
      console.error('Track info API: trackId is missing from params');
      return NextResponse.json(
        { error: 'Track ID is required' },
        { status: 400 }
      );
    }

    // 获取请求用户ID（用于收藏状态检查）
    const requestUserId = await getUserIdFromRequest(request);
    await ensureTrackReactionsSchema();

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
        COALESCE(mt.is_liked, FALSE) as is_liked,
        COALESCE(mt.is_disliked, FALSE) as is_disliked,
        mg.id as generation_id,
        COALESCE(mt.title, mg.title) as title,
        COALESCE(NULLIF(mg.tags, ''), '') as genre,
        mg.tags,
        mg.prompt,
        mg.is_instrumental,
        mg.status,
        mg.model,
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
      console.warn(`Track info API: Track not found for trackId: ${trackId}`);
      return NextResponse.json(
        { error: 'Track not found', trackId },
        { status: 404 }
      );
    }

    const row = trackResult.rows[0];

    // 构建 track 信息
    const track: TrackInfoResponse = {
      id: row.track_id,
      sunoTrackId: row.suno_track_id, // 映射数据库字段为 JavaScript 字段名
      audioUrl: row.audio_url, // 映射数据库字段为 JavaScript 字段名
      streamAudioUrl: row.stream_audio_url, // 映射数据库字段为 JavaScript 字段名
      duration: row.duration,
      isPublished: row.is_published, // 映射数据库字段为 JavaScript 字段名
      isPinned: row.is_pinned, // 映射数据库字段为 JavaScript 字段名
      createdAt: row.track_created_at, // 映射数据库字段为 JavaScript 字段名
      coverImage: row.cover_r2_url, // 映射数据库字段为 JavaScript 字段名
      generationId: row.generation_id, // 映射数据库字段为 JavaScript 字段名
      title: row.title,
      tags: row.tags,
      prompt: row.prompt,
      isInstrumental: row.is_instrumental, // 映射数据库字段为 JavaScript 字段名
      status: row.status,
      model: row.model,
      userId: row.user_id, // 映射数据库字段为 JavaScript 字段名
      generationCreatedAt: row.generation_created_at, // 映射数据库字段为 JavaScript 字段名
      lyrics: row.lyrics_content || '',
      isFavorited: false, // 初始值，稍后会根据用户状态更新
      isLiked: row.is_liked ?? false,
      isDisliked: row.is_disliked ?? false,
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Failed to get track info',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
