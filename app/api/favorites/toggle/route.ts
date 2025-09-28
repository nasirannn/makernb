import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth-utils';
import { toggleFavorite } from '@/lib/favorites-db';

// 强制动态渲染
export const dynamic = 'force-dynamic';

// 切换收藏状态
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { 
          error: 'Authentication required',
          message: 'Please log in to favorite tracks'
        },
        { status: 401 }
      );
    }

    const { trackId } = await request.json();

    if (!trackId) {
      return NextResponse.json(
        { error: 'Track ID is required' },
        { status: 400 }
      );
    }

    console.log('Toggle favorite for track:', trackId, 'by user:', userId);
    
    const isFavorited = await toggleFavorite(userId, trackId);
    console.log('Track favorite status after toggle:', isFavorited);

    return NextResponse.json({
      success: true,
      isFavorited,
      message: isFavorited ? 'Track added to favorites' : 'Track removed from favorites'
    });

  } catch (error) {
    console.error('Toggle favorite error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error occurred while toggling favorite',
        success: false 
      },
      { status: 500 }
    );
  }
}
