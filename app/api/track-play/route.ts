import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-query-builder';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const trackId = body?.trackId as string | undefined;

    if (!trackId) {
      return NextResponse.json({ error: 'Track ID is required' }, { status: 400 });
    }

    const result = await query(
      `UPDATE tracks
       SET play_count = COALESCE(play_count, 0) + 1,
           updated_at = NOW()
       WHERE id = $1::uuid
         AND (is_deleted IS NULL OR is_deleted = FALSE)
       RETURNING play_count`,
      [trackId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, playCount: result.rows[0].play_count });
  } catch (error) {
    console.error('Track play count error:', error);
    return NextResponse.json({ error: 'Failed to increment play count' }, { status: 500 });
  }
}
