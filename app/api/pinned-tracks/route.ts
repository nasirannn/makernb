import { NextRequest, NextResponse } from 'next/server';
import { getPinnedTracks } from '@/lib/tracks-db';

// 强制动态渲染
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    console.log('Fetching pinned tracks with limit:', limit, 'offset:', offset);
    
    const pinnedTracks = await getPinnedTracks();
    
    // 应用分页
    const paginatedTracks = pinnedTracks.slice(offset, offset + limit);
    const hasMore = offset + limit < pinnedTracks.length;

    console.log(`Found ${pinnedTracks.length} pinned tracks, returning ${paginatedTracks.length}`);

    return NextResponse.json({
      success: true,
      data: {
        tracks: paginatedTracks,
        count: pinnedTracks.length,
        limit,
        offset,
        hasMore
      }
    });

  } catch (error) {
    console.error('Error fetching pinned tracks:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error occurred while fetching pinned tracks',
        success: false 
      },
      { status: 500 }
    );
  }
}
