import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, isAdmin } from '@/lib/auth-utils';
import { toggleTrackPin } from '@/lib/tracks-db';

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

    // 检查是否为管理员
    if (!isAdmin(userId)) {
      return NextResponse.json(
        { 
          error: 'Access denied',
          message: 'Only administrators can pin tracks'
        },
        { status: 403 }
      );
    }

    const { trackId } = await request.json();

    if (!trackId) {
      return NextResponse.json(
        { error: 'Track ID is required' },
        { status: 400 }
      );
    }

    console.log('Toggle pin for track:', trackId, 'by admin:', userId);
    
    const isPinned = await toggleTrackPin(trackId);
    console.log('Track pin status after toggle:', isPinned);

    return NextResponse.json({
      success: true,
      isPinned,
      message: isPinned ? 'Track pinned successfully' : 'Track unpinned successfully'
    });

  } catch (error) {
    console.error('Toggle track pin error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error occurred while toggling pin',
        success: false 
      },
      { status: 500 }
    );
  }
}
