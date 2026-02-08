import { NextRequest, NextResponse } from 'next/server';
import { getUserInfoFromRequest } from '@/lib/auth';
import { hasFeaturePermission } from '@/lib/feature-permissions';
import { query } from '@/lib/db-query-builder';
import MusicApiService from '@/lib/music-api';
import { upsertTrackMp4Generation } from '@/lib/track-mp4-db';

// 强制动态渲染
export const dynamic = 'force-dynamic';

/**
 * 生成 MP4 音乐视频
 * 将已有音频曲目转换为带可视化效果的视频
 */
export async function POST(request: NextRequest) {
  try {
    const userInfo = await getUserInfoFromRequest(request);

    if (!userInfo) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { userId, authorName } = userInfo;

    const featureCode = 'download_mp4_track';
    const hasPermission = await hasFeaturePermission(userId, featureCode);

    if (!hasPermission) {
      return NextResponse.json(
        {
          error: 'Feature not available',
          message: 'MP4 download feature is not available for your subscription tier. Please upgrade to access this feature.'
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { trackId, author, domainName } = body;

    if (!trackId) {
      return NextResponse.json(
        { error: 'Track ID is required' },
        { status: 400 }
      );
    }

    const trackResult = await query(
      `SELECT
        mt.id as track_id,
        mt.suno_track_id as audio_id,
        COALESCE(mt.title, mg.title) as title,
        mg.task_id,
        mg.user_id
      FROM tracks mt
      INNER JOIN music mg ON mt.music_id = mg.id
      WHERE mt.id = $1::uuid
        AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)`,
      [trackId]
    );

    if (trackResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 }
      );
    }

    const track = trackResult.rows[0];

    if (track.user_id !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (!track.task_id || !track.audio_id) {
      return NextResponse.json(
        {
          error: 'Cannot generate MP4',
          message: 'Track does not have required task ID or audio ID for MP4 conversion'
        },
        { status: 400 }
      );
    }

    const latestMp4Result = await query(
      `SELECT id, task_id, status, video_url
       FROM track_mp4_generations
       WHERE track_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 1`,
      [trackId]
    );

    if (latestMp4Result.rows.length > 0) {
      const latest = latestMp4Result.rows[0];

      if (latest.status === 'completed' && latest.video_url) {
        return NextResponse.json({
          success: true,
          data: {
            trackId,
            taskId: latest.task_id,
            videoUrl: latest.video_url,
            status: 'completed',
            isExisting: true,
          },
        });
      }

      if (latest.status === 'generating') {
        return NextResponse.json(
          {
            success: true,
            data: {
              trackId,
              taskId: latest.task_id,
              status: 'generating',
              message: 'MP4 generation is already in progress',
            },
          },
          { status: 202 }
        );
      }
    }

    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    const musicApi = new MusicApiService(apiKey);
    const result = await musicApi.generateMp4Video({
      taskId: track.task_id,
      audioId: track.audio_id,
      author: typeof author === 'string' && author.trim() ? author.trim() : authorName,
      domainName: typeof domainName === 'string' && domainName.trim() ? domainName.trim() : undefined,
    });

    const mp4TaskId = result.data.taskId;

    const generation = await upsertTrackMp4Generation({
      trackId,
      taskId: mp4TaskId,
      status: 'generating',
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          trackId,
          taskId: mp4TaskId,
          status: 'generating',
          generationId: generation.id,
        },
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('[GENERATE-MP4] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate MP4',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

