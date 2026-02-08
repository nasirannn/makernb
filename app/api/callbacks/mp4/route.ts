import { NextRequest, NextResponse } from 'next/server';
import { updateTrackMp4GenerationByTaskId, getTrackMp4GenerationByTaskId } from '@/lib/track-mp4-db';
import { consumeUserCredit } from '@/lib/user-db';
import { getFeatureCredits } from '@/lib/credits-config';
import { query } from '@/lib/db-query-builder';

// 强制动态渲染
export const dynamic = 'force-dynamic';

// 幂等处理 - 避免重复处理同一回调
const processedMp4Tasks = new Set<string>();

/**
 * 处理 MP4 生成回调
 */
export async function POST(request: NextRequest) {
  const callbackId = `mp4_callback_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  try {
    const callbackData = await request.json();
    const { code, data } = callbackData;
    const taskId = data?.task_id;

    if (!taskId) {
      console.error(`[MP4-CALLBACK-${callbackId}] Invalid callback data: missing task_id`);
      return NextResponse.json(
        { status: 'error', message: 'Missing task_id' },
        { status: 400 }
      );
    }

    const taskKey = `${taskId}_${code}`;
    if (processedMp4Tasks.has(taskKey)) {
      return NextResponse.json({ status: 'received' });
    }

    processedMp4Tasks.add(taskKey);

    const response = NextResponse.json({ status: 'received' });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    setImmediate(() => {
      processMp4CallbackAsync(callbackData, callbackId);
    });

    return response;
  } catch (error) {
    console.error(`[MP4-CALLBACK-${callbackId}] Callback processing error:`, error);

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

async function processMp4CallbackAsync(callbackData: any, callbackId: string) {
  let taskId: string | undefined;

  try {
    const { code, msg, data } = callbackData;
    taskId = data?.task_id;

    if (!taskId) {
      console.error(`[MP4-CALLBACK-${callbackId}] Missing task_id in callback data`);
      return;
    }

    const generation = await getTrackMp4GenerationByTaskId(taskId);
    if (!generation) {
      console.error(`[MP4-CALLBACK-${callbackId}] MP4 generation record not found for taskId: ${taskId}`);
      return;
    }

    if (code === 200) {
      const videoUrl = data?.video_url;

      if (!videoUrl) {
        console.error(`[MP4-CALLBACK-${callbackId}] Missing video_url in success callback`);
        await updateTrackMp4GenerationByTaskId(taskId, {
          status: 'error'
        });
        return;
      }

      await updateTrackMp4GenerationByTaskId(taskId, {
        videoUrl,
        status: 'completed',
      });

      try {
        const mp4TrackResult = await query(
          `SELECT mg.user_id
           FROM track_mp4_generations mpg
           INNER JOIN tracks mt ON mpg.track_id = mt.id
           INNER JOIN music mg ON mt.music_id = mg.id
           WHERE mpg.task_id = $1
           LIMIT 1`,
          [taskId]
        );

        if (mp4TrackResult.rows.length > 0) {
          const userId = mp4TrackResult.rows[0].user_id;
          const mp4CreditCost = getFeatureCredits('convert_to_mp4_video');

          const creditConsumed = await consumeUserCredit(
            userId,
            mp4CreditCost,
            'Convert to MP4 Video',
            taskId,
            'mp4_generation'
          );

          if (!creditConsumed) {
            console.warn(`[MP4-CALLBACK-${callbackId}] Failed to deduct credits for MP4 task ${taskId} - insufficient credits`);
          }
        }
      } catch (creditError) {
        console.error(`[MP4-CALLBACK-${callbackId}] Error deducting credits for MP4 generation:`, creditError);
      }

      console.log(`[MP4-CALLBACK-${callbackId}] MP4 generation completed for taskId: ${taskId}`);
      return;
    }

    console.error(`[MP4-CALLBACK-${callbackId}] MP4 generation failed for taskId: ${taskId}, code: ${code}, msg: ${msg}`);
    await updateTrackMp4GenerationByTaskId(taskId, {
      status: 'error',
    });
  } catch (error) {
    console.error(`[MP4-CALLBACK-${callbackId}] Error processing MP4 callback:`, error);

    if (taskId) {
      try {
        await updateTrackMp4GenerationByTaskId(taskId, {
          status: 'error',
        });
      } catch (statusError) {
        console.error(`[MP4-CALLBACK-${callbackId}] Failed to update status to error:`, statusError);
      }
    }
  }
}
