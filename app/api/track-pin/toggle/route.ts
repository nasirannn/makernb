import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-query-builder';
import { supabase } from '@/lib/supabase';
import { isAdmin } from '@/lib/auth-utils-optimized';

// 强制动态渲染
export const dynamic = 'force-dynamic';

// 切换歌曲置顶状态
export async function POST(request: NextRequest) {
  try {
    const { trackId } = await request.json();
    
    if (!trackId) {
      return NextResponse.json(
        { success: false, error: 'Missing trackId' },
        { status: 400 }
      );
    }

    // 获取当前用户
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    console.log('Track pin toggle - userId:', userId);
    
    // 检查用户是否为管理员
    const adminCheck = isAdmin(userId);
    console.log('Admin check result:', adminCheck);
    
    if (!adminCheck) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    // 获取当前置顶状态
    const currentStatus = await query(`
      SELECT is_pinned FROM music_tracks WHERE id = $1
    `, [trackId]);

    if (currentStatus.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Track not found' },
        { status: 404 }
      );
    }

    const isCurrentlyPinned = currentStatus.rows[0].is_pinned;
    const newPinnedStatus = !isCurrentlyPinned;

    // 更新置顶状态
    await query(`
      UPDATE music_tracks 
      SET is_pinned = $1, updated_at = NOW()
      WHERE id = $2
    `, [newPinnedStatus, trackId]);
    
    return NextResponse.json({
      success: true,
      data: {
        trackId,
        isPinned: newPinnedStatus
      },
      message: newPinnedStatus ? 'Track pinned successfully' : 'Track unpinned successfully'
    });
  } catch (error) {
    console.error('Error toggling track pin:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
