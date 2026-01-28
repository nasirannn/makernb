import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { query } from '@/lib/db-query-builder';
import { submitExplorePageToIndexNow, submitTrackToIndexNow } from '@/lib/indexnow';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { 
          error: 'Authentication required',
          message: 'Please log in to publish tracks'
        },
        { status: 401 }
      );
    }

    const { trackId, isPublished } = await request.json();

    if (!trackId) {
      return NextResponse.json(
        { error: 'Track ID is required' },
        { status: 400 }
      );
    }

    if (typeof isPublished !== 'boolean') {
      return NextResponse.json(
        { error: 'isPublished must be a boolean' },
        { status: 400 }
      );
    }

    console.log('Toggle publish for track:', trackId, 'to:', isPublished, 'by user:', userId);
    
    // 验证用户是否拥有此 track，然后更新发布状态
    const result = await query(`
      UPDATE tracks 
      SET is_published = $1, 
          updated_at = NOW()
      FROM music mg
      WHERE tracks.id = $2
        AND tracks.music_id = mg.id
        AND mg.user_id = $3::uuid
      RETURNING tracks.is_published, tracks.id
    `, [isPublished, trackId, userId]);

    if (result.rows.length === 0) {
      // 诊断失败原因
      const diagnosticResult = await query(`
        SELECT 
          mt.id,
          mg.user_id
        FROM tracks mt
        LEFT JOIN music mg ON mt.music_id = mg.id
        WHERE mt.id = $1
      `, [trackId]);

      if (diagnosticResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Track not found' },
          { status: 404 }
        );
      }

      const track = diagnosticResult.rows[0];
      if (track.user_id !== userId) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized: You can only publish your own tracks' },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { success: false, error: 'Failed to update publish status' },
        { status: 500 }
      );
    }

    const publishStatus = result.rows[0].is_published;
    console.log('Track publish status after update:', publishStatus);

    // 提交到 IndexNow（后台异步，不阻塞响应）
    setImmediate(async () => {
      try {
        if (publishStatus) {
          // 音乐发布时，提交 explore 页面和 track 页面到 IndexNow
          await Promise.all([
            submitExplorePageToIndexNow(),
            submitTrackToIndexNow(trackId)
          ]);
          console.log('Submitted published track to IndexNow:', trackId);
        } else {
          // 音乐取消发布时，仅提交 explore 页面更新
          await submitExplorePageToIndexNow();
          console.log('Submitted explore page update to IndexNow after unpublishing:', trackId);
        }
      } catch (indexError) {
        console.error('Failed to submit to IndexNow:', indexError);
        // IndexNow 失败不影响主流程
      }
    });

    return NextResponse.json({
      success: true,
      isPublished: publishStatus,
      message: publishStatus ? 'Track published successfully' : 'Track unpublished successfully'
    });

  } catch (error) {
    console.error('Toggle track publish error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error occurred while toggling publish status',
        success: false 
      },
      { status: 500 }
    );
  }
}
