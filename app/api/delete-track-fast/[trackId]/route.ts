import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth-utils-optimized';
import { deleteTrackOptimized } from '@/lib/track-delete-optimized';

// 强制动态渲染，但启用edge runtime以获得更好的性能
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { trackId: string } }
) {
  const startTime = Date.now();

  try {
    const { trackId } = params;

    // 快速参数验证
    if (!trackId) {
      return NextResponse.json(
        { success: false, error: 'Track ID is required' },
        { status: 400 }
      );
    }

    // 使用优化的认证函数 - 带缓存
    const authStartTime = Date.now();
    const userId = await getUserIdFromRequest(request, true); // useCache = true
    const authDuration = Date.now() - authStartTime;

    if (!userId) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Please log in to delete track'
        },
        { status: 401 }
      );
    }

    // 记录认证时间，如果过长则输出警告
    if (authDuration > 500) {
      console.warn(`Slow auth in delete-track: ${authDuration}ms for user ${userId}`);
    }

    // 使用优化的删除函数
    const deleteStartTime = Date.now();
    const result = await deleteTrackOptimized(trackId, userId);
    const deleteDuration = Date.now() - deleteStartTime;

    const totalDuration = Date.now() - startTime;

    // 记录性能数据
    console.log(`DELETE /api/delete-track/${trackId} completed in ${totalDuration}ms (auth: ${authDuration}ms, delete: ${deleteDuration}ms)`);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Track deleted successfully',
        // 可选：返回性能数据用于前端监控
        ...(process.env.NODE_ENV === 'development' && {
          _debug: {
            totalTime: totalDuration,
            authTime: authDuration,
            deleteTime: deleteDuration
          }
        })
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error
        },
        { status: result.statusCode || 500 }
      );
    }

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error(`Error deleting track after ${totalDuration}ms:`, error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete track',
        // 在开发环境下返回更多错误信息
        ...(process.env.NODE_ENV === 'development' && {
          _debug: {
            totalTime: totalDuration,
            errorType: error instanceof Error ? error.constructor.name : 'Unknown',
            errorMessage: error instanceof Error ? error.message : String(error)
          }
        })
      },
      { status: 500 }
    );
  }
}