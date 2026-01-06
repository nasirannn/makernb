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
        COALESCE(mt.play_count, 0) as play_count,
        mt.created_at,
        mt.updated_at,
        mg.id as music_id,
        COALESCE(mt.title, mg.title) as title,
        mg.genre,
        mg.tags,
        mg.prompt,
        mg.created_at as generation_created_at,
        mg.user_id as track_owner_id,
        mt.cover_image_url as cover_r2_url
      FROM tracks mt
      JOIN music mg ON mt.music_id = mg.id
      WHERE mt.is_pinned = TRUE
        AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
      ORDER BY mt.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    // 将tracks数据转换为前端需要的格式（使用驼峰命名）
    const pinnedTracks = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      genre: row.genre,
      tags: row.tags,
      prompt: row.prompt,
      audioUrl: row.audio_url, // 映射数据库字段为 JavaScript 字段名
      duration: row.duration,
      playCount: row.play_count,
      coverR2Url: row.cover_r2_url, // 映射数据库字段为 JavaScript 字段名
      createdAt: row.generation_created_at, // 映射数据库字段为 JavaScript 字段名
      updatedAt: row.updated_at, // 映射数据库字段为 JavaScript 字段名
      created_at: row.created_at, // 保留原始字段名用于兼容
      updated_at: row.updated_at, // 保留原始字段名用于兼容
      music_id: row.music_id, // 保留原始字段名用于兼容
      track_owner_id: row.track_owner_id // 保留原始字段名用于兼容
    }));
    
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
