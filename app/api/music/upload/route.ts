import { NextRequest, NextResponse } from 'next/server';
import { getUserInfoFromRequest } from '@/lib/auth';
import { uploadAudioFileToKIE } from '@/lib/kie-file-upload';
import { FeatureKey, getFeatureCredits } from '@/lib/credits-config';
import { consumeUserCredit, getUserCredits, addUserCredits } from '@/lib/user-db';
import { createMusicGeneration } from '@/lib/music-db';
import { MusicType } from '@/types/music';
import { DEFAULT_NEGATIVE_TAGS } from '@/lib/music-generation-config';

export const dynamic = 'force-dynamic';

const MODE_CONFIG = {
  cover: {
    endpoint: '/api/v1/generate/upload-cover',
    type: 'upload_cover' as MusicType,
    featureKey: 'upload_cover_music' as FeatureKey,
    refundKey: 'refund_upload_cover_music',
    description: 'Upload cover music'
  },
  extend: {
    endpoint: '/api/v1/generate/upload-extend',
    type: 'upload_extend' as MusicType,
    featureKey: 'upload_extend_music' as FeatureKey,
    refundKey: 'refund_upload_extend_music',
    description: 'Upload extend music'
  }
} as const;

type UploadMode = keyof typeof MODE_CONFIG;

interface UploadPayload {
  uploadUrl: string;
  defaultParamFlag?: boolean;
  customMode?: boolean;
  title: string;
  style?: string;
  prompt?: string;
  personaId?: string;
  model?: string;
  callBackUrl: string;
  instrumental?: boolean;
  continueAt?: number;
}

function buildKIEPayload(mode: UploadMode, params: UploadPayload) {
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
    negativeTags: DEFAULT_NEGATIVE_TAGS, // 使用公共配置
  };

  // 根据 defaultParamFlag 添加不同的参数
  if (useDefaultParamFlag) {
    // Custom mode: 需要 style 和 title，如果 instrumental 为 false，需要 prompt（作为歌词）
    payload.style = params.style;
    if (!params.instrumental && params.prompt) {
      payload.prompt = params.prompt; // 在 custom mode 下，prompt 作为歌词
    }
  } else {
    // Simple mode: 只需要 prompt（用于自动生成歌词）
    payload.prompt = params.prompt;
  }

  if (mode === 'extend' && useDefaultParamFlag && typeof params.continueAt === 'number') {
    payload.continueAt = params.continueAt;
  }

  if (params.personaId) {
    payload.persona_id = params.personaId;
  }

  return payload;
}

function parseNumber(value: FormDataEntryValue | null, fallback = 0): number {
  if (!value) return fallback;
  const num = parseFloat(value.toString());
  return Number.isFinite(num) ? num : fallback;
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
      return { prompt: 5000, style: 1000, title: 100 };
  }
}

function requireCustomFields(options: {
  mode: UploadMode;
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
  const modeValue = (formData.get('mode') || 'cover').toString();
  const mode = (modeValue === 'extend' ? 'extend' : 'cover') as UploadMode;
  const file = formData.get('file');
  const uploadUrl = formData.get('uploadUrl')?.toString().trim() || '';
  const hasUploadUrl = uploadUrl.length > 0;

  if (!hasUploadUrl && !(file instanceof File)) {
    return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
  }

  const defaultParamFlagValue = formData.get('defaultParamFlag') ?? formData.get('customMode');
  const defaultParamFlag = defaultParamFlagValue === 'true';
  const requestedModel = formData.get('model')?.toString() || 'V4';
  const model = defaultParamFlag ? requestedModel : 'V4';
  const limits = getModelLimits(model);

  // 标题处理逻辑：用户填写了就用用户的，没填写就用 "Untitled Track"
  const userInputTitle = formData.get('title')?.toString().trim() || '';
  let title = userInputTitle;
  if (!title && file instanceof File && file.name) {
    title = file.name.replace(/\.[^/.]+$/, '');
  }
  title = title ? title.slice(0, limits.title) : 'Untitled Track';

  const style = formData.get('style')?.toString().slice(0, limits.style) || '';
  const promptInput = formData.get('prompt')?.toString() || formData.get('lyrics')?.toString() || '';
  const promptLimit = !defaultParamFlag ? 400 : limits.prompt;
  const prompt = promptInput.slice(0, promptLimit) || '';
  const personaId = formData.get('personaId')?.toString().trim() || '';
  const instrumental = formData.get('instrumental') === 'true';
  const continueAt = parseNumber(formData.get('continueAt'), 0);

  if (!defaultParamFlag && !prompt) {
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

  if (mode === 'extend' && defaultParamFlag && continueAt <= 0) {
    return NextResponse.json({ error: 'continueAt must be greater than 0' }, { status: 400 });
  }

  if (file instanceof File && file.size > 40 * 1024 * 1024) {
    return NextResponse.json({ error: 'File size must be under 40MB' }, { status: 400 });
  }

  // 模型权限校验已移除：所有模型开放使用。

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
    if (!kieBaseUrl) {
      throw new Error('KIE_API_BASE_URL is not configured');
    }
    if (!apiKey) {
      throw new Error('KIE_API_KEY is not configured');
    }

    const callbackUrl =
      mode === 'extend'
        ? `${process.env.CallBackURL}/api/callbacks/suno/upload-extend`
        : `${process.env.CallBackURL}/api/callbacks/suno/upload-cover`;

    const payload = buildKIEPayload(mode, {
      uploadUrl: resolvedUploadUrl,
      ...(mode === 'extend' ? { defaultParamFlag } : { customMode: defaultParamFlag }),
      title,
      style,
      prompt,
      personaId,
      model,
      callBackUrl: callbackUrl,
      instrumental,
      continueAt: mode === 'extend' && defaultParamFlag ? continueAt : undefined,
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

    const promptForDb = defaultParamFlag ? (style || 'R&B') : prompt;
    const musicRecord = await createMusicGeneration(userId, {
      author_name: authorName,
      title,
      genre: 'R&B',
      tags: undefined,
      prompt: promptForDb,
      generation_mode: defaultParamFlag ? 'custom' : 'simple',
      is_instrumental: instrumental,
      task_id: taskId,
      status: 'generating',
      type: MODE_CONFIG[mode].type,
      model
    });

    if (defaultParamFlag && prompt && prompt.trim().length > 0 && !instrumental) {
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

    // 创建两条占位 track 记录（与普通生成音乐保持一致）
    const { query } = await import('@/lib/db-query-builder');
    const tracksResult = await query(
      `INSERT INTO tracks (music_id, is_published, cover_image_url, suno_track_id)
       VALUES ($1, $2, NULL, NULL), ($1, $2, NULL, NULL)
       RETURNING *`,
      [musicRecord.id, false]
    );

    // 构建初始 tracks 数据返回给前端
    const initialTracks = tracksResult.rows.map((row: any) => ({
      id: row.id,
      generationId: musicRecord.id,
      suno_track_id: row.suno_track_id || null,
      title, // 使用处理后的title（用户输入或"Untitled Track"）
      audioUrl: '',
      duration: undefined,
      coverImage: row.cover_image_url || null,
      tags: '',
      genre: 'R&B',
      prompt: promptForDb,
      lyrics: '',
      generationMode: defaultParamFlag ? 'custom' : 'simple',
      isGenerating: true,
      isCompleted: false,
      streamAudioUrl: '',
      createdAt: row.created_at || new Date().toISOString(),
      model
    }));

    console.log(`[UPLOAD-AUDIO] ✅ Created ${initialTracks.length} placeholder tracks for taskId: ${taskId}`);

    // 立即启动封面生成：在拿到 taskId 后同步发起请求，不再等待 first/complete 回调
    try {
      const callBackBaseUrl = process.env.CallBackURL;
      if (!callBackBaseUrl) {
        console.warn(`[UPLOAD-AUDIO] Cover trigger skipped: CallBackURL is not configured`);
      } else {
        const coverExists = await query(
          'SELECT id FROM cover_generations WHERE music_task_id = $1 LIMIT 1',
          [taskId]
        );

        if (coverExists.rows.length > 0) {
          console.log(`[UPLOAD-AUDIO] Cover generation already exists for taskId: ${taskId}`);
        } else {
          const coverResponse = await fetch(`${callBackBaseUrl}/api/cover/generate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              musicTaskId: taskId,
              userId
            }),
          });

          if (coverResponse.ok) {
            console.log(`[UPLOAD-AUDIO] ✅ Cover generation started for taskId: ${taskId}`);
          } else {
            const coverError = await coverResponse.text().catch(() => '');
            console.error(`[UPLOAD-AUDIO] ❌ Cover generation failed for taskId: ${taskId}, status=${coverResponse.status}, details=${coverError}`);
          }
        }
      }
    } catch (coverError) {
      console.error(`[UPLOAD-AUDIO] Error starting cover generation:`, coverError);
    }

    return NextResponse.json({
      success: true,
      data: {
        taskId,
        musicId: musicRecord.id,
        type: MODE_CONFIG[mode].type,
        initialTracks, // 添加初始占位 tracks
      },
    });
  } catch (error) {
    console.error('Upload audio task failed:', error);
    await addUserCredits(userId, featureCredits, 'Refund upload audio', undefined, MODE_CONFIG[mode].refundKey);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
