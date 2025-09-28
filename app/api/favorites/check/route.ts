import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth-utils';
import { checkMultipleFavorites, isFavorited } from '@/lib/favorites-db';

// 强制动态渲染
export const dynamic = 'force-dynamic';

// 检查收藏状态
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { trackIds, trackId } = await request.json();

    // 支持单个track检查和批量检查
    if (trackId) {
      // 单个track检查
      const favorited = await isFavorited(userId, trackId);
      return NextResponse.json({
        success: true,
        isFavorited: favorited
      });
    } else if (trackIds && Array.isArray(trackIds)) {
      // 批量检查
      const favoriteStatus = await checkMultipleFavorites(userId, trackIds);
      return NextResponse.json({
        success: true,
        favorites: favoriteStatus
      });
    } else {
      return NextResponse.json(
        { error: 'Either trackId or trackIds array is required' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Check favorites error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error occurred while checking favorites',
        success: false 
      },
      { status: 500 }
    );
  }
}
