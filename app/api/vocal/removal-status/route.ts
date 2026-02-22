import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { getVocalRemovalByTaskId, getVocalRemovalsByTrackId } from '@/features/vocal-tools/lib/vocal-removal-db';

export const dynamic = 'force-dynamic';

const parseStemsData = (value: unknown): Record<string, string> | null => {
  if (!value) return null;
  if (typeof value === 'object') return value as Record<string, string>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : null;
    } catch {
      return null;
    }
  }
  return null;
};

/**
 * 查询人声移除状态
 * GET /api/vocal/removal-status?taskId=xxx 或 ?trackId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    // 获取用户ID（可选，用于权限验证）
    const userId = await getUserIdFromRequest(request);

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const trackId = searchParams.get('trackId');

    if (!taskId && !trackId) {
      return NextResponse.json(
        { error: 'Either taskId or trackId is required' },
        { status: 400 }
      );
    }

    if (taskId) {
      // 根据 taskId 查询
      const removal = await getVocalRemovalByTaskId(taskId);

      // 如果没有记录，返回 null
      if (!removal) {
        return NextResponse.json({
          success: true,
          data: null
        });
      }

      // 如果提供了 userId，验证权限
      if (userId && removal.user_id !== userId) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }

      // 仅使用持久化 R2 URL，不回退到临时 URL
      const vocalUrl = removal.r2_vocal_url || undefined;
      const instrumentalUrl = removal.r2_instrumental_url || undefined;
      const stemsData = parseStemsData(removal.stems_data);

      return NextResponse.json({
        success: true,
        data: {
          id: removal.id,
          taskId: removal.task_id,
          separationType: removal.separation_type || 'separate_vocal',
          status: removal.status,
          errorCode: removal.error_code || undefined,
          errorMessage: removal.error_message || undefined,
          vocalUrl,
          instrumentalUrl,
          stemsData,
          trackId: removal.track_id,
          createdAt: removal.created_at,
          updatedAt: removal.updated_at
        }
      });
    } else if (trackId) {
      // 根据 trackId 查询该 track 的所有 vocal removals
      const removals = await getVocalRemovalsByTrackId(trackId, userId || undefined);

      // 如果没有记录，返回空数组
      if (removals.length === 0) {
        return NextResponse.json({
          success: true,
          data: []
        });
      }

      return NextResponse.json({
        success: true,
        data: removals.map(removal => {
          // 仅使用持久化 R2 URL，不回退到临时 URL
          const vocalUrl = removal.r2_vocal_url || undefined;
          const instrumentalUrl = removal.r2_instrumental_url || undefined;
          const stemsData = parseStemsData(removal.stems_data);
          
          return {
            id: removal.id,
            taskId: removal.task_id,
            separationType: removal.separation_type || 'separate_vocal',
            status: removal.status,
            errorCode: removal.error_code || undefined,
            errorMessage: removal.error_message || undefined,
            vocalUrl,
            instrumentalUrl,
            stemsData,
            trackId: removal.track_id,
            createdAt: removal.created_at,
            updatedAt: removal.updated_at
          };
        })
      });
    }

  } catch (error) {
    console.error('Get vocal removal status error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Internal server error' },
      { status: 500 }
    );
  }
}
