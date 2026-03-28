import { NextRequest, NextResponse } from 'next/server';

import { getUserInfoFromRequest } from '@/lib/auth';
import { getFeatureCredits } from '@/lib/credits-config';
import { consumeUserCredit, getUserCredits, addUserCredits } from '@/lib/user-db';
import { query, withTransaction } from '@/lib/db-query-builder';
import { SOUND_KEY_OPTIONS } from '@/lib/sound-generation-config';
import { upsertSoundGenerationMetadata } from '@/lib/sound-generation-db';
import { MusicType } from '@/types/music';

export const dynamic = 'force-dynamic';

const DEFAULT_SOUND_TITLE = 'Generated Sound';
const SOUND_PLACEHOLDER_COUNT = 2;
const SOUND_REFUND_TRANSACTION_TYPE = 'refund_generate_sound';
const SOUND_KEY_OPTION_SET = new Set<string>(SOUND_KEY_OPTIONS);
const SOUND_MODEL_OPTION_SET = new Set<string>(['V5', 'V5_5']);
const SOUND_PROMPT_MAX_LENGTH = 500;

function toOptionalNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function deriveSoundTitle(prompt: string): string {
  const normalized = prompt.trim();
  if (!normalized) return DEFAULT_SOUND_TITLE;
  return normalized.length > 80 ? normalized.slice(0, 80) : normalized;
}

export async function POST(request: NextRequest) {
  const requestId = `sound_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  try {
    const userInfo = await getUserInfoFromRequest(request);
    if (!userInfo) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { userId, authorName } = userInfo;
    const body = await request.json().catch(() => ({}));

    const promptInput = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const prompt = promptInput.slice(0, SOUND_PROMPT_MAX_LENGTH);
    const model = typeof body?.model === 'string' && body.model.trim() ? body.model.trim() : 'V5';
    const soundType = body?.soundType === 'loop' ? 'loop' : 'one-shot';
    const soundLoop = soundType === 'loop' || body?.soundLoop === true;
    const soundTempo = toOptionalNumber(body?.soundTempo);
    const soundKeyInput = typeof body?.soundKey === 'string' ? body.soundKey.trim() : '';
    const soundKey = soundKeyInput === 'Any' ? '' : soundKeyInput;
    const grabLyrics = body?.grabLyrics === true;

    if (!promptInput) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (!SOUND_MODEL_OPTION_SET.has(model)) {
      return NextResponse.json({ error: 'model must be V5 or V5_5' }, { status: 400 });
    }

    if (
      soundTempo !== undefined &&
      (!Number.isInteger(soundTempo) || soundTempo < 1 || soundTempo > 300)
    ) {
      return NextResponse.json({ error: 'soundTempo must be an integer between 1 and 300' }, { status: 400 });
    }

    if (soundKey && !SOUND_KEY_OPTION_SET.has(soundKey)) {
      return NextResponse.json({ error: 'Invalid soundKey option' }, { status: 400 });
    }

    const featureCredits = getFeatureCredits('generate_sound');
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

    const kieBaseUrl = process.env.KIE_API_BASE_URL;
    const apiKey = process.env.KIE_API_KEY;
    if (!kieBaseUrl) throw new Error('KIE_API_BASE_URL is not configured');
    if (!apiKey) throw new Error('KIE_API_KEY is not configured');

    const payload: Record<string, unknown> = {
      prompt,
      model,
      soundLoop,
      soundType,
      grabLyrics,
    };

    if (soundTempo !== undefined) {
      payload.soundTempo = soundTempo;
    }
    if (soundKey) {
      payload.soundKey = soundKey;
    }

    const response = await fetch(`${kieBaseUrl}/api/v1/generate/sounds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`KIE API error: ${response.status} ${text}`);
    }

    const result = await response.json();
    const taskId = result?.data?.taskId as string | undefined;
    if (result?.code !== 200 || !taskId) {
      throw new Error(result?.msg || 'Failed to create sound generation task');
    }

    const creditsConsumed = await consumeUserCredit(
      userId,
      featureCredits,
      'Generate Sound',
      taskId,
      'generate_sound'
    );

    if (!creditsConsumed) {
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          required: featureCredits,
          current: userCredits?.credits || 0,
        },
        { status: 402 }
      );
    }

    const title = deriveSoundTitle(prompt);

    try {
      const { musicRecord, initialTracks } = await withTransaction(async (queryFn) => {
        const musicInsert = await queryFn(
          `INSERT INTO music (
            user_id, author_name, title, tags, prompt, generation_mode,
            is_instrumental, task_id, status, type, model
          ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *`,
          [
            userId,
            authorName || null,
            title,
            null,
            prompt,
            'sound',
            false,
            taskId,
            'generating',
            'generated_sound' as MusicType,
            model,
          ]
        );
        const musicRecord = musicInsert.rows[0];

        const tracksResult = await queryFn(
          `INSERT INTO tracks (music_id, is_published, cover_image_url, suno_track_id)
           SELECT $1, FALSE, NULL, NULL FROM generate_series(1, $2)
           RETURNING *`,
          [musicRecord.id, SOUND_PLACEHOLDER_COUNT]
        );

        await upsertSoundGenerationMetadata({
          musicId: musicRecord.id,
          soundLoop,
          soundTempo,
          soundKey: soundKey || null,
          grabLyrics,
          providerRequestJson: payload,
          providerCreateResponseJson: result,
          lastSyncedAt: null,
        }, queryFn);

        const initialTracks = tracksResult.rows.map((row: any) => ({
          id: row.id,
          generationId: musicRecord.id,
          suno_track_id: row.suno_track_id || null,
          title,
          audioUrl: '',
          duration: undefined,
          coverImage: row.cover_image_url || null,
          tags: '',
          prompt,
          lyrics: '',
          generationMode: 'sound',
          isGenerating: true,
          isCompleted: false,
          streamAudioUrl: '',
          createdAt: row.created_at || new Date().toISOString(),
          model,
          musicType: 'generated_sound' as MusicType,
        }));

        return { musicRecord, initialTracks };
      });

      return NextResponse.json({
        success: true,
        data: {
          taskId,
          initialTracks,
        },
      });
    } catch (dbError) {
      console.error(`[SOUND-GEN-${requestId}] Failed to persist sound generation:`, dbError);
      await addUserCredits(
        userId,
        featureCredits,
        'Refund generate sound after local persistence failure',
        taskId,
        SOUND_REFUND_TRANSACTION_TYPE
      ).catch((refundError) => {
        console.error(`[SOUND-GEN-${requestId}] Failed to refund sound credits after DB error:`, refundError);
      });

      throw dbError;
    }
  } catch (error) {
    console.error(`[SOUND-GEN-${requestId}] Error:`, error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate sound',
      },
      { status: 500 }
    );
  }
}
