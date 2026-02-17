import { NextRequest, NextResponse } from 'next/server';
import MusicApiService from '@/lib/music-api';
import { createMusicGeneration, updateMusicGeneration } from '@/lib/music-db';
import { createGenerationError } from '@/lib/generation-errors-db';
import { consumeUserCredit } from '@/lib/user-db';
import { getUserInfoFromRequest } from '@/lib/auth';
import { getFeatureCredits, getMusicCredits } from '@/lib/credits-config';
import { hasFeaturePermission } from '@/lib/feature-permissions';

export const dynamic = 'force-dynamic';

const GENERATE_IDEMPOTENCY_CACHE_TTL_MS = 5 * 60 * 1000;
const generateIdempotencyCache = new Map<string, { createdAt: number; response: any }>();
const STYLE_BOOST_SUPPORTED_MODELS = new Set(['V4_5', 'V4_5PLUS', 'V4_5ALL']);

function normalizeModelName(model: string): string {
  return model.toUpperCase().replace(/\./g, '_').replace(/\+/g, 'PLUS');
}

function canUseStyleBoost(model: string): boolean {
  return STYLE_BOOST_SUPPORTED_MODELS.has(normalizeModelName(model));
}

function parseBoundedWeight(
  rawValue: unknown,
  fieldName: string
): { value: number | undefined; error: string | null } {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return { value: undefined, error: null };
  }

  const parsed = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return { value: undefined, error: `${fieldName} must be a number.` };
  }

  if (parsed < 0 || parsed > 1) {
    return { value: undefined, error: `${fieldName} must be between 0 and 1.` };
  }

  const scaled = parsed * 100;
  if (Math.abs(Math.round(scaled) - scaled) > 1e-8) {
    return { value: undefined, error: `${fieldName} must be a multiple of 0.01.` };
  }

  return { value: Math.round(scaled) / 100, error: null };
}

function cleanupGenerateIdempotencyCache() {
  const now = Date.now();
  generateIdempotencyCache.forEach((value, key) => {
    if (now - value.createdAt > GENERATE_IDEMPOTENCY_CACHE_TTL_MS) {
      generateIdempotencyCache.delete(key);
    }
  });
}

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

    const rawIdempotencyKey = request.headers.get('x-idempotency-key')?.trim();
    const idempotencyKey = rawIdempotencyKey ? `${userId}:${rawIdempotencyKey}` : null;

    cleanupGenerateIdempotencyCache();
    if (idempotencyKey) {
      const cached = generateIdempotencyCache.get(idempotencyKey);
      if (cached) {
        return NextResponse.json(cached.response);
      }
    }

    const requestData = await request.json();
    console.log(`[MUSIC-GEN-${requestId}] Request: ${requestData.mode} mode, ${requestData.instrumentalMode ? 'instrumental' : 'with vocals'}, model: ${requestData.model || 'V4'}`);

    // 从前端获取所有参数
    const {
      mode: rawMode,
      customPrompt,
      instrumentalMode,
      songTitle,
      styleText,
      isPublished: rawIsPublished = true,
      vocalGender,
      personaId,
      personaModel: rawPersonaModel,
      styleWeight: rawStyleWeight,
      weirdnessConstraint: rawWeirdnessConstraint,
      audioWeight: rawAudioWeight,
      model: requestedModel = 'V4', // 默认使用 V4
      enhanceStyle: requestedEnhanceStyle = false,
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

    const modelVersion = requestedModel;
    const normalizedModelVersion = normalizeModelName(modelVersion);
    const personaModel: 'style_persona' | 'voice_persona' =
      rawPersonaModel === 'voice_persona' && normalizedModelVersion === 'V5'
      ? 'voice_persona'
      : 'style_persona';
    const limits = getModelLimits(modelVersion);
    const trimmedPrompt = customPrompt?.trim() || '';
    const trimmedStyle = styleText?.trim() || '';
    const trimmedTitle = songTitle?.trim() || '';
    const parsedStyleWeight = parseBoundedWeight(rawStyleWeight, 'styleWeight');
    const parsedWeirdnessConstraint = parseBoundedWeight(rawWeirdnessConstraint, 'weirdnessConstraint');
    const parsedAudioWeight = parseBoundedWeight(rawAudioWeight, 'audioWeight');

    const weightValidationError =
      parsedStyleWeight.error ||
      parsedWeirdnessConstraint.error ||
      parsedAudioWeight.error;

    if (weightValidationError) {
      return NextResponse.json(
        {
          error: 'Invalid advanced option',
          message: weightValidationError,
          success: false,
        },
        { status: 400 }
      );
    }

    const styleWeight = parsedStyleWeight.value;
    const weirdnessConstraint = parsedWeirdnessConstraint.value;
    const audioWeight = parsedAudioWeight.value;
    const hasAdvancedWeightsRequested = [rawStyleWeight, rawWeirdnessConstraint, rawAudioWeight]
      .some((value) => value !== undefined && value !== null && value !== '');

    if (hasAdvancedWeightsRequested) {
      const canUseAdvancedOptions = await hasFeaturePermission(userId, 'boost_music_style');
      if (!canUseAdvancedOptions) {
        return NextResponse.json(
          {
            error: 'Advanced options require an active subscription (Starter or Hobby).',
            success: false,
          },
          { status: 403 }
        );
      }
    }

    const requestedStyleBoost = mode === 'custom' && requestedEnhanceStyle === true && canUseStyleBoost(modelVersion);
    const canUseStyleBoostFeature = requestedStyleBoost
      ? await hasFeaturePermission(userId, 'boost_music_style')
      : false;
    const shouldAttemptStyleBoost = requestedStyleBoost && canUseStyleBoostFeature;
    const requestedIsPublished = typeof rawIsPublished === 'boolean'
      ? rawIsPublished
      : rawIsPublished === 'false'
        ? false
        : true;

    if (requestedStyleBoost && !canUseStyleBoostFeature) {
      console.log(`[MUSIC-GEN-${requestId}] Style boost requested but permission denied for user ${userId}`);
    }

    if (!requestedIsPublished) {
      const canControlPublicVisibility = await hasFeaturePermission(userId, 'control_public_visibility');
      if (!canControlPublicVisibility) {
        return NextResponse.json(
          {
            error: 'Public visibility control requires an active subscription (Starter or Hobby).',
            success: false,
          },
          { status: 403 }
        );
      }
    }

    const isPublished = requestedIsPublished;
    const promptLimit = mode === 'simple' ? 500 : limits.prompt;

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
          message: `Prompt must be ${promptLimit} characters or less for ${modelVersion}.`,
          success: false
        },
        { status: 400 }
      );
    }

    if (trimmedStyle && trimmedStyle.length > limits.style) {
      return NextResponse.json(
        {
          error: 'Style too long',
          message: `Style must be ${limits.style} characters or less for ${modelVersion}.`,
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
    const creditCost = getMusicCredits(musicMode);
    const styleBoostCreditCost = shouldAttemptStyleBoost ? getFeatureCredits('boost_music_style') : 0;
    const totalCreditCost = creditCost + styleBoostCreditCost;

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

      if (userCredits < totalCreditCost) {
        return NextResponse.json(
          {
            error: 'Insufficient credits',
            message: `You need ${totalCreditCost} credits but only have ${userCredits}. Please purchase more credits to continue.`,
            success: false,
            required: totalCreditCost,
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

    let effectiveStyleText = trimmedStyle;
    let styleBoostApplied = false;

    if (shouldAttemptStyleBoost && trimmedStyle) {
      console.log(`[MUSIC-GEN-${requestId}] Attempting style boost for model ${modelVersion}`);
      const boostedStyle = await musicApi.boostMusicStyle(trimmedStyle);

      if (boostedStyle) {
        effectiveStyleText = boostedStyle.slice(0, limits.style);
        styleBoostApplied = true;
        console.log(`[MUSIC-GEN-${requestId}] Style boost applied successfully`);
      } else {
        console.warn(`[MUSIC-GEN-${requestId}] Style boost unavailable, fallback to original style`);
      }
    }

    // 先落地本地生成记录（task_id 暂为空），避免第三方已创建任务但本地无记录
    const genreForDb = 'R&B';
    const promptForDb = mode === 'simple' ? customPrompt : effectiveStyleText;

    const pendingGeneration = await createMusicGeneration(userId, {
      author_name: authorName,
      title: trimmedTitle || null,
      genre: genreForDb,
      tags: undefined,
      prompt: promptForDb,
      generation_mode: mode,
      is_instrumental: Boolean(instrumentalMode),
      task_id: undefined,
      status: 'generating',
      model: modelVersion,
    });

    // 构造完整的请求对象传递给API
    const musicRequest = {
      mode,
      customPrompt,
      instrumentalMode,
      songTitle,
      styleText: effectiveStyleText,
      vocalGender,
      personaId,
      personaModel,
      styleWeight,
      weirdnessConstraint,
      audioWeight,
      enhanceStyle: shouldAttemptStyleBoost,
      model: modelVersion // 添加模型参数
    };

    // Generate music
    console.log(`[MUSIC-GEN-${requestId}] Calling music API`);

    const result = await musicApi.generateMusic(musicRequest);
    console.log(`[MUSIC-GEN-${requestId}] API response: ${result.taskId ? 'SUCCESS' : 'FAILED'}${styleBoostApplied ? ' (style boosted)' : ''}`);

    // 创建数据库记录和扣除积分（只有API调用成功才执行）
    if (result.taskId) {
      // 成功获得taskId，分步骤处理以减少单个事务时间
      try {
        console.log(`[MUSIC-GEN-${requestId}] ✅ Processing successful generation`);

        // 步骤0: 先将 task_id 绑定到本地记录
        await updateMusicGeneration(pendingGeneration.id, {
          task_id: result.taskId,
          status: 'generating',
          model: modelVersion,
        });

        // 步骤1: 扣除积分

        const consumptionDescription = shouldAttemptStyleBoost
          ? `Music generation (${modelVersion}) + Style boost`
          : `Music generation (${modelVersion})`;

        await consumeUserCredit(
          userId,
          totalCreditCost,
          consumptionDescription,
          result.taskId,
          'music_generation'
        );

        // 步骤2: 写入歌词（如有）
        if (mode === 'custom' && !instrumentalMode && trimmedPrompt) {
          try {
            const existingLyrics = await query(
              'SELECT id FROM lyrics WHERE music_id = $1::uuid',
              [pendingGeneration.id]
            );
            if (existingLyrics.rows.length > 0) {
              await query(
                'UPDATE lyrics SET title = $1, content = $2 WHERE music_id = $3::uuid',
                [musicRequest.songTitle || 'Untitled Track', trimmedPrompt, pendingGeneration.id]
              );
            } else {
              await query(
                'INSERT INTO lyrics (music_id, title, content) VALUES ($1::uuid, $2, $3)',
                [pendingGeneration.id, musicRequest.songTitle || 'Untitled Track', trimmedPrompt]
              );
            }
          } catch (lyricsError) {
            console.error(`[MUSIC-GEN-${requestId}] Failed to store lyrics for custom generation:`, lyricsError);
          }
        }

        // 步骤3: 创建空的tracks记录并返回初始数据
        // 创建两个空的track记录
        const tracksResult = await query(
          `INSERT INTO tracks (music_id, is_published, cover_image_url, suno_track_id)
           VALUES ($1, $2, NULL, NULL), ($1, $2, NULL, NULL)
           RETURNING *`,
          [pendingGeneration.id, isPublished]
        );

        // 构建初始 tracks 数据返回给前端
        const initialTracks = tracksResult.rows.map((row: any) => ({
          id: row.id,
          generationId: pendingGeneration.id,
          suno_track_id: row.suno_track_id || null, // 包含suno_track_id用于匹配
          title: musicRequest.songTitle || 'Untitled Track',
          audioUrl: '',
          duration: undefined,
          coverImage: row.cover_image_url || null,
          tags: '',
          genre: genreForDb,
          prompt: promptForDb,
          lyrics: '',
          generationMode: mode,
          isGenerating: true,
          isCompleted: false,
          streamAudioUrl: '',
          createdAt: row.created_at || new Date().toISOString(), // 使用数据库的创建时间
          model: modelVersion,
          musicType: 'generated',
        }));

        // 将初始 tracks 添加到响应中
        (result as any).initialTracks = initialTracks;
        console.log(`[MUSIC-GEN-${requestId}] ✅ Created ${initialTracks.length} initial tracks`);

        // 立即启动封面生成：在拿到 taskId 后同步发起请求，不再等待 first/complete 回调
        try {
          const callBackBaseUrl = process.env.CallBackURL;
          if (!callBackBaseUrl) {
            console.warn(`[MUSIC-GEN-${requestId}] Cover trigger skipped: CallBackURL is not configured`);
          } else {
            const coverExists = await query(
              'SELECT id FROM cover_generations WHERE music_task_id = $1 LIMIT 1',
              [result.taskId]
            );

            if (coverExists.rows.length > 0) {
              console.log(`[MUSIC-GEN-${requestId}] Cover generation already exists for taskId: ${result.taskId}`);
            } else {
              const coverResponse = await fetch(`${callBackBaseUrl}/api/cover/generate`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  musicTaskId: result.taskId,
                  userId,
                }),
              });

              if (coverResponse.ok) {
                console.log(`[MUSIC-GEN-${requestId}] ✅ Cover generation started for taskId: ${result.taskId}`);
              } else {
                const coverError = await coverResponse.text().catch(() => '');
                console.error(`[MUSIC-GEN-${requestId}] ❌ Cover generation failed for taskId: ${result.taskId}, status=${coverResponse.status}, details=${coverError}`);
              }
            }
          }
        } catch (coverError) {
          console.error(`[MUSIC-GEN-${requestId}] Error starting cover generation:`, coverError);
        }
        
      } catch (dbError) {
        console.error(`[MUSIC-GEN-${requestId}] ❌ Database operation failed`);

        try {
          await updateMusicGeneration(pendingGeneration.id, {
            status: 'error',
          });
        } catch (statusError) {
          console.error(`[MUSIC-GEN-${requestId}] Failed to update pending generation status to error:`, statusError);
        }

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
            `, [userId, totalCreditCost, result.taskId]);

            // 更新用户积分
            await query(
              'UPDATE user_credits SET credits = credits + $2, updated_at = NOW() WHERE user_id = $1::uuid',
              [userId, totalCreditCost]
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
        await updateMusicGeneration(pendingGeneration.id, {
          status: 'error',
        });

        // 创建错误记录
        await createGenerationError(
          'music_generation',
          userId,
          pendingGeneration.id,
          result.errorMessage || result.error || 'Generation failed',
          result.error
        );

        // 修改result以包含失败信息和积分信息
        (result as any).creditConsumed = 0; // 失败时不扣除积分
        (result as any).generationFailed = true;
        (result as any).generationId = pendingGeneration.id; // 返回generationId供前端删除使用

      } catch (dbError) {
        console.error(`[MUSIC-GEN-${requestId}] Failed to update failed music generation record:`, dbError);
      }
    }

    console.log(`[MUSIC-GEN-${requestId}] Request completed`);

    const responsePayload = {
      success: true,
      data: result,
    };

    if (idempotencyKey) {
      generateIdempotencyCache.set(idempotencyKey, {
        createdAt: Date.now(),
        response: responsePayload,
      });
    }

    return NextResponse.json(responsePayload);

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
