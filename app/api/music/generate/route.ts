import { NextRequest, NextResponse } from 'next/server';
import MusicApiService from '@/lib/music-api';
import { createMusicGeneration, updateMusicGeneration } from '@/lib/music-db';
import { createGenerationError } from '@/lib/generation-errors-db';
import { consumeUserCredit } from '@/lib/user-db';
import { getUserInfoFromRequest } from '@/lib/auth';
import { getFeatureCredits, getMusicCredits } from '@/lib/credits-config';
import { hasFeaturePermission } from '@/lib/feature-permissions';
import { resolveLyricsTitle } from '@/lib/lyrics-title';

export const dynamic = 'force-dynamic';

const GENERATE_IDEMPOTENCY_CACHE_TTL_MS = 5 * 60 * 1000;
const generateIdempotencyCache = new Map<string, { createdAt: number; response: any }>();
const STYLE_BOOST_SUPPORTED_MODELS = new Set(['V4_5', 'V4_5PLUS', 'V4_5ALL']);
const POST_PROCESSING_WARNING_CODE = 'DB_POST_PROCESSING_PARTIAL_FAILURE';

type QueryExecutor = (text: string, params?: any[]) => Promise<{ rows: any[] }>;

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

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildInitialTracksFromRows(
  rows: any[],
  generationId: string,
  title: string,
  prompt: string,
  mode: 'simple' | 'custom',
  modelVersion: string
) {
  return rows.map((row: any) => ({
    id: row.id,
    generationId,
    suno_track_id: row.suno_track_id || null,
    title: title || 'Untitled Track',
    audioUrl: '',
    duration: undefined,
    coverImage: row.cover_image_url || null,
    tags: '',
    prompt,
    lyrics: '',
    generationMode: mode,
    isGenerating: true,
    isCompleted: false,
    streamAudioUrl: '',
    createdAt: row.created_at || new Date().toISOString(),
    model: modelVersion,
    musicType: 'generated',
  }));
}

async function upsertLyricsForGeneration(
  query: QueryExecutor,
  generationId: string,
  title: string,
  lyrics: string
) {
  const resolvedTitle = resolveLyricsTitle(title, lyrics);
  const existingLyrics = await query(
    'SELECT id FROM lyrics WHERE music_id = $1::uuid',
    [generationId]
  );
  if (existingLyrics.rows.length > 0) {
    await query(
      'UPDATE lyrics SET title = $1, content = $2 WHERE music_id = $3::uuid',
      [resolvedTitle, lyrics, generationId]
    );
  } else {
    await query(
      'INSERT INTO lyrics (music_id, title, content) VALUES ($1::uuid, $2, $3)',
      [generationId, resolvedTitle, lyrics]
    );
  }
}

async function triggerCoverGeneration(
  query: QueryExecutor,
  callbackBaseUrl: string | undefined,
  taskId: string,
  userId: string,
  requestId: string
) {
  if (!callbackBaseUrl) {
    console.warn(`[MUSIC-GEN-${requestId}] Cover trigger skipped: CallBackURL is not configured`);
    return;
  }

  const coverExists = await query(
    'SELECT id FROM cover_generations WHERE music_task_id = $1 LIMIT 1',
    [taskId]
  );

  if (coverExists.rows.length > 0) {
    console.log(`[MUSIC-GEN-${requestId}] Cover generation already exists for taskId: ${taskId}`);
    return;
  }

  const coverResponse = await fetch(`${callbackBaseUrl}/api/cover/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      musicTaskId: taskId,
      userId,
    }),
  });

  if (coverResponse.ok) {
    console.log(`[MUSIC-GEN-${requestId}] ✅ Cover generation started for taskId: ${taskId}`);
    return;
  }

  const coverError = await coverResponse.text().catch(() => '');
  throw new Error(`Cover generation failed, status=${coverResponse.status}, details=${coverError}`);
}

async function bindTaskIdWithRetry(
  query: QueryExecutor,
  generationId: string,
  taskId: string,
  modelVersion: string,
  requestId: string
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const updateResult = await query(
        `UPDATE music
         SET task_id = $1, status = 'generating', model = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING id, task_id`,
        [taskId, modelVersion, generationId]
      );

      if (updateResult.rows.length > 0) {
        return;
      }

      const existingRecord = await query(
        'SELECT task_id FROM music WHERE id = $1 LIMIT 1',
        [generationId]
      );
      if (existingRecord.rows.length === 0) {
        throw new Error('Music generation record not found');
      }

      const existingTaskId = existingRecord.rows[0]?.task_id;
      if (typeof existingTaskId === 'string' && existingTaskId === taskId) {
        return;
      }

      throw new Error('Task binding did not persist');
    } catch (error) {
      lastError = error;
      if (attempt < 5) {
        console.warn(`[MUSIC-GEN-${requestId}] Task binding failed on attempt ${attempt}, retrying...`);
        await delay(attempt * 300);
      }
    }
  }

  throw new Error(
    `Failed to bind task_id after retries: ${toErrorMessage(lastError, 'Unknown task binding error')}`
  );
}

async function processSuccessfulGenerationPostTasks(params: {
  query: QueryExecutor;
  requestId: string;
  userId: string;
  generationId: string;
  taskId: string;
  modelVersion: string;
  isPublished: boolean;
  shouldAttemptStyleBoost: boolean;
  totalCreditCost: number;
  mode: 'simple' | 'custom';
  instrumentalMode: boolean;
  trimmedPrompt: string;
  songTitle?: string;
  promptForDb: string;
  callbackBaseUrl?: string;
}) {
  const {
    query,
    requestId,
    userId,
    generationId,
    taskId,
    modelVersion,
    isPublished,
    shouldAttemptStyleBoost,
    totalCreditCost,
    mode,
    instrumentalMode,
    trimmedPrompt,
    songTitle,
    promptForDb,
    callbackBaseUrl,
  } = params;

  const warnings: string[] = [];

  // 必须步骤：绑定 task_id（失败时无法被回调链路识别）
  await bindTaskIdWithRetry(query, generationId, taskId, modelVersion, requestId);

  let initialTracks: any[] = [];

  // 可恢复步骤：创建占位 tracks。失败时回调链路仍会补建 tracks。
  try {
    const tracksResult = await query(
      `INSERT INTO tracks (music_id, is_published, cover_image_url, suno_track_id)
       VALUES ($1, $2, NULL, NULL), ($1, $2, NULL, NULL)
       RETURNING *`,
      [generationId, isPublished]
    );
    initialTracks = buildInitialTracksFromRows(
      tracksResult.rows,
      generationId,
      songTitle || 'Untitled Track',
      promptForDb,
      mode,
      modelVersion
    );
  } catch (error) {
    warnings.push(`TRACK_PLACEHOLDER_CREATE_FAILED: ${toErrorMessage(error, 'Unknown tracks insert failure')}`);
  }

  // 可恢复步骤：扣费（并发场景下可能因余额瞬间变化失败）
  try {
    const consumptionDescription = shouldAttemptStyleBoost
      ? `Music generation (${modelVersion}) + Style boost`
      : `Music generation (${modelVersion})`;
    const consumed = await consumeUserCredit(
      userId,
      totalCreditCost,
      consumptionDescription,
      taskId,
      'music_generation'
    );
    if (!consumed) {
      warnings.push('CREDIT_CONSUME_FAILED: Not enough credits at commit time.');
    }
  } catch (error) {
    warnings.push(`CREDIT_CONSUME_FAILED: ${toErrorMessage(error, 'Unknown credit consume failure')}`);
  }

  // 可恢复步骤：歌词落库失败不阻断主流程
  if (mode === 'custom' && !instrumentalMode && trimmedPrompt) {
    try {
      await upsertLyricsForGeneration(
        query,
        generationId,
        songTitle || '',
        trimmedPrompt
      );
    } catch (error) {
      warnings.push(`LYRICS_UPSERT_FAILED: ${toErrorMessage(error, 'Unknown lyrics upsert failure')}`);
    }
  }

  // 可恢复步骤：封面任务触发失败不阻断主流程
  try {
    await triggerCoverGeneration(query, callbackBaseUrl, taskId, userId, requestId);
  } catch (error) {
    warnings.push(`COVER_TRIGGER_FAILED: ${toErrorMessage(error, 'Unknown cover trigger failure')}`);
  }

  return { initialTracks, warnings };
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
    const promptForDb = mode === 'simple' ? customPrompt : effectiveStyleText;

    const pendingGeneration = await createMusicGeneration(userId, {
      author_name: authorName,
      title: trimmedTitle || null,
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
      // 成功获得taskId：执行本地后处理。
      // 关键策略：task 已创建后，本地可恢复步骤失败不再直接返回 500，避免用户误触发重复生成。
      try {
        console.log(`[MUSIC-GEN-${requestId}] ✅ Processing successful generation`);
        const postProcessingResult = await processSuccessfulGenerationPostTasks({
          query,
          requestId,
          userId,
          generationId: pendingGeneration.id,
          taskId: result.taskId,
          modelVersion,
          isPublished,
          shouldAttemptStyleBoost,
          totalCreditCost,
          mode,
          instrumentalMode,
          trimmedPrompt,
          songTitle: musicRequest.songTitle,
          promptForDb,
          callbackBaseUrl: process.env.CallBackURL,
        });

        if (postProcessingResult.initialTracks.length > 0) {
          (result as any).initialTracks = postProcessingResult.initialTracks;
          console.log(`[MUSIC-GEN-${requestId}] ✅ Created ${postProcessingResult.initialTracks.length} initial tracks`);
        } else {
          console.warn(`[MUSIC-GEN-${requestId}] No initial tracks created; callback flow will backfill tracks`);
        }

        if (postProcessingResult.warnings.length > 0) {
          const warningMessage = postProcessingResult.warnings.join(' | ');
          console.warn(`[MUSIC-GEN-${requestId}] Post-processing warnings: ${warningMessage}`);
          try {
            await createGenerationError(
              'music_generation',
              userId,
              pendingGeneration.id,
              warningMessage,
              POST_PROCESSING_WARNING_CODE
            );
          } catch (recordError) {
            console.error(`[MUSIC-GEN-${requestId}] Failed to record post-processing warnings:`, recordError);
          }
        }
      } catch (fatalError) {
        const fatalMessage = toErrorMessage(fatalError, 'Unknown fatal post-processing error');
        console.error(`[MUSIC-GEN-${requestId}] ❌ Fatal post-processing failure: ${fatalMessage}`);

        try {
          await updateMusicGeneration(pendingGeneration.id, {
            status: 'error',
          });
        } catch (statusError) {
          console.error(`[MUSIC-GEN-${requestId}] Failed to update pending generation status to error:`, statusError);
        }

        try {
          await createGenerationError(
            'music_generation',
            userId,
            pendingGeneration.id,
            fatalMessage,
            'TASK_BIND_FAILED_AFTER_API_SUCCESS'
          );
        } catch (recordError) {
          console.error(`[MUSIC-GEN-${requestId}] Failed to record fatal post-processing error:`, recordError);
        }

        return NextResponse.json(
          {
            error: 'Music generation started but local task binding failed.',
            message: 'A music task was created upstream, but local tracking failed. Please contact support with this task ID.',
            success: false,
            taskId: result.taskId,
            technical_details: fatalMessage,
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
