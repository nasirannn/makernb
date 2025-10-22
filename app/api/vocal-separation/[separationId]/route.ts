import { NextRequest, NextResponse } from 'next/server';
import { softDeleteVocalSeparation } from '@/lib/vocal-separation-db';
import { getUserIdFromRequest } from '@/lib/auth-utils-optimized';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { separationId: string } }
) {
  const requestId = `delete-separation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const { separationId } = params;
  
  console.log(`[DELETE-VOCAL-SEPARATION-${requestId}] Deleting vocal separation: ${separationId}`);

  try {
    // 检查用户是否登录
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      console.log(`[DELETE-VOCAL-SEPARATION-${requestId}] Authentication failed - no userId`);
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Please log in to delete vocal separations'
        },
        { status: 401 }
      );
    }

    if (!separationId) {
      return NextResponse.json(
        {
          error: 'Missing separation ID',
          message: 'Separation ID is required'
        },
        { status: 400 }
      );
    }

    // 软删除人声分离记录
    const success = await softDeleteVocalSeparation(separationId, userId);

    if (!success) {
      console.log(`[DELETE-VOCAL-SEPARATION-${requestId}] Separation not found or access denied`);
      return NextResponse.json(
        {
          error: 'Not found',
          message: 'Vocal separation not found or you do not have permission to delete it'
        },
        { status: 404 }
      );
    }

    console.log(`[DELETE-VOCAL-SEPARATION-${requestId}] Successfully deleted separation: ${separationId}`);

    return NextResponse.json({
      success: true,
      message: 'Vocal separation deleted successfully'
    });
  } catch (error) {
    console.error(`[DELETE-VOCAL-SEPARATION-${requestId}] Unexpected error:`, error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}
