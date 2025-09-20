import { NextRequest, NextResponse } from 'next/server';
import { getLyricsGeneration } from '@/lib/lyrics-db';

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

    return NextResponse.json({
      success: true,
      data: {
        status: record.status,
        title: record.title,
        content: record.content,
        taskId: record.task_id,
      },
    });
  } catch (error) {
    console.error('lyrics-status error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}


