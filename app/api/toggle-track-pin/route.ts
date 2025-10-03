import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, isAdmin } from '@/lib/auth-utils-optimized';
import { query } from '@/lib/db-query-builder';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { 
          error: 'Authentication required',
          message: 'Please log in to pin tracks'
        },
        { status: 401 }
      );
    }

    // 检查是否为管理员
    if (!isAdmin(userId)) {
      return NextResponse.json(
        { 
          error: 'Access denied',
          message: 'Only administrators can pin tracks'
        },
        { status: 403 }
      );
    }

    const { trackId } = await request.json();

    if (!trackId) {
      return NextResponse.json(
        { error: 'Track ID is required' },
        { status: 400 }
      );
    }

    console.log('Toggle pin for track:', trackId, 'by admin:', userId);
    
    // 使用单个SQL语句进行toggle操作，减少查询次数
    const result = await query(`
      UPDATE music_tracks 
      SET is_pinned = NOT COALESCE(is_pinned, false), 
          updated_at = NOW()
      WHERE id = $1
      RETURNING is_pinned, 
                CASE WHEN id IS NOT NULL THEN true ELSE false END as track_exists
    `, [trackId]);

    if (result.rows.length === 0 || !result.rows[0].track_exists) {
      return NextResponse.json(
        { success: false, error: 'Track not found' },
        { status: 404 }
      );
    }

    const isPinned = result.rows[0].is_pinned;
    console.log('Track pin status after toggle:', isPinned);

    return NextResponse.json({
      success: true,
      isPinned,
      message: isPinned ? 'Track pinned successfully' : 'Track unpinned successfully'
    });

  } catch (error) {
    console.error('Toggle track pin error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error occurred while toggling pin',
        success: false 
      },
      { status: 500 }
    );
  }
}
