import { NextRequest, NextResponse } from 'next/server';
import { getUserMusicGenerations } from '@/lib/music-db';

// 强制动态渲染
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = params.userId;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const music = await getUserMusicGenerations(userId, limit, offset);
    
    return NextResponse.json({
      success: true,
      data: {
        userId,
        music,
        count: music.length,
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
