import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-query-builder';
import { consumeUserCredit } from '@/lib/user-db';
import { getFeatureCredits } from '@/lib/credits-config';
import { getTrackMidiGenerationByTaskId, updateTrackMidiGenerationByTaskId } from '@/lib/track-midi-db';
import type { MidiGenerationData } from '@/types/track';

export const dynamic = 'force-dynamic';

const processedMidiTasks = new Set<string>();

const getTaskIdFromCallback = (callbackData: any): string | null => {
  const taskId =
    callbackData?.taskId ||
    callbackData?.task_id ||
    callbackData?.data?.taskId ||
    callbackData?.data?.task_id;
  return typeof taskId === 'string' && taskId.trim().length > 0 ? taskId.trim() : null;
};

/**
 * 处理 MIDI 生成回调
 */
export async function POST(request: NextRequest) {
  const callbackId = `midi_callback_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  try {
    const callbackData = await request.json();
    const { code } = callbackData;
    const taskId = getTaskIdFromCallback(callbackData);

    if (!taskId) {
      console.error(`[MIDI-CALLBACK-${callbackId}] Invalid callback data: missing taskId`);
      return NextResponse.json(
        { status: 'error', message: 'Missing taskId' },
        { status: 400 }
      );
    }

    const taskKey = `${taskId}_${code}`;
    if (processedMidiTasks.has(taskKey)) {
      return NextResponse.json({ status: 'received' });
    }
    processedMidiTasks.add(taskKey);

    const response = NextResponse.json({ status: 'received' });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    setImmediate(() => {
      processMidiCallbackAsync(callbackData, callbackId);
    });

    return response;
  } catch (error) {
    console.error(`[MIDI-CALLBACK-${callbackId}] Callback processing error:`, error);

    const errorResponse = NextResponse.json({ status: 'error' }, { status: 500 });
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    errorResponse.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return errorResponse;
  }
}

export async function OPTIONS() {
  return NextResponse.json(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

async function processMidiCallbackAsync(callbackData: any, callbackId: string) {
  let taskId: string | null = null;

  try {
    const { code, msg, data } = callbackData;
    taskId = getTaskIdFromCallback(callbackData);

    if (!taskId) {
      console.error(`[MIDI-CALLBACK-${callbackId}] Missing taskId in callback data`);
      return;
    }

    const generation = await getTrackMidiGenerationByTaskId(taskId);
    if (!generation) {
      console.error(`[MIDI-CALLBACK-${callbackId}] MIDI generation record not found for taskId: ${taskId}`);
      return;
    }

    if (code === 200) {
      if (generation.status === 'completed' && generation.midiData) {
        console.log(`[MIDI-CALLBACK-${callbackId}] MIDI task ${taskId} already completed, skipping duplicate success callback`);
        return;
      }

      const midiData: MidiGenerationData = {
        state: typeof data?.state === 'string' ? data.state : 'complete',
        instruments: Array.isArray(data?.instruments) ? data.instruments : [],
      };

      await updateTrackMidiGenerationByTaskId(taskId, {
        status: 'completed',
        midiData,
      });

      try {
        const midiTrackResult = await query(
          `SELECT mg.user_id
           FROM track_midi_generations tmg
           INNER JOIN tracks mt ON tmg.track_id = mt.id
           INNER JOIN music mg ON mt.music_id = mg.id
           WHERE tmg.task_id = $1
           LIMIT 1`,
          [taskId]
        );

        if (midiTrackResult.rows.length > 0) {
          const userId = midiTrackResult.rows[0].user_id;
          const midiCreditCost = getFeatureCredits('generate_midi');

          if (midiCreditCost > 0) {
            const creditConsumed = await consumeUserCredit(
              userId,
              midiCreditCost,
              'Generate MIDI',
              taskId,
              'midi_generation'
            );

            if (!creditConsumed) {
              console.warn(`[MIDI-CALLBACK-${callbackId}] Failed to deduct credits for MIDI task ${taskId} - insufficient credits`);
            }
          }
        }
      } catch (creditError) {
        console.error(`[MIDI-CALLBACK-${callbackId}] Error deducting credits for MIDI generation:`, creditError);
      }

      console.log(`[MIDI-CALLBACK-${callbackId}] MIDI generation completed for taskId: ${taskId}`);
      return;
    }

    if (code === 202) {
      if (generation.status === 'completed') {
        return;
      }
      await updateTrackMidiGenerationByTaskId(taskId, {
        status: 'generating',
      });
      return;
    }

    if (generation.status === 'completed') {
      console.warn(`[MIDI-CALLBACK-${callbackId}] Ignoring non-success callback for completed task ${taskId}, code: ${code}`);
      return;
    }

    console.error(`[MIDI-CALLBACK-${callbackId}] MIDI generation failed for taskId: ${taskId}, code: ${code}, msg: ${msg}`);
    await updateTrackMidiGenerationByTaskId(taskId, {
      status: 'error',
    });
  } catch (error) {
    console.error(`[MIDI-CALLBACK-${callbackId}] Error processing MIDI callback:`, error);

    if (taskId) {
      try {
        await updateTrackMidiGenerationByTaskId(taskId, {
          status: 'error',
        });
      } catch (statusError) {
        console.error(`[MIDI-CALLBACK-${callbackId}] Failed to update status to error:`, statusError);
      }
    }
  }
}
