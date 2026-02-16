import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-query-builder';
import { getGenerationErrorByReferenceId } from '@/lib/generation-errors-db';

// 强制动态渲染
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId parameter is required' },
        { status: 400 }
      );
    }

    // 查询任务记录
    const genResult = await query(
      'SELECT id, status, title, genre, tags, generation_mode, type FROM music WHERE task_id = $1',
      [taskId]
    );

    if (genResult.rows.length === 0) {
      console.error(`No music generation record found for task_id: ${taskId}`);
      return NextResponse.json({
        code: 404,
        msg: `No music generation record found for task_id: ${taskId}`,
        data: { taskId, status: 'not_found', tracks: [] }
      });
    }

    const generation = genResult.rows[0];

    // 查询tracks及其封面和歌词
    const tracksResult = await query(
      `SELECT 
        mt.id as track_id,
        mt.suno_track_id,
        mt.audio_url,
        mt.stream_audio_url,
        mt.duration,
        mt.cover_image_url,
        mt.created_at,
        COALESCE(mt.title, mg.title) as title,
        mg.genre as genre,
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
      suno_track_id: row.suno_track_id || null, // 添加 suno_track_id 用于匹配
      createdAt: row.created_at, // 添加创建时间
      
      // 文本数据 - text回调时就有
      title: row.title || '',
      tags: row.tags || '',
      genre: row.genre || null,
      prompt: row.prompt || '',
      generationMode: row.generation_mode || null,
      lyrics: row.lyrics_content || '',
      audioUrl: row.audio_url || row.stream_audio_url || '',
      streamAudioUrl: row.stream_audio_url || '',
      duration: row.duration || null, // first回调后就有duration，不需要等到complete
      musicType: row.music_type || generation.type || 'generated',
      
      // 封面数据 - 图片回调时就有
      coverImage: row.cover_image_url || null,
    }));

    // 计算状态：与数据库状态完全统一
    // - complete: generation.status === 'complete'
    // - first: generation.status === 'first' (first回调完成，第一首歌有最终音频)
    // - text: generation.status === 'text' (text回调完成，包含文本和stream audio)
    // - error: generation.status === 'error' (生成失败)
    // - generating: 否则
    let status: 'generating' | 'text' | 'first' | 'complete' | 'error' = 'generating';
    if (generation.status === 'text') {
      status = 'text';
    } else if (generation.status === 'first') {
      status = 'first';
    } else if (generation.status === 'complete') {
      status = 'complete';
    } else if (generation.status === 'error') {
      status = 'error';
    }

    // 如果是错误状态，获取错误信息
    let errorInfo = null;
    if (status === 'error') {
      try {
        errorInfo = await getGenerationErrorByReferenceId('music_generation', generation.id);
      } catch (error) {
        console.error('Failed to get error info for generation:', generation.id, error);
      }
    }

    return NextResponse.json({
      code: 200,
      msg: 'Success',
      data: {
        taskId,
        generationId: generation.id, // 添加generationId
        status,
        tracks,
        errorInfo: errorInfo ? {
          errorMessage: errorInfo.error_message,
          errorCode: errorInfo.error_code
        } : null
      }
    });
  } catch (error) {
    console.error('Get music status error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get music status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
