import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { getUserAvailableFeatures } from '@/lib/feature-permissions';

// 强制动态渲染
export const dynamic = 'force-dynamic';

/**
 * 获取用户所有可用的功能权限列表
 * 用于前端预加载权限，实现快速判断
 */
export async function GET(request: NextRequest) {
  try {
    // 获取用户ID
    const userId = await getUserIdFromRequest(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 获取用户所有可用功能
    const features = await getUserAvailableFeatures(userId);

    return NextResponse.json({
      features,
      userId
    });

  } catch (error) {
    console.error('[USER-PERMISSIONS] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch user permissions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

