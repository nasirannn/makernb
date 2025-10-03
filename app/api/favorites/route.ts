import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth-utils-optimized';
import { getUserFavorites, getUserFavoritesCount } from '@/lib/favorites-db';

// 强制动态渲染
export const dynamic = 'force-dynamic';

// 获取用户收藏列表
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const [favorites, totalCount] = await Promise.all([
      getUserFavorites(userId, limit, offset),
      getUserFavoritesCount(userId)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        favorites,
        totalCount,
        count: favorites.length,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    });

  } catch (error) {
    console.error('Get favorites error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error occurred while getting favorites',
        success: false 
      },
      { status: 500 }
    );
  }
}
