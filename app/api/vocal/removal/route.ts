import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-query-builder';
import { getUserIdFromRequest } from '@/lib/auth';
import { createVocalRemoval, getVocalRemovalsByTrackId } from '@/features/vocal-tools/lib/vocal-removal-db';
import MusicApiService from '@/lib/music-api';
import { getFeatureCredits } from '@/lib/credits-config';
import { getUserCredits } from '@/lib/user-db';
import { hasFeaturePermission } from '@/lib/feature-permissions';

export const dynamic = 'force-dynamic';

/**
 * 创建人声移除任务（Studio专用）
 * POST /api/vocal/removal
 * Body: { trackId: string, type?: 'separate_vocal' | 'split_stem', force?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    // 获取用户ID
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { trackId, force, type } = body as {
      trackId?: string;
      force?: boolean;
      type?: 'separate_vocal' | 'split_stem';
    };
    const separationType: 'separate_vocal' | 'split_stem' = type === 'split_stem' ? 'split_stem' : 'separate_vocal';
    const shouldUseCache = !force && separationType === 'separate_vocal';

    if (!trackId) {
      return NextResponse.json(
        { error: 'trackId is required' },
        { status: 400 }
      );
    }

    // Cache hit: return latest completed (or processing) result for this track.
    if (shouldUseCache) {
      const existing = await getVocalRemovalsByTrackId(trackId, userId);
      const reusableCompleted = existing.find(r => {
        const vocalUrl = r.r2_vocal_url;
        const instrumentalUrl = r.r2_instrumental_url;
        return r.status === 'completed' && !!vocalUrl && !!instrumentalUrl;
      });

      if (reusableCompleted) {
        const vocalUrl = reusableCompleted.r2_vocal_url || undefined;
        const instrumentalUrl = reusableCompleted.r2_instrumental_url || undefined;
        return NextResponse.json(
          {
            success: true,
            cacheHit: true,
            data: {
              removalId: reusableCompleted.id,
              taskId: reusableCompleted.task_id,
              status: reusableCompleted.status,
              trackId: reusableCompleted.track_id,
              vocalUrl,
              instrumentalUrl,
              createdAt: reusableCompleted.created_at,
              updatedAt: reusableCompleted.updated_at,
            },
          },
          { status: 200 }
        );
      }

      const reusableProcessing = existing.find(r => r.status === 'processing');
      if (reusableProcessing) {
        return NextResponse.json(
          {
            success: true,
            cacheHit: true,
            data: {
              removalId: reusableProcessing.id,
              taskId: reusableProcessing.task_id,
              status: reusableProcessing.status,
              trackId: reusableProcessing.track_id,
              createdAt: reusableProcessing.created_at,
              updatedAt: reusableProcessing.updated_at,
            },
          },
          { status: 200 }
        );
      }
    }

    // 查询 track 信息以获取 audio_id、music_id 和原始音乐生成任务的 task_id
    const trackResult = await query(
      `SELECT 
        mt.id as track_id,
        mt.suno_track_id as audio_id,
        mt.music_id,
        mg.task_id as music_task_id,
        COALESCE(mt.title, mg.title) as title,
        mt.audio_url,
        mg.is_instrumental
      FROM tracks mt
      INNER JOIN music mg ON mt.music_id = mg.id
      WHERE mt.id = $1::uuid
        AND mg.user_id = $2::uuid
        AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)`,
      [trackId, userId]
    );

    if (trackResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Track not found or access denied' },
        { status: 404 }
      );
    }

    const track = trackResult.rows[0];

    if (!track.audio_id) {
      return NextResponse.json(
        { error: 'Track does not have audio_id (suno_track_id). Cannot proceed with vocal removal.' },
        { status: 400 }
      );
    }

    // 验证原始音乐生成任务的 task_id 是否存在
    if (!track.music_task_id) {
      return NextResponse.json(
        { error: 'Track does not have original music generation task_id. Cannot proceed with vocal removal.' },
        { status: 400 }
      );
    }

    // 检查是否是纯器乐歌曲（纯器乐无法进行人声分离）
    if (track.is_instrumental) {
      return NextResponse.json(
        { 
          error: 'Cannot separate vocals from instrumental tracks. Instrumental tracks have no vocals to separate.' 
        },
        { status: 400 }
      );
    }

    // 检查权限：
    // - separate_vocal: vocal_removal_studio
    // - split_stem: split_stem_from_music_studio（仅订阅层级开放）
    const permissionFeatureCode = separationType === 'split_stem'
      ? 'split_stem_from_music_studio'
      : 'vocal_removal_studio';
    const hasPermission = await hasFeaturePermission(userId, permissionFeatureCode);
    if (!hasPermission) {
      const permissionMessage = separationType === 'split_stem'
        ? 'Split Stem is available for Hobby plan only'
        : 'You do not have permission to use vocal removal in Studio';
      return NextResponse.json(
        { 
          error: 'Permission denied',
          message: permissionMessage
        },
        { status: 403 }
      );
    }

    // 检查积分（split_stem 与 separate_vocal 使用不同的计费项）
    const creditFeatureKey: 'split_stem_from_music_studio' | 'separate_vocals_from_music_studio' =
      separationType === 'split_stem'
        ? 'split_stem_from_music_studio'
        : 'separate_vocals_from_music_studio';
    const creditCost = getFeatureCredits(creditFeatureKey);
    const userCredits = await getUserCredits(userId);
    
    if (!userCredits || userCredits.credits < creditCost) {
      return NextResponse.json(
        { 
          error: 'Insufficient credits',
          required: creditCost,
          current: userCredits?.credits || 0
        },
        { status: 403 }
      );
    }

    // 获取 API key
    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    // 调用 KIE API
    // 注意：根据 KIE API 文档，taskId 应该是原始音乐生成任务的 task_id
    // audioId 是音频轨道的唯一标识符（suno_track_id）
    const musicApi = new MusicApiService(apiKey);
    const callbackUrl = `${process.env.CallBackURL}/api/callbacks/vocal-removal`;

    const apiResponse = await musicApi.generateVocalSeparation({
      taskId: track.music_task_id, // 使用原始音乐生成任务的 task_id
      audioId: track.audio_id,     // 使用 suno_track_id 作为 audioId
      type: separationType,
      callBackUrl: callbackUrl
    });

    if (apiResponse.code !== 200) {
      return NextResponse.json(
        { error: apiResponse.msg || 'Failed to start vocal removal' },
        { status: 500 }
      );
    }

    // 创建数据库记录
    // vocal_removals 表的 task_id 存储 KIE API 返回的 taskId（人声分离任务的 taskId）
    const vocalRemoval = await createVocalRemoval(userId, {
      track_id: trackId,
      music_id: track.music_id,
      task_id: apiResponse.data?.taskId || `vocal_removal_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      audio_id: track.audio_id,
      separation_type: separationType,
      status: 'processing'
    });

    return NextResponse.json({
      success: true,
      data: {
        removalId: vocalRemoval.id,
        taskId: vocalRemoval.task_id,
        status: vocalRemoval.status,
        trackId: vocalRemoval.track_id,
        type: separationType,
        message: 'Vocal removal started successfully'
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Vocal removal API error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Internal server error' },
      { status: 500 }
    );
  }
}
