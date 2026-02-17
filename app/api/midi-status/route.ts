import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { query } from '@/lib/db-query-builder';

export const dynamic = 'force-dynamic';

const parseMidiData = (value: unknown) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
};

/**
 * GET /api/midi-status?taskId=xxx 或 ?trackId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      const result = await query(
        `SELECT
          tmg.*,
          mg.user_id
         FROM track_midi_generations tmg
         INNER JOIN tracks mt ON tmg.track_id = mt.id
         INNER JOIN music mg ON mt.music_id = mg.id
         WHERE tmg.task_id = $1
         LIMIT 1`,
        [taskId]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({
          success: true,
          data: null,
        });
      }

      const row = result.rows[0];
      if (row.user_id !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      return NextResponse.json({
        success: true,
        data: {
          id: row.id,
          trackId: row.track_id,
          taskId: row.task_id,
          separationTaskId: row.separation_task_id,
          sourceAudioId: row.source_audio_id,
          status: row.status,
          midiData: parseMidiData(row.midi_data),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      });
    }

    const result = await query(
      `SELECT
        tmg.*
       FROM track_midi_generations tmg
       INNER JOIN tracks mt ON tmg.track_id = mt.id
       INNER JOIN music mg ON mt.music_id = mg.id
       WHERE tmg.track_id = $1::uuid
         AND mg.user_id = $2::uuid
       ORDER BY tmg.created_at DESC`,
      [trackId, userId]
    );

    return NextResponse.json({
      success: true,
      data: result.rows.map((row) => ({
        id: row.id,
        trackId: row.track_id,
        taskId: row.task_id,
        separationTaskId: row.separation_task_id,
        sourceAudioId: row.source_audio_id,
        status: row.status,
        midiData: parseMidiData(row.midi_data),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch (error) {
    console.error('[MIDI-STATUS] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch MIDI status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
