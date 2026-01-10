import { NextRequest, NextResponse } from 'next/server';
import { getLyricsGeneration } from '@/features/lyrics-cover/lib/lyrics-db';

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const { taskId } = params;
    if (!taskId) {
      return NextResponse.json({ success: false, error: 'taskId is required' }, { status: 400 });
    }

    const record = await getLyricsGeneration(taskId);
    if (!record) {
      return NextResponse.json({ success: true, data: { status: 'not_found' } });
    }

    // 解析 content - 可能是 JSON 数组或普通字符串
    let lyricsArray;
    try {
      lyricsArray = JSON.parse(record.content);
      // 确保是数组格式
      if (!Array.isArray(lyricsArray)) {
        lyricsArray = [{ title: record.title, text: record.content }];
      }
    } catch {
      // 如果解析失败，说明是旧格式的普通字符串
      lyricsArray = [{ title: record.title, text: record.content }];
    }

    return NextResponse.json({
      success: true,
      data: {
        status: record.status,
        title: record.title,
        lyrics: lyricsArray, // 返回歌词数组
        taskId: record.task_id,
      },
    });
  } catch (error) {
    console.error('lyrics-status error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}


