import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { trackId: string } }
) {
  try {
    const { trackId } = params;

    if (!trackId) {
      return NextResponse.json(
        { success: false, error: 'Track ID is required' },
        { status: 400 }
      );
    }

    // 软删除：将is_deleted设置为true
    await query(`
      UPDATE music_tracks 
      SET is_deleted = TRUE, updated_at = NOW()
      WHERE id = $1
    `, [trackId]);

    return NextResponse.json({ 
      success: true, 
      message: 'Track deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting track:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete track' },
      { status: 500 }
    );
  }
}
