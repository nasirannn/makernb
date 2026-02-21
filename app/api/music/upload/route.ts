import { NextRequest, NextResponse } from 'next/server';
import { getUserInfoFromRequest } from '@/lib/auth';
import { uploadAudioFileToKIE } from '@/lib/kie-file-upload';
import { FeatureKey, getFeatureCredits } from '@/lib/credits-config';
import { DEFAULT_NEGATIVE_TAGS } from '@/lib/music-generation-config';
import { consumeUserCredit, getUserCredits, addUserCredits } from '@/lib/user-db';
import { createMusicGeneration } from '@/lib/music-db';
import { MusicType } from '@/types/music';
import { hasFeaturePermission } from '@/lib/feature-permissions';

export const dynamic = 'force-dynamic';

const MODE_CONFIG = {
  cover: {
    endpoint: '/api/v1/generate/upload-cover',
    callbackPath: '/api/callbacks/suno/upload-cover',
    type: 'upload_cover' as MusicType,
    featureKey: 'upload_cover_music' as FeatureKey,
    refundKey: 'refund_upload_cover_music',
    description: 'Upload cover music',
    placeholderCount: 2,
  },
  extend: {
    endpoint: '/api/v1/generate/upload-extend',
    callbackPath: '/api/callbacks/suno/upload-extend',
    type: 'upload_extend' as MusicType,
    featureKey: 'upload_extend_music' as FeatureKey,
    refundKey: 'refund_upload_extend_music',
    description: 'Upload extend music',
    placeholderCount: 2,
  },
  vocal: {
    endpoint: '/api/v1/generate/add-vocals',
    callbackPath: '/api/callbacks/suno/upload-vocals',
    type: 'upload_vocal' as MusicType,
    featureKey: 'add_vocals_music' as FeatureKey,
    refundKey: 'refund_add_vocals_music',
    description: 'Add vocals to uploaded music',
    placeholderCount: 1,
  },
  melody: {
    endpoint: '/api/v1/generate/add-instrumental',
    callbackPath: '/api/callbacks/suno/upload-instrumental',
    type: 'upload_melody' as MusicType,
    featureKey: 'add_instrumental_music' as FeatureKey,
    refundKey: 'refund_add_instrumental_music',
    description: 'Add instrumental to uploaded music',
    placeholderCount: 1,
  },
} as const;

type UploadMode = keyof typeof MODE_CONFIG;
type LegacyUploadMode = 'cover' | 'extend';

interface UploadPayload {
  uploadUrl: string;
  defaultParamFlag?: boolean;
  customMode?: boolean;
  title: string;
  style?: string;
  prompt?: string;
  tags?: string;
  negativeTags?: string;
  personaId?: string;
  personaModel?: 'style_persona' | 'voice_persona';
  model?: string;
  callBackUrl: string;
  instrumental?: boolean;
  continueAt?: number;
  vocalGender?: 'm' | 'f';
  styleWeight?: number;
  weirdnessConstraint?: number;
  audioWeight?: number;
}

function isUploadMode(value: string): value is UploadMode {
  return value in MODE_CONFIG;
}

function isLegacyUploadMode(mode: UploadMode): mode is LegacyUploadMode {
  return mode === 'cover' || mode === 'extend';
}

function buildKIEPayload(mode: UploadMode, params: UploadPayload) {
  if (mode === 'vocal') {
    const payload: Record<string, any> = {
      uploadUrl: params.uploadUrl,
      title: params.title,
      style: params.style,
      prompt: params.prompt,
      model: params.model,
      callBackUrl: params.callBackUrl,
      negativeTags: params.negativeTags || DEFAULT_NEGATIVE_TAGS,
    };

    if (params.vocalGender) payload.vocalGender = params.vocalGender;
    if (params.styleWeight !== undefined) payload.styleWeight = params.styleWeight;
    if (params.weirdnessConstraint !== undefined) payload.weirdnessConstraint = params.weirdnessConstraint;
    if (params.audioWeight !== undefined) payload.audioWeight = params.audioWeight;

    return payload;
  }

  if (mode === 'melody') {
    const payload: Record<string, any> = {
      uploadUrl: params.uploadUrl,
      title: params.title,
      tags: params.tags,
      model: params.model,
      callBackUrl: params.callBackUrl,
      negativeTags: params.negativeTags || DEFAULT_NEGATIVE_TAGS,
    };

    if (params.styleWeight !== undefined) payload.styleWeight = params.styleWeight;
    if (params.weirdnessConstraint !== undefined) payload.weirdnessConstraint = params.weirdnessConstraint;
    if (params.audioWeight !== undefined) payload.audioWeight = params.audioWeight;

    return payload;
  }

  const useDefaultParamFlag = params.defaultParamFlag ?? params.customMode ?? false;
  const payload: Record<string, any> = {
    uploadUrl: params.uploadUrl,
    ...(mode === 'extend'
      ? { defaultParamFlag: useDefaultParamFlag }
      : { customMode: useDefaultParamFlag }),
    title: params.title,
    model: params.model,
    callBackUrl: params.callBackUrl,
    instrumental: params.instrumental,
    negativeTags: DEFAULT_NEGATIVE_TAGS,
  };

  if (useDefaultParamFlag) {
    payload.style = params.style;
    if (!params.instrumental && params.prompt) {
      payload.prompt = params.prompt;
    }
    if (params.styleWeight !== undefined) payload.styleWeight = params.styleWeight;
    if (params.weirdnessConstraint !== undefined) payload.weirdnessConstraint = params.weirdnessConstraint;
    if (params.audioWeight !== undefined) payload.audioWeight = params.audioWeight;
  } else {
    payload.prompt = params.prompt;
  }

  if (mode === 'extend' && useDefaultParamFlag && typeof params.continueAt === 'number') {
    payload.continueAt = params.continueAt;
  }

  if (params.personaId) {
    payload.persona_id = params.personaId;
    payload.personaModel = params.personaModel || 'style_persona';
  }

  return payload;
}

function parseNumber(value: FormDataEntryValue | null, fallback = 0): number {
  if (!value) return fallback;
  const num = parseFloat(value.toString());
  return Number.isFinite(num) ? num : fallback;
}

function parseBoundedWeight(value: FormDataEntryValue | null): number | undefined {
  if (!value) return undefined;
  const num = Number.parseFloat(value.toString());
  if (!Number.isFinite(num)) return undefined;
  const clamped = Math.min(1, Math.max(0, num));
  return Math.round(clamped * 100) / 100;
}

function normalizeModel(model: string): string {
  return model.toUpperCase().replace(/\./g, '_').replace(/\+/g, 'PLUS');
}

function resolveModelForMode(mode: UploadMode, requestedModel: string, useCustomMode: boolean): string {
  if (isLegacyUploadMode(mode)) {
    return useCustomMode ? requestedModel : 'V4';
  }

  const normalized = normalizeModel(requestedModel || 'V4_5PLUS');
  if (normalized === 'V5' || normalized === 'V4_5PLUS') {
    return normalized;
  }
  return 'V4_5PLUS';
}

function getModelLimits(model: string) {
  switch (model) {
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
}

function requireCustomFields(options: {
  mode: LegacyUploadMode;
  defaultParamFlag: boolean;
  instrumental: boolean;
  style: string;
  title: string;
  prompt: string;
}) {
  if (!options.defaultParamFlag) {
    return null;
  }
  if (!options.style) {
    return 'Style is required';
  }
  if (!options.title) {
    return 'Title is required';
  }
  if (!options.instrumental && !options.prompt) {
    return 'Prompt is required';
  }
  if (options.mode === 'extend' && options.instrumental && !options.style) {
    return 'Style is required';
  }
  return null;
}

export async function POST(request: NextRequest) {
  const userInfo = await getUserInfoFromRequest(request);
  if (!userInfo) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const { userId, authorName } = userInfo;

  const formData = await request.formData();
  const modeValue = (formData.get('mode') || 'cover').toString().trim();
  if (!isUploadMode(modeValue)) {
    return NextResponse.json({ error: 'Unsupported upload mode' }, { status: 400 });
  }

  const mode = modeValue;
  const isExtendUploadMode = mode === 'extend';
  const file = formData.get('file');
  const uploadUrl = formData.get('uploadUrl')?.toString().trim() || '';
  const hasUploadUrl = uploadUrl.length > 0;
  const rawIsPublished = formData.get('isPublished');
  const requestedCoverPublished = rawIsPublished === null
    ? true
    : rawIsPublished.toString().trim() === 'true';

  if (!hasUploadUrl && !(file instanceof File)) {
    return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
  }

  const defaultParamFlagValue = formData.get('defaultParamFlag') ?? formData.get('customMode');
  const defaultParamFlag = isExtendUploadMode ? true : defaultParamFlagValue === 'true';
  const requestedModel = formData.get('model')?.toString() || 'V4';
  const model = resolveModelForMode(mode, requestedModel, defaultParamFlag);
  const limits = getModelLimits(model);

  const userInputTitle = formData.get('title')?.toString().trim() || '';
  let title = userInputTitle;
  if (!title && file instanceof File && file.name) {
    title = file.name.replace(/\.[^/.]+$/, '');
  }
  title = title ? title.slice(0, limits.title) : 'Untitled Track';

  const style = formData.get('style')?.toString().trim().slice(0, limits.style) || '';
  const promptInput = formData.get('prompt')?.toString().trim() || formData.get('lyrics')?.toString().trim() || '';
  const promptLimit = isLegacyUploadMode(mode)
    ? (defaultParamFlag ? limits.prompt : 500)
    : limits.prompt;
  const prompt = promptInput.slice(0, promptLimit) || '';
  const tags = formData.get('tags')?.toString().trim().slice(0, limits.style) || '';
  const negativeTagsInput = formData.get('negativeTags')?.toString().trim() || '';
  const negativeTags = (negativeTagsInput || DEFAULT_NEGATIVE_TAGS).slice(0, limits.style);
  const personaId = formData.get('personaId')?.toString().trim() || '';
  const personaModelRaw = formData.get('personaModel')?.toString().trim() || 'style_persona';
  const normalizedModel = normalizeModel(model);
  const personaModel: 'style_persona' | 'voice_persona' =
    personaModelRaw === 'voice_persona' && normalizedModel === 'V5'
      ? 'voice_persona'
      : 'style_persona';
  const requestedInstrumental = formData.get('instrumental') === 'true';
  const instrumental = (mode === 'cover' || mode === 'extend') ? false : requestedInstrumental;
  const continueAt = parseNumber(formData.get('continueAt'), 0);

  const rawVocalGender = formData.get('vocalGender')?.toString().trim();
  const vocalGender: 'm' | 'f' | undefined = rawVocalGender === 'm' || rawVocalGender === 'f'
    ? rawVocalGender
    : undefined;
  const styleWeight = parseBoundedWeight(formData.get('styleWeight'));
  const weirdnessConstraint = parseBoundedWeight(formData.get('weirdnessConstraint'));
  const audioWeight = parseBoundedWeight(formData.get('audioWeight'));
  const hasAdvancedWeightsRequested =
    styleWeight !== undefined ||
    weirdnessConstraint !== undefined ||
    audioWeight !== undefined;

  if (hasAdvancedWeightsRequested) {
    const canUseAdvancedOptions = await hasFeaturePermission(userId, 'boost_music_style');
    if (!canUseAdvancedOptions) {
      return NextResponse.json(
        {
          error: 'Advanced options require an active subscription (Starter or Hobby).',
        },
        { status: 403 }
      );
    }
  }

  let trackIsPublished = false;
  if (mode === 'cover') {
    trackIsPublished = requestedCoverPublished;
    if (!trackIsPublished) {
      const canControlPublicVisibility = await hasFeaturePermission(userId, 'control_public_visibility');
      if (!canControlPublicVisibility) {
        return NextResponse.json(
          {
            error: 'Public visibility control requires an active subscription (Starter or Hobby).',
          },
          { status: 403 }
        );
      }
    }
  }

  if (isLegacyUploadMode(mode)) {
    if (mode === 'cover' && !defaultParamFlag && !prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const customError = requireCustomFields({
      mode,
      defaultParamFlag,
      instrumental,
      style,
      title,
      prompt,
    });
    if (customError) {
      return NextResponse.json({ error: customError }, { status: 400 });
    }

    if (isExtendUploadMode && continueAt <= 0) {
      return NextResponse.json({ error: 'continueAt must be greater than 0' }, { status: 400 });
    }
  }

  if (mode === 'vocal') {
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!style) {
      return NextResponse.json({ error: 'Style is required' }, { status: 400 });
    }
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }
  }

  if (mode === 'melody') {
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!tags) {
      return NextResponse.json({ error: 'Tags are required' }, { status: 400 });
    }
  }

  if (file instanceof File && file.size > 100 * 1024 * 1024) {
    return NextResponse.json({ error: 'File size must be under 100MB' }, { status: 400 });
  }

  const featureCredits = getFeatureCredits(MODE_CONFIG[mode].featureKey);
  const userCredits = await getUserCredits(userId);
  if (!userCredits || userCredits.credits < featureCredits) {
    return NextResponse.json(
      {
        error: 'Insufficient credits',
        required: featureCredits,
        current: userCredits?.credits || 0,
      },
      { status: 402 }
    );
  }

  const creditsConsumed = await consumeUserCredit(
    userId,
    featureCredits,
    MODE_CONFIG[mode].description,
    undefined,
    MODE_CONFIG[mode].featureKey
  );

  if (!creditsConsumed) {
    return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 402 });
  }

  try {
    let resolvedUploadUrl = uploadUrl;
    if (!resolvedUploadUrl) {
      if (!(file instanceof File)) {
        throw new Error('Audio file is required');
      }
      const originalExt = file.name?.split('.').pop();
      const safeExt = originalExt && originalExt.length <= 5 ? `.${originalExt}` : '';
      const safeTitle = title.replace(/[^a-zA-Z0-9-_]+/g, '-') || `upload-${Date.now()}`;
      const uploadInfo = await uploadAudioFileToKIE(file, {
        fileName: `${safeTitle}${safeExt}`,
      });
      resolvedUploadUrl = uploadInfo.downloadUrl;
    }

    const kieBaseUrl = process.env.KIE_API_BASE_URL;
    const apiKey = process.env.KIE_API_KEY;
    const callbackBaseUrl = process.env.CallBackURL;

    if (!kieBaseUrl) {
      throw new Error('KIE_API_BASE_URL is not configured');
    }
    if (!apiKey) {
      throw new Error('KIE_API_KEY is not configured');
    }
    if (!callbackBaseUrl) {
      throw new Error('CallBackURL is not configured');
    }

    const callbackUrl = `${callbackBaseUrl}${MODE_CONFIG[mode].callbackPath}`;

    const payload = buildKIEPayload(mode, {
      uploadUrl: resolvedUploadUrl,
      ...(isLegacyUploadMode(mode)
        ? (mode === 'extend' ? { defaultParamFlag } : { customMode: defaultParamFlag })
        : {}),
      title,
      style,
      prompt,
      tags,
      negativeTags,
      personaId,
      personaModel,
      model,
      callBackUrl: callbackUrl,
      instrumental,
      continueAt: isExtendUploadMode ? continueAt : undefined,
      vocalGender,
      styleWeight,
      weirdnessConstraint,
      audioWeight,
    });

    const response = await fetch(`${kieBaseUrl}${MODE_CONFIG[mode].endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`KIE API error: ${response.status} ${text}`);
    }

    const json = await response.json();
    if (json.code !== 200 || !json.data?.taskId) {
      throw new Error(json.msg || 'Failed to create upload task');
    }

    const taskId = json.data.taskId as string;

    const generationMode = isLegacyUploadMode(mode)
      ? (defaultParamFlag ? 'custom' : 'simple')
      : 'custom';

    const promptForDb = mode === 'melody'
      ? (tags || 'R&B')
      : mode === 'vocal'
        ? (style || 'R&B')
        : (defaultParamFlag ? (style || 'R&B') : prompt);

    const musicRecord = await createMusicGeneration(userId, {
      author_name: authorName,
      title,
      tags: mode === 'melody' ? tags : undefined,
      prompt: promptForDb,
      generation_mode: generationMode,
      is_instrumental: isLegacyUploadMode(mode) ? instrumental : false,
      task_id: taskId,
      status: 'generating',
      type: MODE_CONFIG[mode].type,
      model,
    });

    const shouldStoreLyrics =
      (mode === 'vocal' && prompt.trim().length > 0) ||
      (isLegacyUploadMode(mode) && defaultParamFlag && prompt.trim().length > 0 && !instrumental);

    if (shouldStoreLyrics) {
      try {
        const { query } = await import('@/lib/db-query-builder');
        const existingLyrics = await query(
          'SELECT id FROM lyrics WHERE music_id = $1::uuid',
          [musicRecord.id]
        );
        if (existingLyrics.rows.length > 0) {
          await query(
            'UPDATE lyrics SET title = $1, content = $2 WHERE music_id = $3::uuid',
            [title, prompt, musicRecord.id]
          );
        } else {
          await query(
            'INSERT INTO lyrics (music_id, title, content) VALUES ($1::uuid, $2, $3)',
            [musicRecord.id, title, prompt]
          );
        }
      } catch (lyricsError) {
        console.error('[UPLOAD-AUDIO] Failed to store lyrics for upload task:', lyricsError);
      }
    }

    const { query } = await import('@/lib/db-query-builder');
    const tracksResult = await query(
      `INSERT INTO tracks (music_id, is_published, cover_image_url, suno_track_id)
       SELECT $1, $2, NULL, NULL FROM generate_series(1, $3)
       RETURNING *`,
      [musicRecord.id, trackIsPublished, MODE_CONFIG[mode].placeholderCount]
    );

    const initialTracks = tracksResult.rows.map((row: any) => ({
      id: row.id,
      generationId: musicRecord.id,
      suno_track_id: row.suno_track_id || null,
      title,
      audioUrl: '',
      duration: undefined,
      coverImage: row.cover_image_url || null,
      tags: mode === 'melody' ? tags : '',
      prompt: promptForDb,
      lyrics: '',
      generationMode,
      isGenerating: true,
      isCompleted: false,
      streamAudioUrl: '',
      createdAt: row.created_at || new Date().toISOString(),
      model,
      musicType: MODE_CONFIG[mode].type,
    }));

    console.log(`[UPLOAD-AUDIO] ✅ Created ${initialTracks.length} placeholder tracks for taskId: ${taskId}`);

    try {
      const coverExists = await query(
        'SELECT id FROM cover_generations WHERE music_task_id = $1 LIMIT 1',
        [taskId]
      );

      if (coverExists.rows.length > 0) {
        console.log(`[UPLOAD-AUDIO] Cover generation already exists for taskId: ${taskId}`);
      } else {
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
          console.log(`[UPLOAD-AUDIO] ✅ Cover generation started for taskId: ${taskId}`);
        } else {
          const coverError = await coverResponse.text().catch(() => '');
          console.error(`[UPLOAD-AUDIO] ❌ Cover generation failed for taskId: ${taskId}, status=${coverResponse.status}, details=${coverError}`);
        }
      }
    } catch (coverError) {
      console.error('[UPLOAD-AUDIO] Error starting cover generation:', coverError);
    }

    return NextResponse.json({
      success: true,
      data: {
        taskId,
        musicId: musicRecord.id,
        type: MODE_CONFIG[mode].type,
        initialTracks,
      },
    });
  } catch (error) {
    console.error('Upload audio task failed:', error);
    await addUserCredits(
      userId,
      featureCredits,
      `Refund ${MODE_CONFIG[mode].description.toLowerCase()}`,
      undefined,
      MODE_CONFIG[mode].refundKey
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
