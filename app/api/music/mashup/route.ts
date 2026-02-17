import { NextRequest, NextResponse } from 'next/server';
import { getUserInfoFromRequest } from '@/lib/auth';
import { FeatureKey, getFeatureCredits } from '@/lib/credits-config';
import { consumeUserCredit, getUserCredits, addUserCredits } from '@/lib/user-db';
import { createMusicGeneration } from '@/lib/music-db';
import { MusicType } from '@/types/music';
import { DEFAULT_NEGATIVE_TAGS } from '@/lib/music-generation-config';
import { hasFeaturePermission } from '@/lib/feature-permissions';

export const dynamic = 'force-dynamic';

const FEATURE_KEY = 'upload_mashup_music' as FeatureKey;

function parseNumber(value: FormDataEntryValue | null): number | undefined {
  if (!value) return undefined;
  const num = Number.parseFloat(value.toString());
  if (!Number.isFinite(num)) return undefined;
  const clamped = Math.min(1, Math.max(0, num));
  return Math.round(clamped * 100) / 100;
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

export async function POST(request: NextRequest) {
  const userInfo = await getUserInfoFromRequest(request);
  if (!userInfo) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { userId, authorName } = userInfo;

  const hasPermission = await hasFeaturePermission(userId, FEATURE_KEY);
  if (!hasPermission) {
    return NextResponse.json(
      {
        error: 'Feature not available',
        message: 'Mashup feature is not available for your subscription tier. Please upgrade to access this feature.',
      },
      { status: 403 }
    );
  }

  const formData = await request.formData();
  const uploadUrlListRaw = formData.get('uploadUrlList')?.toString() || '';
  const uploadUrlList = uploadUrlListRaw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (uploadUrlList.length !== 2) {
    return NextResponse.json({ error: 'uploadUrlList must contain exactly 2 URLs' }, { status: 400 });
  }

  const customMode = formData.get('customMode') === 'true';
  const requestedModel = formData.get('model')?.toString() || 'V4';
  const model = customMode ? requestedModel : 'V4';
  const limits = getModelLimits(model);

  const style = formData.get('style')?.toString().trim().slice(0, limits.style) || '';
  const titleInput = formData.get('title')?.toString().trim() || '';
  const title = (titleInput || 'Untitled Track').slice(0, limits.title);
  const promptInput = formData.get('prompt')?.toString().trim() || '';
  const promptLimit = customMode ? limits.prompt : 500;
  const prompt = promptInput.slice(0, promptLimit);

  if (!customMode && !prompt) {
    return NextResponse.json({ error: 'Prompt is required in non-custom mode' }, { status: 400 });
  }

  if (customMode) {
    if (!style) {
      return NextResponse.json({ error: 'Style is required in custom mode' }, { status: 400 });
    }
    if (!titleInput) {
      return NextResponse.json({ error: 'Title is required in custom mode' }, { status: 400 });
    }
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required in custom mode' }, { status: 400 });
    }
  }

  const vocalGender = formData.get('vocalGender')?.toString().trim();
  const styleWeight = parseNumber(formData.get('styleWeight'));
  const weirdnessConstraint = parseNumber(formData.get('weirdnessConstraint'));
  const audioWeight = parseNumber(formData.get('audioWeight'));
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

  const featureCredits = getFeatureCredits(FEATURE_KEY);
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
    'Upload mashup music',
    undefined,
    FEATURE_KEY
  );

  if (!creditsConsumed) {
    return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 402 });
  }

  try {
    const kieBaseUrl = process.env.KIE_API_BASE_URL;
    const apiKey = process.env.KIE_API_KEY;
    const callbackBaseUrl = process.env.CallBackURL;

    if (!kieBaseUrl) throw new Error('KIE_API_BASE_URL is not configured');
    if (!apiKey) throw new Error('KIE_API_KEY is not configured');
    if (!callbackBaseUrl) throw new Error('CallBackURL is not configured');

    const callbackUrl = `${callbackBaseUrl}/api/callbacks/suno/upload-mashup`;

    const payload: Record<string, unknown> = {
      uploadUrlList,
      customMode,
      model,
      callBackUrl: callbackUrl,
      negativeTags: DEFAULT_NEGATIVE_TAGS,
    };

    if (customMode) {
      payload.style = style;
      payload.title = title;
      payload.prompt = prompt;
    } else {
      payload.prompt = prompt;
    }

    if (customMode && vocalGender && (vocalGender === 'm' || vocalGender === 'f')) {
      payload.vocalGender = vocalGender;
    }
    if (customMode && styleWeight !== undefined) payload.styleWeight = styleWeight;
    if (customMode && weirdnessConstraint !== undefined) payload.weirdnessConstraint = weirdnessConstraint;
    if (customMode && audioWeight !== undefined) payload.audioWeight = audioWeight;

    const response = await fetch(`${kieBaseUrl}/api/v1/generate/mashup`, {
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
      throw new Error(json.msg || 'Failed to create mashup task');
    }

    const taskId = json.data.taskId as string;

    const promptForDb = customMode ? (style || 'R&B') : prompt;
    const musicRecord = await createMusicGeneration(userId, {
      author_name: authorName,
      title,
      genre: 'R&B',
      tags: undefined,
      prompt: promptForDb,
      generation_mode: customMode ? 'custom' : 'simple',
      is_instrumental: false,
      task_id: taskId,
      status: 'generating',
      type: 'upload_mashup' as MusicType,
      model,
    });

    if (customMode && prompt && prompt.trim().length > 0) {
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
        console.error('[MASHUP] Failed to store lyrics for mashup task:', lyricsError);
      }
    }

    const { query } = await import('@/lib/db-query-builder');
    const tracksResult = await query(
      `INSERT INTO tracks (music_id, is_published, cover_image_url, suno_track_id)
       VALUES ($1, $2, NULL, NULL), ($1, $2, NULL, NULL)
       RETURNING *`,
      [musicRecord.id, false]
    );

    const initialTracks = tracksResult.rows.map((row: any) => ({
      id: row.id,
      generationId: musicRecord.id,
      suno_track_id: row.suno_track_id || null,
      title,
      audioUrl: '',
      duration: undefined,
      coverImage: row.cover_image_url || null,
      tags: '',
      genre: 'R&B',
      prompt: promptForDb,
      lyrics: '',
      generationMode: customMode ? 'custom' : 'simple',
      isGenerating: true,
      isCompleted: false,
      streamAudioUrl: '',
      createdAt: row.created_at || new Date().toISOString(),
      model,
      musicType: 'upload_mashup' as MusicType,
    }));

    try {
      const coverExists = await query(
        'SELECT id FROM cover_generations WHERE music_task_id = $1 LIMIT 1',
        [taskId]
      );

      if (coverExists.rows.length === 0) {
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

        if (!coverResponse.ok) {
          const coverError = await coverResponse.text().catch(() => '');
          console.error(`[MASHUP] Cover generation failed for taskId ${taskId}: ${coverResponse.status} ${coverError}`);
        }
      }
    } catch (coverError) {
      console.error('[MASHUP] Error starting cover generation:', coverError);
    }

    return NextResponse.json({
      success: true,
      data: {
        taskId,
        musicId: musicRecord.id,
        type: 'upload_mashup',
        initialTracks,
      },
    });
  } catch (error) {
    console.error('Upload mashup task failed:', error);
    await addUserCredits(userId, featureCredits, 'Refund upload mashup audio', undefined, 'refund_upload_mashup_music');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
