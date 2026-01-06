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

    // 首先获取总数
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM tracks mt
      JOIN music mg ON mt.music_id = mg.id
      WHERE mt.is_published = TRUE
        AND mg.status = 'complete'
        AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
        ${genre && genre !== 'all' ? `AND mg.genre = $1` : ''}
    `, genre && genre !== 'all' ? [genre] : []);

    const totalCount = parseInt(countResult.rows[0].total);

    // 获取公开的音乐tracks（分页）
    const result = await query(`
      SELECT 
        mt.id as track_id,
        mt.audio_url,
        mt.duration,
        COALESCE(mt.play_count, 0) as play_count,
        mt.is_pinned,
        mt.created_at as track_created_at,
        mg.id as generation_id,
        COALESCE(mt.title, mg.title) as title,
        mg.genre,
        mg.tags,
        mg.prompt,
        mg.model,
        mg.created_at as generation_created_at,
        mg.updated_at,
        ml.content as lyrics_content,
        mt.cover_image_url as cover_r2_url
      FROM tracks mt
      JOIN music mg ON mt.music_id = mg.id
      LEFT JOIN lyrics ml ON mg.id = ml.music_id
      WHERE mt.is_published = TRUE
        AND mg.status = 'complete'
        AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
        ${genre && genre !== 'all' ? `AND mg.genre = $3` : ''}
      ORDER BY 
        CASE WHEN mt.is_pinned = TRUE THEN 0 ELSE 1 END,
        mt.created_at DESC
      LIMIT $1 OFFSET $2
    `, genre && genre !== 'all' ? [limit, offset, genre] : [limit, offset]);

    // 将tracks数据转换为前端需要的格式（使用驼峰命名）
    const tracks = result.rows.map(row => ({
      id: row.track_id,
      title: row.title,
      genre: row.genre,
      tags: row.tags,
      prompt: row.prompt,
      model: row.model,
      lyrics: row.lyrics_content,
      createdAt: row.generation_created_at,
      updatedAt: row.updated_at,
      primaryTrack: {
        id: row.track_id,
        audioUrl: row.audio_url, // 映射数据库字段为 JavaScript 字段名
        duration: row.duration,
        coverR2Url: row.cover_r2_url, // 映射数据库字段为 JavaScript 字段名
        playCount: row.play_count
      },
      allTracks: [{
        id: row.track_id,
        audioUrl: row.audio_url, // 映射数据库字段为 JavaScript 字段名
        duration: row.duration,
        coverR2Url: row.cover_r2_url, // 映射数据库字段为 JavaScript 字段名
        playCount: row.play_count
      }],
      totalDuration: parseFloat(row.duration) || 0,
      trackCount: 1
    }));

    return NextResponse.json({
      success: true,
      data: {
        music: tracks,
        count: totalCount, // 使用实际的总数
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
