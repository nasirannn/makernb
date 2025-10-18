import { NextRequest, NextResponse } from 'next/server';
import MusicApiService from '@/lib/music-api';
import { createMusicGeneration } from '@/lib/music-db';
import { createGenerationError } from '@/lib/generation-errors-db';
import { consumeUserCredit } from '@/lib/user-db';
import { getUserIdFromRequest } from '@/lib/auth-utils-optimized';
import { R_AND_B_STYLES } from '@/lib/rnb-style-generator';

export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[MUSIC-GEN-${requestId}] Starting music generation request`);

  try {
    // 检查用户是否登录 - 使用统一的身份验证方式
    const userId = await getUserIdFromRequest(request);
    console.log(`[MUSIC-GEN-${requestId}] User authentication: ${userId ? 'SUCCESS' : 'FAILED'}`);

    if (!userId) {
      console.log(`[MUSIC-GEN-${requestId}] Authentication failed - no userId`);
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Please log in to generate music'
        },
        { status: 401 }
      );
    }

    const requestData = await request.json();
    console.log(`[MUSIC-GEN-${requestId}] Request data received:`, {
      mode: requestData.mode,
      genre: requestData.genre,
      instrumentalMode: requestData.instrumentalMode,
      hasCustomPrompt: !!requestData.customPrompt,
      songTitle: requestData.songTitle
    });

    // 从前端获取所有参数
    const {
      mode,
      customPrompt,
      instrumentalMode,
      songTitle,
      styleText,
      vocalGender,
      genre,
      isPublished
    } = requestData;
    // 根据模式处理参数
    console.log(`[MUSIC-GEN-${requestId}] Processing mode: ${mode}`);

    if (mode === 'basic') {
      console.log(`[MUSIC-GEN-${requestId}] Basic mode - processing basic mode request`);

    } else if (mode === 'custom') {
      console.log(`[MUSIC-GEN-${requestId}] Custom mode - validating parameters`);
      // Custom mode: 只检查styleText内容
      if (!styleText || !styleText.trim()) {
        console.log(`[MUSIC-GEN-${requestId}] Custom mode validation failed - missing styleText`);
        return NextResponse.json(
          { error: 'Please select or enter music style' },
          { status: 400 }
        );
      }
      console.log(`[MUSIC-GEN-${requestId}] Custom mode - styleText validated: ${styleText}`);

    } else {
      console.log(`[MUSIC-GEN-${requestId}] Invalid mode: ${mode}`);
      return NextResponse.json(
        { error: 'Please select a valid mode (basic or custom)' },
        { status: 400 }
      );
    }

    // 根据模式确定积分成本
    const modelVersion = mode === 'custom' ? (process.env.CUSTOM_MODE_MODEL || 'V4_5') : (process.env.BASIC_MODE_MODEL || 'V3_5');
    const creditCost = mode === 'custom' ? parseInt(process.env.CUSTOM_MODE_CREDITS || '12') : parseInt(process.env.BASIC_MODE_CREDITS || '7');

    try {
      const { query } = await import('@/lib/db-query-builder');
      const creditResult = await query(
        'SELECT credits FROM user_credits WHERE user_id = $1',
        [userId]
      );

      if (creditResult.rows.length === 0) {
        return NextResponse.json(
          {
            error: 'User account not found',
            message: 'Please try logging in again',
            success: false
          },
          { status: 404 }
        );
      }

      const userCredits = creditResult.rows[0].credits;

      if (userCredits < creditCost) {
        return NextResponse.json(
          {
            error: 'Insufficient credits',
            message: `You need ${creditCost} credits but only have ${userCredits}. Please purchase more credits to continue.`,
            success: false,
            required: creditCost,
            available: userCredits
          },
          { status: 400 }
        );
      }

    } catch (error) {
      return NextResponse.json(
        {
          error: 'Service temporarily unavailable',
          message: 'We are experiencing technical difficulties. Please try again in a few moments.',
          success: false,
          technical_details: error instanceof Error ? error.message : 'Database connection error'
        },
        { status: 500 }
      );
    }

    // Get API key from environment variables
    const apiKey = process.env.SUNO_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    // 积分验证通过，调用音乐生成API
    const musicApi = new MusicApiService(apiKey);

    // 构造完整的请求对象传递给API
    const musicRequest = {
      mode,
      customPrompt,
      instrumentalMode,
      songTitle,
      styleText,
      vocalGender
    };

    // Generate music
    console.log(`[MUSIC-GEN-${requestId}] Calling musicApi.generateMusic with request:`, {
      mode: musicRequest.mode,
      instrumentalMode: musicRequest.instrumentalMode,
      hasCustomPrompt: !!musicRequest.customPrompt,
      songTitle: musicRequest.songTitle,
      hasStyleText: !!musicRequest.styleText
    });

    const result = await musicApi.generateMusic(musicRequest);
    console.log(`[MUSIC-GEN-${requestId}] Music API response:`, {
      hasTaskId: !!result.taskId,
      taskId: result.taskId,
      success: !result.error,
      error: result.error || result.errorMessage
    });

    // 创建数据库记录和扣除积分（只有API调用成功才执行）
    if (result.taskId) {
      // 成功获得taskId，分步骤处理以减少单个事务时间
      try {
        console.log(`[MUSIC-GEN-${requestId}] Starting database operations for successful generation`);

        // 准备数据库存储的genre
        let genreForDb = 'R&B'; // 默认值
        if (genre) {
          const selectedStyle = R_AND_B_STYLES.find(style => style.id === genre);
          genreForDb = selectedStyle ? selectedStyle.name : genre;
        }

        // 步骤1: 先扣除积分（最关键的操作，优先执行）
        console.log(`[MUSIC-GEN-${requestId}] Step 1: Consuming user credits`);
        const creditStartTime = Date.now();

        await consumeUserCredit(
          userId,
          creditCost,
          `Music generation (${modelVersion})`,
          result.taskId,
          'music_generation'
        );

        const creditTime = Date.now() - creditStartTime;
        console.log(`[MUSIC-GEN-${requestId}] Credits consumed successfully in ${creditTime}ms`);

        // 步骤2: 创建音乐生成记录（分离出来，减少事务复杂度）
        console.log(`[MUSIC-GEN-${requestId}] Step 2: Creating music generation record`);
        const recordStartTime = Date.now();

        await createMusicGeneration(userId, {
          title: musicRequest.songTitle || null,
          genre: genreForDb,
          prompt: customPrompt,
          task_id: result.taskId,
          status: 'generating',
          is_published: isPublished !== undefined ? isPublished : true
        });

        const recordTime = Date.now() - recordStartTime;
        console.log(`[MUSIC-GEN-${requestId}] Music generation record created successfully in ${recordTime}ms`);

        const totalDbTime = Date.now() - creditStartTime;
        console.log(`[MUSIC-GEN-${requestId}] All database operations completed successfully in ${totalDbTime}ms`);

      } catch (dbError) {
        console.error(`[MUSIC-GEN-${requestId}] Database operation failed after API call:`, {
          error: dbError instanceof Error ? dbError.message : String(dbError),
          taskId: result.taskId,
          stack: dbError instanceof Error ? dbError.stack : undefined
        });

        // 数据库操作失败的补偿逻辑
        // 尝试回滚积分（如果积分扣除成功但记录创建失败）
        try {
          const { query } = await import('@/lib/db-query-builder');

          // 检查是否有积分交易记录
          const creditCheckResult = await query(
            'SELECT id FROM credit_transactions WHERE reference_id = $1 AND description LIKE $2',
            [result.taskId, '%Music generation%']
          );

          if (creditCheckResult.rows.length > 0) {
            console.log(`[MUSIC-GEN-${requestId}] Credit transaction found, attempting compensation`);

            // 创建补偿积分记录
            await query(`
              INSERT INTO credit_transactions (
                user_id, transaction_type, amount,
                balance_after, description, reference_id
              )
              SELECT
                user_id, 'credit', $2,
                (SELECT credits FROM user_credits WHERE user_id = $1) + $2,
                'Compensation for failed generation: ' || $3,
                $3
              FROM credit_transactions
              WHERE reference_id = $3 AND description LIKE '%Music generation%'
              LIMIT 1
            `, [userId, creditCost, result.taskId]);

            // 更新用户积分
            await query(
              'UPDATE user_credits SET credits = credits + $2, updated_at = NOW() WHERE user_id = $1',
              [userId, creditCost]
            );

            console.log(`[MUSIC-GEN-${requestId}] Credit compensation completed`);
          }

        } catch (compensationError) {
          console.error(`[MUSIC-GEN-${requestId}] Credit compensation failed:`, compensationError);
        }

        // 返回带有详细错误信息的响应
        return NextResponse.json(
          {
            error: 'Database operation failed',
            message: 'Music generation started but database operation failed. Your credits have been restored. Please try again or contact support.',
            success: false,
            taskId: result.taskId,
            technical_details: dbError instanceof Error ? dbError.message : 'Unknown database error'
          },
          { status: 500 }
        );
      }
    } else {
      console.log(`[MUSIC-GEN-${requestId}] API call failed - no taskId returned. Error: ${result.error || result.errorMessage}`);
      // 没有taskId，说明生成失败（可能包含敏感词等）

      try {
        // 创建失败记录到数据库
        let genreForDb = 'R&B'; // 默认值
        if (genre) {
          const selectedStyle = R_AND_B_STYLES.find(style => style.id === genre);
          genreForDb = selectedStyle ? selectedStyle.name : genre;
        }

        const failedGeneration = await createMusicGeneration(userId, {
          title: musicRequest.songTitle || undefined,
          genre: genreForDb,
          prompt: customPrompt,
          task_id: undefined, // 没有taskId
          status: 'error'
        });

        // 创建错误记录
        await createGenerationError(
          'music_generation',
          failedGeneration.id,
          result.errorMessage || result.error || 'Generation failed',
          result.error
        );


        // 修改result以包含失败信息和积分信息
        (result as any).creditConsumed = 0; // 失败时不扣除积分
        (result as any).generationFailed = true;
        (result as any).generationId = failedGeneration.id; // 返回generationId供前端删除使用

      } catch (dbError) {
        console.error(`[MUSIC-GEN-${requestId}] Failed to create failed music generation record:`, dbError);
      }
    }

    console.log(`[MUSIC-GEN-${requestId}] Returning response to client`, {
      success: true,
      hasTaskId: !!result.taskId,
      taskId: result.taskId,
      requestProcessingTime: Date.now() - parseInt(requestId.split('_')[1])
    });

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error(`[MUSIC-GEN-${requestId}] Music generation error:`, error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error occurred during music generation',
        success: false
      },
      { status: 500 }
    );
  }
}