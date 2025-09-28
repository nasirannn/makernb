import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
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
      'SELECT id, status, title, genre, tags FROM music_generations WHERE task_id = $1',
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
        mt.side_letter,
        mg.title as title,
        mg.genre as genre,
        mg.tags as tags,
        (
          SELECT ci.r2_url FROM cover_images ci
          WHERE ci.music_track_id = mt.id
          ORDER BY ci.created_at ASC
          LIMIT 1
        ) as cover_r2_url,
        (
          SELECT ml.content FROM music_lyrics ml
          WHERE ml.music_generation_id = mg.id
          ORDER BY ml.created_at ASC
          LIMIT 1
        ) as lyrics_content
      FROM music_tracks mt
      INNER JOIN music_generations mg ON mt.music_generation_id = mg.id
      WHERE mg.task_id = $1
      ORDER BY mt.side_letter ASC, mt.created_at ASC`,
      [taskId]
    );
    // 检查是否完成最终音频生成
    const isComplete = generation.status === 'complete';
    
    const tracks = tracksResult.rows.map((row: any) => ({
      // 基础信息
      id: row.track_id,
      sideLetter: row.side_letter,
      
      // 文本数据 - text回调时就有
      title: row.title || '',
      tags: row.tags || '',
      genre: row.genre || null,
      lyrics: row.lyrics_content || '',
      streamAudioUrl: row.stream_audio_url || '',
      
      // 最终音频数据 - complete回调时才有
      audioUrl: isComplete ? (row.audio_url || '') : '',
      duration: isComplete ? (row.duration || null) : null,
      
      // 封面数据 - 图片回调时就有
      coverImage: row.cover_r2_url || null,
    }));

    // 计算状态：与数据库状态完全统一
    // - complete: generation.status === 'complete'
    // - first: generation.status === 'first' (first回调完成，第一首歌有最终音频)
    // - text: generation.status === 'text' (text回调完成，包含文本和stream_audio_url)
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

