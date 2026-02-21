import { NextRequest, NextResponse } from 'next/server';

import { getUserIdFromRequest } from '@/lib/auth';
import { query } from '@/lib/db-query-builder';

export const dynamic = 'force-dynamic';

type LyricsItem = {
  title: string | null;
  text: string;
};

function parseLyricsContent(rawContent: string | null, fallbackTitle: string | null): LyricsItem[] {
  const content = typeof rawContent === 'string' ? rawContent.trim() : '';
  if (!content) {
    return [];
  }

  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      return [{ title: fallbackTitle, text: content }];
    }

    return parsed
      .map((item: any) => {
        const text = typeof item?.text === 'string' ? item.text.trim() : '';
        if (!text) return null;
        const title = typeof item?.title === 'string' ? item.title.trim() : '';
        return {
          title: title || fallbackTitle,
          text,
        };
      })
      .filter((item: LyricsItem | null): item is LyricsItem => item !== null);
  } catch {
    return [{ title: fallbackTitle, text: content }];
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          message: 'Please log in to view lyrics results',
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const rawLimit = Number.parseInt(searchParams.get('limit') || '20', 10);
    const rawOffset = Number.parseInt(searchParams.get('offset') || '0', 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 20;
    const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;

    const result = await query(
      `SELECT lg.*, 
              ge_latest.error_message AS error_message
       FROM lyrics_generations lg
       LEFT JOIN LATERAL (
         SELECT ge.error_message
         FROM generation_errors ge
         WHERE ge.error_type = 'lyrics_generation'
           AND ge.reference_id::text = lg.id::text
         ORDER BY ge.created_at DESC
         LIMIT 1
       ) ge_latest ON TRUE
       WHERE lg.user_id = $1::uuid
         AND (lg.is_deleted IS NULL OR lg.is_deleted = FALSE)
         AND lg.content IS NOT NULL
         AND BTRIM(lg.content) <> ''
       ORDER BY lg.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const items = result.rows.map((row: any) => {
      const title = typeof row.title === 'string' ? row.title : null;
      return {
        taskId: row.task_id as string,
        title,
        userPrompt: typeof row.user_prompt === 'string' ? row.user_prompt : null,
        status: row.status as string,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
        errorMessage: typeof row.error_message === 'string' ? row.error_message : null,
        lyrics: parseLyricsContent(row.content as string | null, title),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        items,
        pagination: {
          limit,
          offset,
          count: items.length,
        },
      },
    });
  } catch (error) {
    console.error('[GET-LYRICS-GENERATIONS] Failed to fetch lyrics generations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch lyrics results' },
      { status: 500 }
    );
  }
}
