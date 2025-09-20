import { NextRequest, NextResponse } from 'next/server';
import { getTimestampedLyrics, GetTimestampedLyricsRequest } from '@/lib/timestamped-lyrics-api';

export async function POST(request: NextRequest) {
  try {
    const body: GetTimestampedLyricsRequest = await request.json();
    
    // 验证必需参数
    if (!body.taskId || !body.audioId) {
      return NextResponse.json(
        { 
          error: 'Missing required parameters: taskId and audioId are required' 
        },
        { status: 400 }
      );
    }

    // 调用 KIE API 获取时间戳歌词
    const result = await getTimestampedLyrics(body);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting timestamped lyrics:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get timestamped lyrics',
        details: error instanceof Error ? error instanceof Error ? error.message : 'Unknown error' : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
