import { NextRequest, NextResponse } from 'next/server';
import MusicApiService from '@/lib/music-api';
import { createMusicGeneration } from '@/lib/music-db';
import { createGenerationError } from '@/lib/generation-errors-db';
import { consumeUserCredit } from '@/lib/user-db';
import { getUserIdFromRequest } from '@/lib/auth';
import { getMusicModel, getMusicCredits } from '@/lib/credits-config';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  console.log(`[MUSIC-GEN-${requestId}] Starting music generation`);
  try {
    // 检查用户是否登录 - 使用统一的身份验证方式
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      console.log(`[MUSIC-GEN-${requestId}] Authentication failed`);
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Please log in to generate music'
        },
        { status: 401 }
      );
    }

    const requestData = await request.json();
    console.log(`[MUSIC-GEN-${requestId}] Request: ${requestData.mode} mode, ${requestData.instrumentalMode ? 'instrumental' : 'with vocals'}, model: ${requestData.model || 'V4_5'}`);

    // 从前端获取所有参数
    const {
      mode,
      customPrompt,
      instrumentalMode,
      songTitle,
      styleText,
      vocalGender,
      genre,
      model = 'V4_5' // 默认使用 V4.5
    } = requestData;
    if (mode === 'basic') {
      // Basic mode validation
    } else if (mode === 'custom') {
      // Custom mode: styleText is now optional, no validation needed
    } else {
      console.log(`[MUSIC-GEN-${requestId}] Invalid mode: ${mode}`);
      return NextResponse.json(
        { error: 'Please select a valid mode (basic or custom)' },
        { status: 400 }
      );
    }

    // 验证模型权限（V3.5 之外的所有模型都需要订阅）
    if (model !== 'V3_5') {
      try {
        const { hasFeaturePermission } = await import('@/lib/feature-permissions');
        const modelFeatureCode = `model_${model.toLowerCase().replace('+', '_plus').replace('.', '_')}`;
        const hasModelPermission = await hasFeaturePermission(userId, modelFeatureCode);

        if (!hasModelPermission) {
          console.log(`[MUSIC-GEN-${requestId}] Model ${model} requires subscription`);
          return NextResponse.json(
            {
              error: 'Subscription required',
              message: `Model ${model} requires a subscription. Please subscribe or use V3.5 model.`,
              success: false
            },
            { status: 403 }
          );
        }
      } catch (error) {
        console.error(`[MUSIC-GEN-${requestId}] Error checking model permission:`, error);
        return NextResponse.json(
          {
            error: 'Permission check failed',
            message: 'Unable to verify model permissions',
            success: false
          },
          { status: 500 }
        );
      }
    }

    // 根据模式确定积分成本和模型版本
    const musicMode = mode === 'custom' ? 'custom' : 'basic';
    const modelVersion = model; // 使用前端传递的模型
    const creditCost = getMusicCredits(musicMode);

    try {
      const { query } = await import('@/lib/db-query-builder');
      const creditResult = await query(
        'SELECT credits FROM user_credits WHERE user_id = $1::uuid',
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
    const apiKey = process.env.KIE_API_KEY;
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
      vocalGender,
      model: modelVersion // 添加模型参数
    };

    // Generate music
    console.log(`[MUSIC-GEN-${requestId}] Calling music API`);

    const result = await musicApi.generateMusic(musicRequest);
    console.log(`[MUSIC-GEN-${requestId}] API response: ${result.taskId ? 'SUCCESS' : 'FAILED'}`);

    // 创建数据库记录和扣除积分（只有API调用成功才执行）
    if (result.taskId) {
      // 成功获得taskId，分步骤处理以减少单个事务时间
      try {
        console.log(`[MUSIC-GEN-${requestId}] ✅ Processing successful generation`);
        // 准备数据库存储的genre
        let genreForDb = 'R&B'; // 默认值
        if (genre) {
          genreForDb = genre;
        }

        // 步骤1: 扣除积分

        await consumeUserCredit(
          userId,
          creditCost,
          `Music generation (${modelVersion})`,
          result.taskId,
          'music_generation'
        );

        // 步骤2: 创建音乐生成记录
        const musicGeneration = await createMusicGeneration(userId, {
          title: musicRequest.songTitle || null,
          genre: genreForDb,
          prompt: customPrompt,
          task_id: result.taskId,
          status: 'generating'
        });

        // 步骤3: 创建空的tracks记录并返回初始数据
        const isPublished = false; // 默认设置为私有状态

        // 创建两个空的track记录
        const { query } = await import('@/lib/db-query-builder');
        const tracksResult = await query(
          `INSERT INTO tracks (music_id, is_published, cover_image_url, suno_track_id)
           VALUES ($1, $2, NULL, NULL), ($1, $2, NULL, NULL)
           RETURNING *`,
          [musicGeneration.id, isPublished]
        );

        // 构建初始 tracks 数据返回给前端
        const initialTracks = tracksResult.rows.map((row: any, index: number) => ({
          id: row.id,
          generationId: musicGeneration.id,
          suno_track_id: row.suno_track_id || null, // 包含suno_track_id用于匹配
          title: musicRequest.songTitle || 'Untitled Track',
          audioUrl: '',
          duration: undefined,
          coverImage: row.cover_image_url || null,
          tags: customPrompt || '', // 使用用户输入的prompt作为tags
          genre: genreForDb,
          lyrics: '',
          isGenerating: true,
          isCompleted: false,
          streamAudioUrl: '',
          createdAt: row.created_at || new Date().toISOString() // 使用数据库的创建时间
        }));

        // 将初始 tracks 添加到响应中
        (result as any).initialTracks = initialTracks;
        console.log(`[MUSIC-GEN-${requestId}] ✅ Created ${initialTracks.length} initial tracks`);
        
        // 步骤4: 启动封面生成
        setImmediate(async () => {
          try {
            const coverResponse = await fetch(`${process.env.CallBackURL}/api/generate-cover`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                musicTaskId: result.taskId,
                userId: userId
              }),
            });

            if (coverResponse.ok) {
              console.log(`[MUSIC-GEN-${requestId}] ✅ Cover generation started`);
            } else {
              console.error(`[MUSIC-GEN-${requestId}] ❌ Cover generation failed`);
            }
          } catch (coverError) {
            console.error(`[MUSIC-GEN-${requestId}] Error starting cover generation:`, coverError);
            // 封面生成失败不影响音乐生成流程
          }
        });

      } catch (dbError) {
        console.error(`[MUSIC-GEN-${requestId}] ❌ Database operation failed`);

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
            console.log(`[MUSIC-GEN-${requestId}] Attempting credit compensation`);

            // 创建补偿积分记录
            await query(`
              INSERT INTO credit_transactions (
                user_id, transaction_type, amount,
                balance_after, description, reference_id
              )
              SELECT
                user_id, 'credit', $2,
                (SELECT credits FROM user_credits WHERE user_id = $1::uuid) + $2,
                'Compensation for failed generation: ' || $3,
                $3
              FROM credit_transactions
              WHERE reference_id = $3 AND description LIKE '%Music generation%'
              LIMIT 1
            `, [userId, creditCost, result.taskId]);

            // 更新用户积分
            await query(
              'UPDATE user_credits SET credits = credits + $2, updated_at = NOW() WHERE user_id = $1::uuid',
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
      console.log(`[MUSIC-GEN-${requestId}] API call failed: ${result.error || result.errorMessage}`);
      // 没有taskId，说明生成失败（可能包含敏感词等）

      try {
        // 创建失败记录到数据库
        let genreForDb = 'R&B'; // 默认值
        if (genre) {
          genreForDb = genre;
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

    console.log(`[MUSIC-GEN-${requestId}] Request completed`);

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