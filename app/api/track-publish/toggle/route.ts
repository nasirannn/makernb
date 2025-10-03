import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-query-builder';
import { supabase } from '@/lib/supabase';

// 强制动态渲染
export const dynamic = 'force-dynamic';

// 切换歌曲发布状态
export async function POST(request: NextRequest) {
  try {
    const { trackId } = await request.json();
    
    if (!trackId) {
      return NextResponse.json(
        { success: false, error: 'Missing trackId' },
        { status: 400 }
      );
    }

    // 从请求头获取Authorization token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // 移除 'Bearer ' 前缀
    
    // 验证token并获取用户信息
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.id;
    
    // 检查用户是否拥有这个歌曲
    const trackOwnership = await query(`
      SELECT mt.id, mg.user_id 
      FROM music_tracks mt
      JOIN music_generations mg ON mt.music_generation_id = mg.id
      WHERE mt.id = $1
    `, [trackId]);

    if (trackOwnership.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Track not found' },
        { status: 404 }
      );
    }

    if (trackOwnership.rows[0].user_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'You can only publish your own tracks' },
        { status: 403 }
      );
    }

    // 获取当前发布状态
    const currentStatus = await query(`
      SELECT is_published FROM music_tracks WHERE id = $1
    `, [trackId]);

    const isCurrentlyPublished = currentStatus.rows[0].is_published;
    const newPublishedStatus = !isCurrentlyPublished;

    // 更新发布状态
    await query(`
      UPDATE music_tracks 
      SET is_published = $1, updated_at = NOW()
      WHERE id = $2
    `, [newPublishedStatus, trackId]);
    
    return NextResponse.json({
      success: true,
      data: {
        trackId,
        isPublished: newPublishedStatus
      },
      message: newPublishedStatus ? 'Track published successfully' : 'Track unpublished successfully'
    }, { status: 200 });
  } catch (error) {
    console.error('Error toggling track publication:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
