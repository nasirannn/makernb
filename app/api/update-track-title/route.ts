import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-query-builder';
import { getUserIdFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { 
          error: 'Authentication required',
          message: 'Please log in to update track title'
        },
        { status: 401 }
      );
    }

    const { trackId, title } = await request.json();

    if (!trackId || !title) {
      return NextResponse.json(
        { error: 'Track ID and title are required' },
        { status: 400 }
      );
    }

    // Validate title length
    if (title.length > 200) {
      return NextResponse.json(
        { error: 'Title must be 200 characters or less' },
        { status: 400 }
      );
    }

    // Check if track exists and belongs to user
    const trackCheck = await query(
      `SELECT music_id FROM tracks 
       WHERE id = $1 
       AND music_id IN (SELECT id FROM music WHERE user_id = $2::uuid)
       AND (is_deleted IS NULL OR is_deleted = FALSE)`,
      [trackId, userId]
    );

    if (trackCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Track not found or access denied' },
        { status: 404 }
      );
    }

    // Update the track title (not music title)
    await query(
      `UPDATE tracks 
       SET title = $1, updated_at = NOW()
       WHERE id = $2`,
      [title, trackId]
    );

    return NextResponse.json({
      success: true,
      message: 'Track title updated successfully'
    });

  } catch (error) {
    console.error('Update track title error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error occurred while updating track title',
        success: false 
      },
      { status: 500 }
    );
  }
}
