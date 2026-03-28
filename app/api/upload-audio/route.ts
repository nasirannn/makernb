import { NextRequest, NextResponse } from 'next/server';
import { getUserInfoFromRequest } from '@/lib/auth';
import { uploadAudioFileToKIE } from '@/lib/kie-file-upload';
import { FeatureKey, getFeatureCredits } from '@/lib/credits-config';
import { DEFAULT_NEGATIVE_TAGS } from '@/lib/music-generation-config';
import { consumeUserCredit, getUserCredits, addUserCredits } from '@/lib/user-db';
import { createMusicGeneration } from '@/lib/music-db';
import { MusicType } from '@/types/music';

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
  customMode: boolean;
  title: string;
  style?: string;
  prompt?: string;
  model?: string;
  callBackUrl: string;
  instrumental?: boolean;
}

function buildKIEPayload(params: UploadPayload) {
  const payload: Record<string, any> = {
    uploadUrl: params.uploadUrl,
    customMode: params.customMode,
    title: params.title,
    model: params.model,
    callBackUrl: params.callBackUrl,
    instrumental: params.instrumental,
    negativeTags: DEFAULT_NEGATIVE_TAGS, // 使用公共配置
  };

  // 根据 customMode 添加不同的参数
  if (params.customMode) {
    // Custom mode: 需要 style 和 title，如果 instrumental 为 false，需要 prompt（作为歌词）
    payload.style = params.style;
    if (!params.instrumental && params.prompt) {
      payload.prompt = params.prompt; // 在 custom mode 下，prompt 作为歌词
    }
  } else {
    // Simple mode: 只需要 prompt（用于自动生成歌词）
    payload.prompt = params.prompt;
  }

  return payload;
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

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
  }

  const customMode = formData.get('customMode') === 'true';

  // 标题处理逻辑：用户填写了就用用户的，没填写就用 "Untitled Track"
  const userInputTitle = formData.get('title')?.toString().trim() || '';
  const title = userInputTitle ? userInputTitle.slice(0, 100) : 'Untitled Track';

  const style = formData.get('style')?.toString().slice(0, 1000) || '';
  // 根据 customMode 限制 lyrics 长度
  const maxLyricsLength = customMode ? 5000 : 500;
  const lyrics = formData.get('lyrics')?.toString().slice(0, maxLyricsLength) || '';
  const model = formData.get('model')?.toString() || 'V4';
  const instrumental = formData.get('instrumental') === 'true';

  if (file.size > 100 * 1024 * 1024) {
    return NextResponse.json({ error: 'File size must be under 100MB' }, { status: 400 });
  }

  // 验证模型权限（V4 之外的所有模型都需要订阅）
  if (model !== 'V4') {
    try {
      const { hasFeaturePermission } = await import('@/lib/feature-permissions');
      const normalizedModel = model.toUpperCase().replace(/\./g, '_').replace(/\+/g, 'PLUS');
      const modelFeatureCode = normalizedModel === 'V5_5'
        ? 'model_v5'
        : `model_${model.toLowerCase().replace('+', '_plus').replace('.', '_')}`;
      const hasModelPermission = await hasFeaturePermission(userId, modelFeatureCode);

      if (!hasModelPermission) {
        console.log(`[UPLOAD-AUDIO] Model ${model} requires subscription for user ${userId}`);
        return NextResponse.json(
          {
            error: 'Subscription required',
            message: `Model ${model} requires a subscription. Please subscribe or use V4 model.`,
          },
          { status: 403 }
        );
      }
    } catch (error) {
      console.error(`[UPLOAD-AUDIO] Error checking model permission:`, error);
      return NextResponse.json(
        {
          error: 'Permission check failed',
          message: 'Unable to verify model permissions',
        },
        { status: 500 }
      );
    }
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
    const originalExt = file.name?.split('.').pop();
    const safeExt = originalExt && originalExt.length <= 5 ? `.${originalExt}` : '';
    const safeTitle = title.replace(/[^a-zA-Z0-9-_]+/g, '-') || `upload-${Date.now()}`;
    const uploadInfo = await uploadAudioFileToKIE(file, {
      fileName: `${safeTitle}${safeExt}`,
    });

    const kieBaseUrl = process.env.KIE_API_BASE_URL;
    const apiKey = process.env.KIE_API_KEY;
    if (!kieBaseUrl) {
      throw new Error('KIE_API_BASE_URL is not configured');
    }
    if (!apiKey) {
      throw new Error('KIE_API_KEY is not configured');
    }

    const payload = buildKIEPayload({
      uploadUrl: uploadInfo.downloadUrl,
      customMode,
      title,
      style,
      prompt: lyrics,
      model,
      callBackUrl: `${process.env.CallBackURL}/api/suno-callback`,
      instrumental,
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

    const promptForDb = customMode ? (style || 'R&B') : lyrics;
    const musicRecord = await createMusicGeneration(userId, {
      author_name: authorName,
      title,
      tags: undefined,
      prompt: promptForDb,
      generation_mode: customMode ? 'custom' : 'simple',
      is_instrumental: instrumental,
      task_id: taskId,
      status: 'generating',
      type: MODE_CONFIG[mode].type,
      model: model
    });

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
      prompt: promptForDb,
      lyrics: '',
      generationMode: customMode ? 'custom' : 'simple',
      isGenerating: true,
      isCompleted: false,
      streamAudioUrl: '',
      createdAt: row.created_at || new Date().toISOString(),
      musicType: MODE_CONFIG[mode].type,
    }));

    console.log(`[UPLOAD-AUDIO] ✅ Created ${initialTracks.length} placeholder tracks for taskId: ${taskId}`);

    // 启动封面生成（异步，不阻塞响应）
    setImmediate(async () => {
      try {
        const coverResponse = await fetch(`${process.env.CallBackURL}/api/generate-cover`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            musicTaskId: taskId,
            userId: userId
          }),
        });

        if (coverResponse.ok) {
          console.log(`[UPLOAD-AUDIO] ✅ Cover generation started for taskId: ${taskId}`);
        } else {
          console.error(`[UPLOAD-AUDIO] ❌ Cover generation failed for taskId: ${taskId}`);
        }
      } catch (coverError) {
        console.error(`[UPLOAD-AUDIO] Error starting cover generation:`, coverError);
        // 封面生成失败不影响上传流程
      }
    });

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
