import { NextRequest, NextResponse } from 'next/server';

import { getUserIdFromRequest } from '@/lib/auth';
import { query } from '@/lib/db-query-builder';

export const dynamic = 'force-dynamic';

type StoredLyricsItem = {
  title: string | null;
  text: string;
};

function parseStoredLyrics(rawContent: string | null): StoredLyricsItem[] {
  const content = typeof rawContent === 'string' ? rawContent.trim() : '';
  if (!content) {
    return [];
  }

  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      return [{ title: null, text: content }];
    }

    return parsed
      .map((item: any) => {
        const text = typeof item?.text === 'string' ? item.text.trim() : '';
        if (!text) return null;
        const title = typeof item?.title === 'string' ? item.title.trim() : '';
        return {
          title: title || null,
          text,
        };
      })
      .filter((item: StoredLyricsItem | null): item is StoredLyricsItem => item !== null);
  } catch {
    return [{ title: null, text: content }];
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          message: 'Please log in to delete lyrics results',
        },
        { status: 401 }
      );
    }

    const { taskId } = await params;
    if (!taskId) {
      return NextResponse.json(
        { success: false, error: 'taskId is required' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const rawLyricsIndex = searchParams.get('lyricsIndex');
    const hasLyricsIndex = rawLyricsIndex !== null && rawLyricsIndex.trim() !== '';

    if (hasLyricsIndex) {
      const lyricsIndex = Number.parseInt(rawLyricsIndex!, 10);
      if (!Number.isInteger(lyricsIndex) || lyricsIndex < 0) {
        return NextResponse.json(
          { success: false, error: 'lyricsIndex must be a non-negative integer' },
          { status: 400 }
        );
      }

      const generationResult = await query(
        `SELECT id, content
         FROM lyrics_generations
         WHERE task_id = $1
           AND user_id = $2::uuid
           AND (is_deleted IS NULL OR is_deleted = FALSE)
         LIMIT 1`,
        [taskId, userId]
      );

      if ((generationResult.rowCount ?? 0) === 0) {
        return NextResponse.json(
          { success: false, error: 'Lyrics result not found or already deleted' },
          { status: 404 }
        );
      }

      const generation = generationResult.rows[0];
      const lyricsItems = parseStoredLyrics(generation?.content as string | null);

      if (lyricsIndex >= lyricsItems.length) {
        return NextResponse.json(
          { success: false, error: 'Lyrics item not found' },
          { status: 404 }
        );
      }

      const remainingLyrics = lyricsItems.filter((_, index) => index !== lyricsIndex);

      if (remainingLyrics.length === 0) {
        const deleteResult = await query(
          `UPDATE lyrics_generations
           SET is_deleted = TRUE, updated_at = NOW()
           WHERE id = $1::uuid
             AND user_id = $2::uuid
             AND (is_deleted IS NULL OR is_deleted = FALSE)
           RETURNING id`,
          [generation.id, userId]
        );

        if ((deleteResult.rowCount ?? 0) === 0) {
          return NextResponse.json(
            { success: false, error: 'Lyrics result not found or already deleted' },
            { status: 404 }
          );
        }
      } else {
        const nextTitle = remainingLyrics[0]?.title?.trim() || null;
        const updateResult = await query(
          `UPDATE lyrics_generations
           SET title = $1, content = $2, updated_at = NOW()
           WHERE id = $3::uuid
             AND user_id = $4::uuid
             AND (is_deleted IS NULL OR is_deleted = FALSE)
           RETURNING id`,
          [nextTitle, JSON.stringify(remainingLyrics), generation.id, userId]
        );

        if ((updateResult.rowCount ?? 0) === 0) {
          return NextResponse.json(
            { success: false, error: 'Lyrics result not found or already deleted' },
            { status: 404 }
          );
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Lyrics item deleted successfully',
      });
    }

    const result = await query(
      `UPDATE lyrics_generations
       SET is_deleted = TRUE, updated_at = NOW()
       WHERE task_id = $1
         AND user_id = $2::uuid
         AND (is_deleted IS NULL OR is_deleted = FALSE)
       RETURNING id`,
      [taskId, userId]
    );

    if ((result.rowCount ?? 0) === 0) {
      return NextResponse.json(
        { success: false, error: 'Lyrics result not found or already deleted' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Lyrics result deleted successfully',
    });
  } catch (error) {
    console.error('[DELETE-LYRICS-GENERATION] Failed to delete lyrics generation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete lyrics result' },
      { status: 500 }
    );
  }
}
