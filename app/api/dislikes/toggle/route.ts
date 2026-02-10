import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { query } from '@/lib/db-query-builder';
import { ensureTrackReactionsSchema } from '@/lib/track-reactions-db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Please log in to dislike tracks'
        },
        { status: 401 }
      );
    }

    const { trackId } = await request.json();
    if (!trackId) {
      return NextResponse.json(
        { error: 'Track ID is required' },
        { status: 400 }
      );
    }

    await ensureTrackReactionsSchema();

    const result = await query(
      `UPDATE tracks
       SET is_disliked = NOT COALESCE(is_disliked, FALSE),
           is_liked = CASE WHEN NOT COALESCE(is_disliked, FALSE) THEN FALSE ELSE COALESCE(is_liked, FALSE) END,
           updated_at = NOW()
       WHERE id = $1::uuid
         AND music_id IN (
           SELECT id FROM music WHERE user_id = $2::uuid
         )
         AND (is_deleted IS NULL OR is_deleted = FALSE)
       RETURNING COALESCE(is_disliked, FALSE) as is_disliked,
                 COALESCE(is_liked, FALSE) as is_liked`,
      [trackId, userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Track not found or access denied' },
        { status: 404 }
      );
    }

    const isDisliked = Boolean(result.rows[0].is_disliked);
    const isLiked = Boolean(result.rows[0].is_liked);

    return NextResponse.json({
      success: true,
      isDisliked,
      isLiked,
      message: isDisliked ? 'Track disliked' : 'Track undisliked'
    });
  } catch (error) {
    console.error('Toggle dislike error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error occurred while toggling dislike',
        success: false
      },
      { status: 500 }
    );
  }
}
