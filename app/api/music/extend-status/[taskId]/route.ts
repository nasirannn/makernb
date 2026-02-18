/**
 * 扩展音乐状态查询 API
 * GET /api/music/extend-status/[taskId]
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-query-builder';

// 强制动态渲染
export const dynamic = 'force-dynamic';

/**
 * GET /api/music/extend-status/[taskId]
 * 查询扩展任务状态
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const requestId = `status_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  
  try {
    const { taskId } = await params;

    if (!taskId) {
      console.log(`[EXTEND-STATUS-${requestId}] Validation failed: taskId is required`);
      return NextResponse.json(
        { error: 'taskId is required' },
        { status: 400 }
      );
    }

    console.log(`[EXTEND-STATUS-${requestId}] Querying status for taskId: ${taskId}`);

    // 查询任务记录
    const musicResult = await query(
      `SELECT
        m.id as music_id,
        m.task_id,
        m.title,
        COALESCE(NULLIF(m.tags, ''), '') as genre,
        m.tags,
        m.generation_mode,
        m.status,
        m.type,
        m.original_music_id,
        m.created_at,
        m.updated_at
      FROM music m
      WHERE m.task_id = $1`,
      [taskId]
    );

    if (musicResult.rows.length === 0) {
      console.log(`[EXTEND-STATUS-${requestId}] Task not found: ${taskId}`);
      return NextResponse.json({
        code: 404,
        msg: `No extend music task found for task_id: ${taskId}`,
        data: { taskId, status: 'not_found', tracks: [] }
      });
    }

    const music = musicResult.rows[0];
    const musicType = music.type || 'generated';
    console.log(`[EXTEND-STATUS-${requestId}] Task found:`, {
      musicId: music.music_id,
      taskId: music.task_id,
      status: music.status,
      title: music.title,
      type: musicType,
    });

    // 查询 tracks（格式与音乐生成接口一致）
    const tracksResult = await query(
      `SELECT 
        mt.id as track_id,
        mt.suno_track_id,
        mt.audio_url,
        mt.stream_audio_url,
        mt.duration,
        mt.cover_image_url,
        mt.created_at,
        mt.original_track_id,
        COALESCE(mt.title, mg.title) as title,
        COALESCE(NULLIF(mg.tags, ''), '') as genre,
        mg.tags as tags,
        mg.prompt as prompt,
        mg.generation_mode as generation_mode,
        mg.type as music_type,
        (
          SELECT ml.content FROM lyrics ml
          WHERE ml.music_id = mg.id
          ORDER BY ml.created_at ASC
          LIMIT 1
        ) as lyrics_content
      FROM tracks mt
      INNER JOIN music mg ON mt.music_id = mg.id
      WHERE mg.task_id = $1
        AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
      ORDER BY mt.created_at ASC, mt.id ASC`,
      [taskId]
    );
    
    const tracks = tracksResult.rows.map((row: any) => ({
      // 基础信息
      id: row.track_id,
      suno_track_id: row.suno_track_id || null,
      createdAt: row.created_at,
      originalTrackId: row.original_track_id || null,
      
      // 文本数据
      title: row.title || '',
      tags: row.tags || '',
      genre: row.genre || null,
      prompt: row.prompt || '',
      generationMode: row.generation_mode || null,
      lyrics: row.lyrics_content || '',
      audioUrl: row.audio_url || row.stream_audio_url || '',
      streamAudioUrl: row.stream_audio_url || '',
      duration: row.duration || null,
      musicType: row.music_type || musicType,
      
      // 封面数据
      coverImage: row.cover_image_url || null,
    }));

    // 计算状态：与音乐生成接口保持一致
    // - complete: music.status === 'complete'
    // - error: music.status === 'error'
    // - generating: 否则
    let status: 'generating' | 'complete' | 'error' = 'generating';
    if (music.status === 'complete') {
      status = 'complete';
    } else if (music.status === 'error') {
      status = 'error';
    }

    // 如果是错误状态，查询错误信息
    let errorInfo = null;
    if (status === 'error') {
      console.log(`[EXTEND-STATUS-${requestId}] Querying error info for musicId: ${music.music_id}`);
      const errorResult = await query(
        `SELECT error_message, error_code FROM generation_errors 
         WHERE reference_id = $1 AND error_type = 'extend_music'
         ORDER BY created_at DESC LIMIT 1`,
        [music.music_id]
      );

      if (errorResult.rows.length > 0) {
        errorInfo = {
          errorMessage: errorResult.rows[0].error_message,
          errorCode: errorResult.rows[0].error_code,
        };
        console.log(`[EXTEND-STATUS-${requestId}] Error info found:`, errorInfo);
      }
    }

    console.log(`[EXTEND-STATUS-${requestId}] Status query completed:`, {
      taskId,
      status,
      tracksCount: tracks.length,
      hasError: !!errorInfo,
    });

    // 返回状态信息（格式与音乐生成接口一致）
    return NextResponse.json({
      code: 200,
      msg: 'Success',
      data: {
        taskId: music.task_id,
        generationId: music.music_id,
        status,
        tracks,
        errorInfo,
      },
    });
  } catch (error) {
    console.error(`[EXTEND-STATUS-${requestId}] Extend music status query error:`, error);
    return NextResponse.json(
      {
        error: 'Failed to get extend music status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
