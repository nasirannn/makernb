import { NextRequest, NextResponse } from 'next/server';

import { getUserIdFromRequest } from '@/lib/auth';
import { hasFeaturePermission } from '@/lib/feature-permissions';
import { query } from '@/lib/db-query-builder';
import { getFeatureCredits } from '@/lib/credits-config';
import { consumeUserCredit, getUserCredits } from '@/lib/user-db';
import MusicApiService from '@/lib/music-api';
import { createTrackPersona, getTrackPersonaByAudioId } from '@/lib/track-persona-db';
import { getPersonaSupportIssue } from '@/lib/persona-support';

export const dynamic = 'force-dynamic';

const PERSONA_NAME_MAX_LENGTH = 100;
const PERSONA_DESCRIPTION_MAX_LENGTH = 1000;

const isConflictError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeCode = (error as { code?: number }).code;
  return maybeCode === 409;
};


const getProviderErrorCode = (error: unknown): number | null => {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const maybeCode = (error as { code?: unknown }).code;
  if (typeof maybeCode !== 'number' || !Number.isFinite(maybeCode)) {
    return null;
  }

  return Math.trunc(maybeCode);
};

const getProviderErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) {
    return 'Persona generation request failed. Please try another track.';
  }

  const message = error.message?.trim();
  if (!message) {
    return 'Persona generation request failed. Please try another track.';
  }

  const separatorIndex = message.lastIndexOf(' - ');
  if (separatorIndex >= 0) {
    const tail = message.slice(separatorIndex + 3).trim();
    if (tail && tail.toLowerCase() !== 'unknown error') {
      return tail;
    }
  }

  const apiErrorMatch = message.match(/Persona generation API error \([^)]*\):\s*(.+)$/i);
  if (apiErrorMatch?.[1]) {
    return apiErrorMatch[1].trim();
  }

  return message;
};

const mapProviderStatusCode = (code: number) => {
  const passthroughStatusCodes = new Set([400, 401, 402, 403, 404, 408, 409, 413, 422, 429, 451, 455, 500, 501]);
  return passthroughStatusCodes.has(code) ? code : 502;
};

/**
 * POST /api/generate-persona
 * 根据已生成音频创建 Persona
 */
export async function POST(request: NextRequest) {
  const requestId = `persona-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const hasPermission = await hasFeaturePermission(userId, 'generate_persona');
    if (!hasPermission) {
      return NextResponse.json(
        {
          error: 'Feature not available',
          message: 'Persona generation feature is not available for your subscription tier. Please upgrade to access this feature.',
        },
        { status: 403 }
      );
    }

    const { trackId, name, description } = await request.json();

    if (!trackId || typeof trackId !== 'string') {
      return NextResponse.json({ error: 'trackId is required' }, { status: 400 });
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    if (!description || typeof description !== 'string' || !description.trim()) {
      return NextResponse.json({ error: 'description is required' }, { status: 400 });
    }

    const normalizedName = name.trim().slice(0, PERSONA_NAME_MAX_LENGTH);
    const normalizedDescription = description.trim().slice(0, PERSONA_DESCRIPTION_MAX_LENGTH);

    const trackResult = await query(
      `SELECT
        mt.id as track_id,
        mt.suno_track_id as audio_id,
        mg.task_id,
        mg.type as music_type,
        mg.model,
        mg.user_id,
        mg.status as music_status,
        COALESCE(mt.title, mg.title) as title
       FROM tracks mt
       INNER JOIN music mg ON mt.music_id = mg.id
       WHERE mt.id = $1::uuid
         AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
       LIMIT 1`,
      [trackId]
    );

    if (trackResult.rows.length === 0) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    const track = trackResult.rows[0];

    if (track.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const normalizedTaskId = typeof track.task_id === 'string' ? track.task_id.trim() : '';
    const normalizedAudioId = typeof track.audio_id === 'string' ? track.audio_id.trim() : '';

    const supportIssue = getPersonaSupportIssue({
      musicType: typeof track.music_type === 'string' ? track.music_type : null,
      model: typeof track.model === 'string' ? track.model : null,
    });

    if (supportIssue === 'unsupported_source') {
      return NextResponse.json(
        {
          error: 'Unsupported persona source',
          message: 'Persona can only be generated from Generate, Extend, Upload Cover, or Upload Extend tasks.',
          requestId,
        },
        { status: 400 }
      );
    }

    if (supportIssue === 'unsupported_model') {
      return NextResponse.json(
        {
          error: 'Unsupported persona model',
          message: 'Persona requires music generated by a model above v3.5. Tracks created with v3.5 are not supported.',
          requestId,
        },
        { status: 400 }
      );
    }

    if (!normalizedTaskId || !normalizedAudioId) {
      return NextResponse.json(
        {
          error: 'Cannot generate persona',
          message: 'Track does not have required task ID or audio ID for persona generation',
          requestId,
        },
        { status: 400 }
      );
    }

    if (track.music_status !== 'complete') {
      return NextResponse.json(
        {
          error: 'Music is not ready',
          message: 'Please wait until music generation is complete before creating a persona.',
        },
        { status: 409 }
      );
    }

    const existingPersona = await getTrackPersonaByAudioId(normalizedAudioId);
    if (existingPersona) {
      return NextResponse.json(
        {
          success: true,
          data: {
            trackId,
            personaId: existingPersona.personaId,
            name: existingPersona.name || normalizedName,
            description: existingPersona.description || normalizedDescription,
            isExisting: true,
          },
        },
        { status: 200 }
      );
    }

    const requiredCredits = getFeatureCredits('generate_persona');
    const userCredits = await getUserCredits(userId);
    if (!userCredits || userCredits.credits < requiredCredits) {
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          required: requiredCredits,
          current: userCredits?.credits || 0,
          insufficientCredits: true,
        },
        { status: 402 }
      );
    }

    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const musicApi = new MusicApiService(apiKey);

    let generatedPersona: { personaId: string; name: string; description: string };

    console.info('[GENERATE-PERSONA] Requesting KIE persona', {
      requestId,
      trackId,
      taskId: normalizedTaskId,
      audioId: normalizedAudioId,
      audioIdLength: normalizedAudioId.length,
    });

    try {
      const apiResult = await musicApi.generatePersona({
        taskId: normalizedTaskId,
        audioId: normalizedAudioId,
        name: normalizedName,
        description: normalizedDescription,
      });

      generatedPersona = {
        personaId: apiResult.data.personaId,
        name: apiResult.data.name || normalizedName,
        description: apiResult.data.description || normalizedDescription,
      };
    } catch (error) {
      if (isConflictError(error)) {
        const conflictedPersona = await getTrackPersonaByAudioId(normalizedAudioId);
        if (conflictedPersona) {
          return NextResponse.json(
            {
              success: true,
              data: {
                trackId,
                personaId: conflictedPersona.personaId,
                name: conflictedPersona.name || normalizedName,
                description: conflictedPersona.description || normalizedDescription,
                isExisting: true,
              },
            },
            { status: 200 }
          );
        }
      }

      const providerCode = getProviderErrorCode(error);
      if (providerCode !== null) {
        const providerMessage = getProviderErrorMessage(error);

        console.warn('[GENERATE-PERSONA] KIE provider error', {
          requestId,
          providerCode,
          providerMessage,
          trackId,
          taskId: normalizedTaskId,
          audioId: normalizedAudioId,
          audioIdLength: normalizedAudioId.length,
        });

        return NextResponse.json(
          {
            error: 'Persona generation failed',
            message: providerMessage,
            providerCode,
            requestId,
          },
          { status: mapProviderStatusCode(providerCode) }
        );
      }

      throw error;
    }

    const personaRecord = await createTrackPersona({
      trackId,
      taskId: normalizedTaskId,
      audioId: normalizedAudioId,
      personaId: generatedPersona.personaId,
      name: generatedPersona.name,
      description: generatedPersona.description,
    });

    const creditConsumed = await consumeUserCredit(
      userId,
      requiredCredits,
      'Generate Persona',
      personaRecord.id,
      'generate_persona'
    );

    if (!creditConsumed) {
      await query("UPDATE track_personas SET status = 'deleted', updated_at = NOW() WHERE id = $1::uuid", [personaRecord.id]);
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          required: requiredCredits,
          current: userCredits?.credits || 0,
          insufficientCredits: true,
        },
        { status: 402 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        trackId,
        personaId: personaRecord.personaId,
        name: personaRecord.name,
        description: personaRecord.description,
      },
    });
  } catch (error) {
    console.error('[GENERATE-PERSONA] Error:', {
      requestId,
      error,
    });

    return NextResponse.json(
      {
        error: 'Failed to generate persona',
        details: error instanceof Error ? error.message : 'Unknown error',
        requestId,
      },
      { status: 500 }
    );
  }
}
