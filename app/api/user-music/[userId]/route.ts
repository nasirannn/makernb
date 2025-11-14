import { NextRequest, NextResponse } from 'next/server';
import { getUserMusicGenerationsOptimized, batchCheckFavorites } from '@/lib/db-query-builder';
import { getUserIdFromRequest } from '@/lib/auth';

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

    // 直接查询用户音乐数据
    const rawData = await getUserMusicGenerationsOptimized(userId, limit, offset);

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
            track.isFavorited = favoriteStatus[track.id] || false; // 映射数据库字段为 JavaScript 字段名
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
        isInstrumental: row.is_instrumental, // 映射数据库字段为 JavaScript 字段名
        status: row.status,
        createdAt: row.generation_created_at, // 映射数据库字段为 JavaScript 字段名
        updatedAt: row.generation_updated_at, // 映射数据库字段为 JavaScript 字段名
        lyricsContent: row.lyrics_content, // 映射数据库字段为 JavaScript 字段名
        // 扩展相关字段（从 music 表获取）
        isExtension: row.is_extension || false,
        originalMusicId: row.original_music_id,
        // originalTrackId 现在从 tracks 表获取，所以这里先设为 undefined，后续从 track 中获取
        originalTrackId: undefined,
        originalTrackTitle: row.original_track_title,
        allTracks: [],
        totalDuration: 0,
        errorInfo: row.error_message ? {
          errorMessage: row.error_message, // 映射数据库字段为 JavaScript 字段名
          errorCode: row.error_code // 映射数据库字段为 JavaScript 字段名
        } : null
      });
    }

    // 添加track数据
    if (row.track_id) {
      const generation = generationsMap.get(generationId);
      const track = {
        id: row.track_id,
        sunoTrackId: row.suno_track_id, // 映射数据库字段为 JavaScript 字段名
        audioUrl: row.audio_url, // 映射数据库字段为 JavaScript 字段名
        streamAudioUrl: row.stream_audio_url, // 映射数据库字段为 JavaScript 字段名
        duration: row.duration,
        isPublished: row.is_published, // 映射数据库字段为 JavaScript 字段名
        isPinned: row.is_pinned, // 映射数据库字段为 JavaScript 字段名
        createdAt: row.track_created_at, // 映射数据库字段为 JavaScript 字段名
        coverR2Url: row.cover_r2_url, // 映射数据库字段为 JavaScript 字段名
        title: row.track_title, // 使用 COALESCE(tracks.title, music.title) 的结果
        lyrics: row.lyrics_content || '',
        // wavR2Url 不再在列表加载时查询，只在下载时查询 track_wav_conversions 表
        // 扩展相关字段（从 track 和 generation 获取）
        isExtension: generation.isExtension,
        originalMusicId: generation.originalMusicId,
        originalTrackId: row.original_track_id || generation.originalTrackId, // 优先使用 track 的 original_track_id
        originalTrackTitle: row.original_track_title || generation.originalTrackTitle,
      };

      generation.allTracks.push(track);

      // 计算总时长
      const duration = typeof row.duration === 'string' ? parseFloat(row.duration) : (row.duration || 0);
      generationsMap.get(generationId).totalDuration += duration;
    }
  }

  return Array.from(generationsMap.values());
}
