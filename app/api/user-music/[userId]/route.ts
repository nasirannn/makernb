import { NextRequest, NextResponse } from 'next/server';
import { getUserMusicGenerationsOptimized, cachedQuery, batchCheckFavorites } from '@/lib/db-query-builder';
import { getUserIdFromRequest } from '@/lib/auth-utils-optimized';

// 强制动态渲染
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = params.userId;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50); // 限制最大50
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // 获取请求用户ID（用于收藏状态检查）
    const requestUserId = await getUserIdFromRequest(request);

    // 使用缓存的查询，缓存时间5分钟
    const cacheKey = `user-music:${userId}:${limit}:${offset}`;
    const rawData = await cachedQuery(
      cacheKey,
      () => getUserMusicGenerationsOptimized(userId, limit, offset),
      300000 // 5分钟缓存
    );

    // 处理数据格式
    const musicGenerations = processUserMusicData(rawData);

    // 如果有请求用户，批量检查收藏状态
    if (requestUserId && musicGenerations.length > 0) {
      const allTrackIds: string[] = [];
      musicGenerations.forEach(generation => {
        generation.allTracks?.forEach((track: any) => {
          if (track.id) allTrackIds.push(track.id);
        });
      });

      if (allTrackIds.length > 0) {
        const favoriteStatus = await batchCheckFavorites(requestUserId, allTrackIds);

        // 添加收藏状态到tracks
        musicGenerations.forEach(generation => {
          generation.allTracks?.forEach((track: any) => {
            track.is_favorited = favoriteStatus[track.id] || false;
          });
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        userId,
        music: musicGenerations,
        count: musicGenerations.length,
        limit,
        offset
      }
    });

  } catch (error) {
    console.error('Get user music error:', error);

    return NextResponse.json(
      {
        error: 'Failed to get user music',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * 处理从优化查询返回的原始数据
 */
function processUserMusicData(rawData: any[]) {
  const generationsMap = new Map();

  for (const row of rawData) {
    const generationId = row.generation_id;

    if (!generationsMap.has(generationId)) {
      generationsMap.set(generationId, {
        id: generationId,
        title: row.title,
        genre: row.genre,
        tags: row.tags,
        prompt: row.prompt,
        is_instrumental: row.is_instrumental,
        status: row.status,
        created_at: row.generation_created_at,
        updated_at: row.generation_updated_at,
        lyrics_content: row.lyrics_content,
        allTracks: [],
        totalDuration: 0,
        errorInfo: row.error_message ? {
          error_message: row.error_message,
          error_code: row.error_code
        } : null
      });
    }

    // 添加track数据
    if (row.track_id) {
      const track = {
        id: row.track_id,
        suno_track_id: row.suno_track_id,
        audio_url: row.audio_url,
        duration: row.duration,
        side_letter: row.side_letter,
        is_published: row.is_published,
        is_pinned: row.is_pinned,
        created_at: row.track_created_at,
        cover_r2_url: row.cover_r2_url,
        lyrics: row.lyrics_content || ''
      };

      generationsMap.get(generationId).allTracks.push(track);

      // 计算总时长
      const duration = typeof row.duration === 'string' ? parseFloat(row.duration) : (row.duration || 0);
      generationsMap.get(generationId).totalDuration += duration;
    }
  }

  return Array.from(generationsMap.values());
}
