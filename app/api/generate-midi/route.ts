import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { query } from '@/lib/db-query-builder';
import MusicApiService from '@/lib/music-api';
import { getFeatureCredits } from '@/lib/credits-config';
import { getUserCredits } from '@/lib/user-db';
import { upsertTrackMidiGeneration, getLatestTrackMidiGenerationByScope } from '@/lib/track-midi-db';
import { hasFeaturePermission } from '@/lib/feature-permissions';

export const dynamic = 'force-dynamic';

const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * POST /api/generate-midi
 * 使用 KIE MIDI API 生成 MIDI 结果（前置条件：已有 split_stem 分离任务）
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MIDI 使用独立权限控制（与 split stem 解耦）
    const canUseMidi = await hasFeaturePermission(userId, 'generate_midi');
    if (!canUseMidi) {
      return NextResponse.json(
        {
          error: 'Permission denied',
          message: 'MIDI is available for Hobby plan only',
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const trackId = normalizeOptionalString(body?.trackId);
    const separationTaskId = normalizeOptionalString(body?.separationTaskId);
    const sourceAudioId = normalizeOptionalString(body?.audioId);
    const force = !!body?.force;

    if (!trackId) {
      return NextResponse.json({ error: 'trackId is required' }, { status: 400 });
    }

    // 验证音轨归属关系
    const trackResult = await query(
      `SELECT
        mt.id as track_id,
        mg.user_id
      FROM tracks mt
      INNER JOIN music mg ON mt.music_id = mg.id
      WHERE mt.id = $1::uuid
      LIMIT 1`,
      [trackId]
    );

    if (trackResult.rows.length === 0) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    if (trackResult.rows[0].user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 必须使用 split_stem 的完成任务作为 MIDI 输入
    const separationResult = await query(
      `SELECT
        vr.task_id,
        vr.status,
        COALESCE(vr.separation_type, 'separate_vocal') as separation_type
      FROM vocal_removals vr
      INNER JOIN tracks mt ON vr.track_id = mt.id
      INNER JOIN music mg ON mt.music_id = mg.id
      WHERE vr.track_id = $1::uuid
        AND mg.user_id = $2::uuid
        AND vr.status = 'completed'
        AND COALESCE(vr.separation_type, 'separate_vocal') = 'split_stem'
        AND ($3::text IS NULL OR vr.task_id = $3)
      ORDER BY vr.created_at DESC
      LIMIT 1`,
      [trackId, userId, separationTaskId]
    );

    if (separationResult.rows.length === 0) {
      return NextResponse.json(
        {
          error: 'Split stem result not found',
          message: 'MIDI generation requires a completed split_stem vocal separation task.',
        },
        { status: 400 }
      );
    }

    const selectedSeparationTaskId = separationResult.rows[0].task_id as string;

    // 命中缓存：优先复用同一 track + split_stem task + audioId 的生成结果
    if (!force) {
      const existing = await getLatestTrackMidiGenerationByScope(
        trackId,
        selectedSeparationTaskId,
        sourceAudioId
      );

      if (existing) {
        if (existing.status === 'completed' && existing.midiData) {
          return NextResponse.json(
            {
              success: true,
              cacheHit: true,
              data: {
                trackId,
                taskId: existing.taskId,
                separationTaskId: existing.separationTaskId,
                sourceAudioId: existing.sourceAudioId,
                status: existing.status,
                midiData: existing.midiData,
                createdAt: existing.createdAt,
                updatedAt: existing.updatedAt,
              },
            },
            { status: 200 }
          );
        }

        if (existing.status === 'generating') {
          return NextResponse.json(
            {
              success: true,
              cacheHit: true,
              data: {
                trackId,
                taskId: existing.taskId,
                separationTaskId: existing.separationTaskId,
                sourceAudioId: existing.sourceAudioId,
                status: existing.status,
                message: 'MIDI generation is already in progress',
              },
            },
            { status: 202 }
          );
        }
      }
    }

    // 积分校验
    const midiCreditCost = getFeatureCredits('generate_midi');
    const userCredits = await getUserCredits(userId);
    if (!userCredits || userCredits.credits < midiCreditCost) {
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          required: midiCreditCost,
          current: userCredits?.credits || 0,
          insufficientCredits: true,
        },
        { status: 402 }
      );
    }

    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const musicApi = new MusicApiService(apiKey);
    const apiResult = await musicApi.generateMidi({
      taskId: selectedSeparationTaskId,
      audioId: sourceAudioId || undefined,
    });

    const generation = await upsertTrackMidiGeneration({
      trackId,
      separationTaskId: selectedSeparationTaskId,
      sourceAudioId,
      taskId: apiResult.data.taskId,
      status: 'generating',
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: generation.id,
          trackId: generation.trackId,
          taskId: generation.taskId,
          separationTaskId: generation.separationTaskId,
          sourceAudioId: generation.sourceAudioId,
          status: generation.status,
        },
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('[GENERATE-MIDI] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate MIDI',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
