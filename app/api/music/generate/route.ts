import { NextRequest, NextResponse } from 'next/server';
import MusicApiService from '@/lib/music-api';
import { createMusicGeneration } from '@/lib/music-db';
import { createGenerationError } from '@/lib/generation-errors-db';
import { consumeUserCredit } from '@/lib/user-db';
import { getUserInfoFromRequest } from '@/lib/auth';
import { getMusicModel, getMusicCredits } from '@/lib/credits-config';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  console.log(`[MUSIC-GEN-${requestId}] Starting music generation`);
  try {
    const { query } = await import('@/lib/db-query-builder');
    // 检查用户是否登录 - 使用统一的身份验证方式
    const userInfo = await getUserInfoFromRequest(request);
    if (!userInfo) {
      console.log(`[MUSIC-GEN-${requestId}] Authentication failed`);
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Please log in to generate music'
        },
        { status: 401 }
      );
    }

    const { userId, authorName } = userInfo;

    const requestData = await request.json();
    console.log(`[MUSIC-GEN-${requestId}] Request: ${requestData.mode} mode, ${requestData.instrumentalMode ? 'instrumental' : 'with vocals'}, model: ${requestData.model || 'V4'}`);

    // 从前端获取所有参数
    const {
      mode: rawMode,
      customPrompt,
      instrumentalMode,
      songTitle,
      styleText,
      vocalGender,
      genre,
      model = 'V4' // 默认使用 V4
    } = requestData;
    const mode = rawMode;
    if (mode === 'simple') {
      // Simple mode validation
    } else if (mode === 'custom') {
      // Custom mode validation handled below
    } else {
      console.log(`[MUSIC-GEN-${requestId}] Invalid mode: ${mode}`);
      return NextResponse.json(
        { error: 'Please select a valid mode (simple or custom)' },
        { status: 400 }
      );
    }

    const getModelLimits = (modelValue: string) => {
      switch (modelValue) {
        case 'V4':
          return { prompt: 3000, style: 200, title: 80 };
        case 'V4_5ALL':
          return { prompt: 5000, style: 1000, title: 80 };
        case 'V4_5':
        case 'V4_5PLUS':
        case 'V5':
        default:
          return { prompt: 5000, style: 1000, title: 80 };
      }
    };

    const limits = getModelLimits(model);
    const trimmedPrompt = customPrompt?.trim() || '';
    const trimmedStyle = styleText?.trim() || '';
    const trimmedTitle = songTitle?.trim() || '';
    const promptLimit = mode === 'simple' ? 400 : limits.prompt;

    if (mode === 'simple' && !trimmedPrompt) {
      return NextResponse.json(
        {
          error: 'Prompt required',
          message: 'Please enter a prompt.',
          success: false
        },
        { status: 400 }
      );
    }

    if (mode === 'custom') {
      if (!trimmedStyle) {
        return NextResponse.json(
          {
            error: 'Style required',
            message: 'Please enter a style.',
            success: false
          },
          { status: 400 }
        );
      }
      if (!trimmedTitle) {
        return NextResponse.json(
          {
            error: 'Title required',
            message: 'Please enter a title.',
            success: false
          },
          { status: 400 }
        );
      }
      if (!instrumentalMode && !trimmedPrompt) {
        return NextResponse.json(
          {
            error: 'Prompt required',
            message: 'Please enter lyrics.',
            success: false
          },
          { status: 400 }
        );
      }
    }

    if (trimmedPrompt.length > promptLimit) {
      return NextResponse.json(
        {
          error: 'Prompt too long',
          message: `Prompt must be ${promptLimit} characters or less for ${model}.`,
          success: false
        },
        { status: 400 }
      );
    }

    if (trimmedStyle && trimmedStyle.length > limits.style) {
      return NextResponse.json(
        {
          error: 'Style too long',
          message: `Style must be ${limits.style} characters or less for ${model}.`,
          success: false
        },
        { status: 400 }
      );
    }

    if (trimmedTitle && trimmedTitle.length > limits.title) {
      return NextResponse.json(
        {
          error: 'Title too long',
          message: `Title must be ${limits.title} characters or less.`,
          success: false
        },
        { status: 400 }
      );
    }

    // 模型权限校验已移除：所有模型开放使用。

    // 根据模式确定积分成本和模型版本
    const musicMode = mode === 'custom' ? 'custom' : 'simple';
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
        // 统一存储固定 genre
        const genreForDb = 'R&B';

        // 步骤1: 扣除积分

        await consumeUserCredit(
          userId,
          creditCost,
          `Music generation (${modelVersion})`,
          result.taskId,
          'music_generation'
        );

        // 步骤2: 创建音乐生成记录
        const generationTags = mode === 'simple' ? trimmedPrompt : trimmedStyle;
        const promptForDb = mode === 'simple' ? customPrompt : trimmedStyle;
        const musicGeneration = await createMusicGeneration(userId, {
          author_name: authorName,
          title: musicRequest.songTitle || null,
          genre: genreForDb,
          tags: generationTags || null,
          prompt: promptForDb,
          generation_mode: mode,
          task_id: result.taskId,
          status: 'generating',
          model: modelVersion
        });

        if (mode === 'custom' && !instrumentalMode && trimmedPrompt) {
          try {
            const existingLyrics = await query(
              'SELECT id FROM lyrics WHERE music_id = $1::uuid',
              [musicGeneration.id]
            );
            if (existingLyrics.rows.length > 0) {
              await query(
                'UPDATE lyrics SET title = $1, content = $2 WHERE music_id = $3::uuid',
                [musicRequest.songTitle || 'Untitled Track', trimmedPrompt, musicGeneration.id]
              );
            } else {
              await query(
                'INSERT INTO lyrics (music_id, title, content) VALUES ($1::uuid, $2, $3)',
                [musicGeneration.id, musicRequest.songTitle || 'Untitled Track', trimmedPrompt]
              );
            }
          } catch (lyricsError) {
            console.error(`[MUSIC-GEN-${requestId}] Failed to store lyrics for custom generation:`, lyricsError);
          }
        }

        // 步骤3: 创建空的tracks记录并返回初始数据
        const isPublished = false; // 默认设置为私有状态

        // 创建两个空的track记录
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
          tags: generationTags || '',
          genre: genreForDb,
          prompt: promptForDb,
          lyrics: '',
          generationMode: mode,
          isGenerating: true,
          isCompleted: false,
          streamAudioUrl: '',
          createdAt: row.created_at || new Date().toISOString(), // 使用数据库的创建时间
          model: modelVersion
        }));

        // 将初始 tracks 添加到响应中
        (result as any).initialTracks = initialTracks;
        console.log(`[MUSIC-GEN-${requestId}] ✅ Created ${initialTracks.length} initial tracks`);
        
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
        const genreForDb = 'R&B';

        const generationTags = mode === 'simple' ? trimmedPrompt : '';
        const promptForDb = mode === 'simple' ? customPrompt : trimmedStyle;
        const failedGeneration = await createMusicGeneration(userId, {
          title: musicRequest.songTitle || undefined,
          genre: genreForDb,
          tags: generationTags || null,
          prompt: promptForDb,
          generation_mode: mode,
          task_id: undefined, // 没有taskId
          status: 'error',
          model: modelVersion
        });

        // 创建错误记录
        await createGenerationError(
          'music_generation',
          userId,
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
