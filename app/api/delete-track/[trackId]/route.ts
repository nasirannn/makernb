import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { getUserIdFromRequest } from '@/lib/auth-utils';

// 强制动态渲染
export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { trackId: string } }
) {
  try {
    // 检查用户是否登录
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Please log in to delete track'
        },
        { status: 401 }
      );
    }

    const { trackId } = params;

    console.log('Delete track API called with trackId:', trackId, 'userId:', userId);

    if (!trackId) {
      return NextResponse.json(
        { success: false, error: 'Track ID is required' },
        { status: 400 }
      );
    }

    // 软删除：将is_deleted设置为true，但要验证用户权限
    const result = await query(`
      UPDATE music_tracks
      SET is_deleted = TRUE, updated_at = NOW()
      WHERE id = $1
        AND music_generation_id IN (
          SELECT id FROM music_generations WHERE user_id = $2
        )
        AND (is_deleted IS NULL OR is_deleted = FALSE)
      RETURNING id
    `, [trackId, userId]);

    console.log('Track delete result:', result.rows);

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Track not found or already deleted'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Track deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting track:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete track' },
      { status: 500 }
    );
  }
}
