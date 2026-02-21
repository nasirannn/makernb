import { NextRequest, NextResponse } from 'next/server';
import { getLyricsGeneration } from '@/features/lyrics-cover/lib/lyrics-db';
import { getGenerationErrorByReferenceId } from '@/lib/generation-errors-db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    if (!taskId) {
      return NextResponse.json({ success: false, error: 'taskId is required' }, { status: 400 });
    }

    const record = await getLyricsGeneration(taskId);
    if (!record) {
      return NextResponse.json({ success: true, data: { status: 'not_found' } });
    }

    let errorMessage: string | null = null;
    if (record.status === 'error') {
      try {
        const latestError = await getGenerationErrorByReferenceId('lyrics_generation', record.id);
        errorMessage = latestError?.error_message ?? null;
      } catch (error) {
        console.error('Failed to get lyrics generation error details:', error);
      }
    }

    const rawContent = typeof record.content === 'string' ? record.content : '';

    // 解析 content - 可能是 JSON 数组或普通字符串
    let lyricsArray;
    try {
      lyricsArray = JSON.parse(rawContent);
      // 确保是数组格式
      if (!Array.isArray(lyricsArray)) {
        lyricsArray = [{ title: record.title, text: rawContent }];
      }
    } catch {
      // 如果解析失败，说明是旧格式的普通字符串
      lyricsArray = [{ title: record.title, text: rawContent }];
    }

    return NextResponse.json({
      success: true,
      data: {
        status: record.status,
        title: record.title,
        userPrompt: typeof (record as any).user_prompt === 'string' ? (record as any).user_prompt : null,
        lyrics: lyricsArray, // 返回歌词数组
        taskId: record.task_id,
        error: errorMessage,
      },
    });
  } catch (error) {
    console.error('lyrics-status error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
