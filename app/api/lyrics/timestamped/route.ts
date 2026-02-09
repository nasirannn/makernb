import { NextRequest, NextResponse } from 'next/server';

import { getUserIdFromRequest } from '@/lib/auth';
import { query } from '@/lib/db-query-builder';
import MusicApiService from '@/lib/music-api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const trackId = typeof body?.trackId === 'string' ? body.trackId.trim() : '';

    if (!trackId) {
      return NextResponse.json(
        { error: 'trackId is required' },
        { status: 400 }
      );
    }

    const trackResult = await query(
      `SELECT
        mt.id as track_id,
        mt.suno_track_id as audio_id,
        mg.task_id as task_id,
        mg.user_id,
        mg.is_instrumental
      FROM tracks mt
      INNER JOIN music mg ON mt.music_id = mg.id
      WHERE mt.id = $1::uuid
        AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
      LIMIT 1`,
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

    if (track.is_instrumental) {
      return NextResponse.json({
        success: true,
        data: {
          alignedWords: [],
          waveformData: [],
          isInstrumental: true,
        },
      });
    }

    if (!track.task_id) {
      return NextResponse.json(
        { error: 'Track does not have taskId' },
        { status: 400 }
      );
    }

    if (!track.audio_id) {
      return NextResponse.json(
        { error: 'Track does not have audioId' },
        { status: 400 }
      );
    }

    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'KIE API key is not configured' },
        { status: 500 }
      );
    }

    const musicApi = new MusicApiService(apiKey);
    const result = await musicApi.getTimestampedLyrics({
      taskId: track.task_id,
      audioId: track.audio_id,
    });

    return NextResponse.json({
      success: true,
      data: {
        alignedWords: result.data.alignedWords,
        waveformData: result.data.waveformData,
        hootCer: result.data.hootCer,
        isStreamed: result.data.isStreamed,
        isInstrumental: false,
      },
    });
  } catch (error) {
    console.error('Get timestamped lyrics error:', error);

    const message = error instanceof Error ? error.message : 'Failed to get timestamped lyrics';
    const status = typeof (error as { code?: unknown })?.code === 'number'
      ? Number((error as { code?: number }).code)
      : 500;

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: status >= 400 && status <= 599 ? status : 500 }
    );
  }
}
