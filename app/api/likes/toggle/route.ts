import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { query } from '@/lib/db-query-builder';

export const dynamic = 'force-dynamic';

let likedColumnEnsurePromise: Promise<void> | null = null;
const ensureLikedColumn = async () => {
  if (!likedColumnEnsurePromise) {
    likedColumnEnsurePromise = query(`
      ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS is_liked BOOLEAN NOT NULL DEFAULT FALSE
    `).then(() => undefined);
  }
  await likedColumnEnsurePromise;
};

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Please log in to like tracks'
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

    await ensureLikedColumn();

    const result = await query(
      `UPDATE tracks
       SET is_liked = NOT COALESCE(is_liked, FALSE),
           updated_at = NOW()
       WHERE id = $1::uuid
         AND music_id IN (
           SELECT id FROM music WHERE user_id = $2::uuid
         )
         AND (is_deleted IS NULL OR is_deleted = FALSE)
       RETURNING COALESCE(is_liked, FALSE) as is_liked`,
      [trackId, userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Track not found or access denied' },
        { status: 404 }
      );
    }

    const isLiked = Boolean(result.rows[0].is_liked);

    return NextResponse.json({
      success: true,
      isLiked,
      message: isLiked ? 'Track liked' : 'Track unliked'
    });
  } catch (error) {
    console.error('Toggle like error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error occurred while toggling like',
        success: false
      },
      { status: 500 }
    );
  }
}
