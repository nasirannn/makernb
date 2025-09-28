import { NextRequest, NextResponse } from 'next/server';
import { softDeleteMusicTrack } from '@/lib/music-db';
import { getUserIdFromRequest } from '@/lib/auth-utils';

// 强制动态渲染
export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  try {
    // 检查用户是否登录
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { 
          error: 'Authentication required',
          message: 'Please log in to delete music track'
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get('id');

    console.log('Delete track API called with trackId:', trackId, 'userId:', userId);

    if (!trackId) {
      return NextResponse.json(
        { error: 'Track ID is required' },
        { status: 400 }
      );
    }

    // 执行软删除
    console.log('Calling softDeleteMusicTrack...');
    const deleted = await softDeleteMusicTrack(trackId, userId);
    console.log('softDeleteMusicTrack result:', deleted);

    if (!deleted) {
      return NextResponse.json(
        { 
          error: 'Track not found or already deleted',
          success: false 
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Music track deleted successfully'
    });

  } catch (error) {
    console.error('Delete music track error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error occurred during deletion',
        success: false 
      },
      { status: 500 }
    );
  }
}
