import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth-utils-optimized';
import { togglePinned } from '@/lib/pinned-tracks-db';

// 强制动态渲染
export const dynamic = 'force-dynamic';

// 切换置顶状态
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { 
          error: 'Authentication required',
          message: 'Please log in to pin tracks'
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

    console.log('Toggle pinned for track:', trackId, 'by user:', userId);
    
    const isPinned = await togglePinned(userId, trackId);
    console.log('Track pinned status after toggle:', isPinned);

    return NextResponse.json({
      success: true,
      isPinned,
      message: isPinned ? 'Track pinned successfully' : 'Track unpinned successfully'
    });

  } catch (error) {
    console.error('Toggle pinned error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error occurred while toggling pinned',
        success: false 
      },
      { status: 500 }
    );
  }
}
