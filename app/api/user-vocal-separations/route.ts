import { NextRequest, NextResponse } from 'next/server';
import { getUserVocalSeparations } from '@/lib/vocal-separation-db';
import { getUserIdFromRequest } from '@/lib/auth-utils-optimized';

export async function GET(request: NextRequest) {
  const requestId = `user-separations_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[USER-VOCAL-SEPARATIONS-${requestId}] Getting user vocal separations`);

  try {
    // 检查用户是否登录
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      console.log(`[USER-VOCAL-SEPARATIONS-${requestId}] Authentication failed - no userId`);
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Please log in to view vocal separations'
        },
        { status: 401 }
      );
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    console.log(`[USER-VOCAL-SEPARATIONS-${requestId}] Querying separations for user: ${userId}, limit: ${limit}, offset: ${offset}`);

    // 获取用户的人声分离记录
    const separations = await getUserVocalSeparations(userId, limit, offset);

    console.log(`[USER-VOCAL-SEPARATIONS-${requestId}] Found ${separations.length} separations`);

    return NextResponse.json({
      success: true,
      data: separations,
      pagination: {
        limit,
        offset,
        hasMore: separations.length === limit
      }
    });
  } catch (error) {
    console.error(`[USER-VOCAL-SEPARATIONS-${requestId}] Unexpected error:`, error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}
