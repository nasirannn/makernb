import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

import { getUserIdFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SUPPORTED_GENRES: Record<string, string> = {
  'new-jack-swing': 'New Jack Swing',
  'hip-hop-soul': 'Hip-Hop Soul',
  'neo-soul': 'Neo Soul',
  'quiet-storm': 'Quiet Storm',
  'pb-rnb': 'PB R&B',
  'crunk-rnb': 'Crunk R&B',
};

const SYSTEM_PROMPT = [
  'You are a music prompt writer for AI song generation.',
  'Generate exactly one English sentence using this 6-part structure, separated by commas:',
  'era, style anchor, rhythm groove, instrumentation, vocals, mood.',
  'Era can be a concise decade token (80s, 90s, 00s, 10s, 20s) or include timing modifiers like early, mid/middle, or late (for example: early 90s, mid 00s, late 10s).',
  'The first segment must be era only.',
  'No labels, no bullet points, no line breaks, no extra explanation.',
  'Keep it concise, vivid, and production-ready.',
  'Return only the final prompt sentence.',
].join(' ');

const normalizeReplicateOutput = (output: unknown): string => {
  if (typeof output === 'string') {
    return output;
  }

  if (Array.isArray(output)) {
    return output
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (typeof item === 'number' || typeof item === 'boolean') {
          return String(item);
        }
        return '';
      })
      .join('');
  }

  return '';
};

const sanitizePrompt = (value: string): string => {
  const cleaned = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/^['"“”`]+|['"“”`]+$/g, '')
    .trim();

  if (!cleaned) {
    return '';
  }

  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
};

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Please log in to generate prompt',
        },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const genreId = typeof body?.genreId === 'string' ? body.genreId.trim() : '';
    const genreName = typeof body?.genreName === 'string' ? body.genreName.trim() : '';
    const currentPrompt = typeof body?.currentPrompt === 'string' ? body.currentPrompt.trim() : '';

    if (!genreId || !SUPPORTED_GENRES[genreId]) {
      return NextResponse.json(
        { error: 'Unsupported genre id' },
        { status: 400 }
      );
    }

    const resolvedGenreName = genreName || SUPPORTED_GENRES[genreId];

    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) {
      return NextResponse.json(
        { error: 'Replicate API token is not configured' },
        { status: 500 }
      );
    }

    const replicate = new Replicate({ auth: replicateToken });

    const prompt = [
      `Target genre id: ${genreId}`,
      `Target genre name: ${resolvedGenreName}`,
      currentPrompt ? `Current prompt reference: ${currentPrompt}` : 'Current prompt reference: (none)',
      '',
      'Task:',
      'Generate one fresh prompt that keeps the same 6-part structure used by this product:',
      'era, style anchor, rhythm groove, instrumentation, vocals, mood.',
      'Decide the most fitting era for this genre and put it in the first segment; era may use early/mid(middle)/late modifiers.',
      'Keep genre identity clear and avoid generic wording.',
    ].join('\n');

    const output = await replicate.run('openai/gpt-4o-mini', {
      input: {
        prompt,
        system_prompt: SYSTEM_PROMPT,
      },
    });

    const generatedPrompt = sanitizePrompt(normalizeReplicateOutput(output));

    if (!generatedPrompt) {
      return NextResponse.json(
        { error: 'Model returned empty prompt. Please try again.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        prompt: generatedPrompt,
      },
    });
  } catch (error) {
    console.error('Generate simple genre prompt error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate prompt',
      },
      { status: 500 }
    );
  }
}
