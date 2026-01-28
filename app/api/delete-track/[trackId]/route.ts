import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { hardDeleteTrack } from '@/lib/track-delete';

// 强制动态渲染
export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { trackId: string } }
) {
  const startTime = Date.now();

  try {
    const { trackId } = params;

    if (!trackId) {
      return NextResponse.json(
        { success: false, error: 'Track ID is required' },
        { status: 400 }
      );
    }

    // 使用优化的认证函数 - 禁用缓存以排除缓存问题
    const authStartTime = Date.now();
    const userId = await getUserIdFromRequest(request, false); // 禁用缓存
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

    // 使用优化的删除函数
    const deleteStartTime = Date.now();
    const result = await hardDeleteTrack(trackId, userId);
    const deleteDuration = Date.now() - deleteStartTime;
    const totalDuration = Date.now() - startTime;

    console.log(`DELETE completed in ${totalDuration}ms (auth: ${authDuration}ms, delete: ${deleteDuration}ms)`);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Track deleted successfully'
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
      { success: false, error: 'Failed to delete track' },
      { status: 500 }
    );
  }
}
