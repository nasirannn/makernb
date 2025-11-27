import { NextRequest, NextResponse } from 'next/server';
import { consumeUserCredit } from '@/lib/user-db';
import { createGenerationError } from '@/lib/generation-errors-db';
import { query, withTransaction } from '@/lib/db-query-builder';
import { getFeatureCredits } from '@/lib/credits-config';


// Cache for processed tasks to handle idempotency
const processedLyricsTasks = new Set<string>();

// Handle Lyrics API callbacks
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 1. Fast response - must return response within 15 seconds
    const callbackData = await request.json();

    const { code, msg, data } = callbackData;
    const taskId = data?.task_id;

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    // 3. Idempotency handling - avoid duplicate processing of same callback
    const taskKey = `lyrics_${taskId}_${code}`;
    if (processedLyricsTasks.has(taskKey)) {
      return NextResponse.json({
        success: true,
        message: 'Already processed',
        taskId: taskId,
        processedAt: new Date().toISOString()
      });
    }

    // Mark as processed
    processedLyricsTasks.add(taskKey);

    // 4. Return success response immediately to avoid blocking
    const response = NextResponse.json({
      success: true,
      message: 'Lyrics callback received',
      taskId: taskId,
      processedAt: new Date().toISOString()
    });

    // 5. Process complex logic asynchronously to avoid blocking callback response
    setImmediate(() => {
      processLyricsCallbackAsync(callbackData);
    });

    return response;

  } catch (error) {
    console.error('Lyrics callback processing error:', error);
    
    // Return quick response even on error
    return NextResponse.json(
      { 
        error: 'Internal server error',
        success: false,
        processedAt: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Process lyrics callback data asynchronously
async function processLyricsCallbackAsync(callbackData: any) {
  try {
    const { code, msg, data } = callbackData;
    const taskId = data?.task_id;
    
    if (code === 200 && data?.callbackType === 'complete') {
      // Handle successfully completed callback
      // 检查是否有歌词数据 - API返回data.data数组，可能包含多个歌词版本
      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        // 获取所有成功的歌词
        const successfulLyrics = data.data.filter((item: any) => item.status === 'complete');

        if (successfulLyrics.length > 0) {
          // 更新数据库中的歌词内容与状态
          // 将所有成功的歌词存储为JSON数组
          try {
            const lyricsArray = successfulLyrics.map((item: any) => ({
              title: item.title || 'Untitled',
              text: (item.text || '').trim()
            }));

            await query(
              `UPDATE lyrics_generations
               SET title = $1, content = $2, status = 'complete', updated_at = NOW()
               WHERE task_id = $3`,
              [
                lyricsArray[0].title, // 使用第一个歌词的标题
                JSON.stringify(lyricsArray), // 存储所有歌词为JSON
                taskId
              ]
            );
          } catch (err) {
            console.error('Failed to update lyrics record:', err);
          }

          // 扣减积分
          try {
            const result = await query(
              'SELECT user_id FROM lyrics_generations WHERE task_id = $1',
              [taskId]
            );

            if (result.rows.length > 0) {
              const userId = result.rows[0].user_id;
              const lyricsCreditCost = getFeatureCredits('generate_lyrics');

              await consumeUserCredit(
                userId,
                lyricsCreditCost,
                'Lyrics generation',
                taskId,
                'lyrics_generation'
              );
            }
          } catch (error) {
            console.error('Error deducting credits for lyrics generation:', error);
          }

        } else {
          // 所有歌词都失败
          try {
            const result = await query(
              `UPDATE lyrics_generations
               SET status = 'error', updated_at = NOW()
               WHERE task_id = $1
               RETURNING id, user_id`,
              [taskId]
            );

            if (result.rows.length > 0) {
              await createGenerationError(
                'lyrics_generation',
                result.rows[0].id,
                'All lyrics generation attempts failed',
                'GENERATION_FAILED'
              );
            }
          } catch (error) {
            console.error('Failed to update lyrics generation status:', error);
          }
        }
      } else {
        // data.data 为 null 或空数组，说明生成失败（如moderation failed）
        try {
          const result = await query(
            `UPDATE lyrics_generations
             SET status = 'error', updated_at = NOW()
             WHERE task_id = $1
             RETURNING id, user_id`,
            [taskId]
          );

          if (result.rows.length > 0) {
            await createGenerationError(
              'lyrics_generation',
              result.rows[0].id,
              msg || 'Lyrics generation failed - content moderation failed',
              'MODERATION_FAILED'
            );
          }
        } catch (error) {
          console.error('Failed to update lyrics generation status:', error);
        }
      }

    } else {
      // Handle failed callback (非200状态码)
      try {
        const result = await query(
          `UPDATE lyrics_generations
           SET status = 'error', updated_at = NOW()
           WHERE task_id = $1
           RETURNING id, user_id`,
          [taskId]
        );

        if (result.rows.length > 0) {
          await createGenerationError(
            'lyrics_generation',
            result.rows[0].id,
            msg || 'Lyrics generation API call failed',
            `API_ERROR_${code}`
          );
        }
      } catch (error) {
        console.error('Failed to update lyrics generation status:', error);
      }
    }
    
  } catch (error) {
    console.error('Async lyrics callback processing failed:', error);
    // Errors here won't affect callback response, only log
  }
}

// Periodically clean processed task cache to avoid memory leaks
setInterval(() => {
  if (processedLyricsTasks.size > 1000) {
    processedLyricsTasks.clear();
  }
}, 60 * 60 * 1000); // Clean every hour
