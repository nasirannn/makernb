import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { query } from '@/lib/db-query-builder';

export const dynamic = 'force-dynamic';

/**
 * 获取用户的 Studio tracks（用于人声分离选择）
 * GET /api/studio-tracks-for-separation?limit=50
 */
export async function GET(request: NextRequest) {
  try {
    // 获取用户ID
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    // 查询用户的 tracks，必须有 audio_url
    // 注意：KIE API 需要 suno_track_id，所以我们会标记哪些 tracks 可以用于分离
    // 排除纯器乐歌曲（is_instrumental = true），因为没有人声无法进行分离
    const result = await query(
      `SELECT 
        mt.id as track_id,
        mt.suno_track_id as audio_id,
        mt.music_id,
        COALESCE(mt.title, mg.title) as title,
        mt.audio_url,
        mt.duration,
        mt.cover_image_url as cover_r2_url,
        mg.tags,
        mg.genre,
        mg.created_at as music_created_at
      FROM tracks mt
      INNER JOIN music mg ON mt.music_id = mg.id
      WHERE mg.user_id = $1::uuid
        AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
        AND mt.audio_url IS NOT NULL
        AND mt.audio_url != ''
        AND (mg.is_instrumental IS NULL OR mg.is_instrumental = FALSE)
      ORDER BY mg.created_at DESC
      LIMIT $2`,
      [userId, limit]
    );

    const tracks = result.rows.map((row: any) => ({
      id: row.track_id,
      trackId: row.track_id,
      audioId: row.audio_id || null,
      musicId: row.music_id,
      title: row.title || 'Untitled Track',
      audioUrl: row.audio_url,
      duration: typeof row.duration === 'number' ? row.duration : parseFloat(row.duration || '0'),
      coverR2Url: row.cover_r2_url, // 映射数据库字段为 JavaScript 字段名
      tags: row.tags || '',
      genre: row.genre || '',
      createdAt: row.music_created_at,
      // 标记是否可以用于人声分离（KIE API 需要 audioId）
      canSeparate: !!row.audio_id && row.audio_id !== ''
    }));

    return NextResponse.json({
      success: true,
      data: tracks,
      count: tracks.length
    });
  } catch (error) {
    console.error('Get studio tracks for separation error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Internal server error' },
      { status: 500 }
    );
  }
}

