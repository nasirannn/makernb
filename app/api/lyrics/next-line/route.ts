import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

import { getUserIdFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MAX_LYRICS_LENGTH = 5000;
const NEXT_LINE_SYSTEM_PROMPT = [
  'You are a lyrics generation assistant.',
  'You must continue from the existing lyrics and generate exactly one next lyric line.',
  'Return only one line of lyrics text.',
  'Do not include tags, section labels, explanations, numbering, or quotes.',
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

const sanitizeSingleLine = (value: string): string => {
  const singleLine = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? '';

  return singleLine.replace(/^["“”'`]+|["“”'`]+$/g, '').trim();
};

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Please log in to write the next lyric line',
        },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const lyrics = typeof body?.lyrics === 'string' ? body.lyrics : '';
    const trimmedLyrics = lyrics.trim();

    if (!trimmedLyrics) {
      return NextResponse.json(
        { error: 'Please provide existing lyrics first' },
        { status: 400 }
      );
    }

    if (trimmedLyrics.length > MAX_LYRICS_LENGTH) {
      return NextResponse.json(
        { error: `Lyrics must be ${MAX_LYRICS_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    const replicateToken = process.env.REPLICATE_API_TOKEN;

    if (!replicateToken) {
      return NextResponse.json(
        { error: 'Replicate API token is not configured' },
        { status: 500 }
      );
    }

    const replicate = new Replicate({ auth: replicateToken });
    const prompt = [
      'Existing lyrics:',
      trimmedLyrics,
      '',
      'Write the next lyric line only. Output exactly one line.',
    ].join('\n');

    const output = await replicate.run('openai/gpt-4o-mini', {
      input: {
        prompt,
        system_prompt: NEXT_LINE_SYSTEM_PROMPT,
      },
    });

    const generatedLine = sanitizeSingleLine(normalizeReplicateOutput(output));

    if (!generatedLine) {
      return NextResponse.json(
        { error: 'Model returned empty content. Please try again.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        line: generatedLine,
      },
    });
  } catch (error) {
    console.error('Write next lyric line error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to write next lyric line',
      },
      { status: 500 }
    );
  }
}
