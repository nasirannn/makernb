import { NextRequest, NextResponse } from 'next/server';
import { hardDeleteMusicGeneration } from '@/lib/track-delete';
import { getUserIdFromRequest } from '@/lib/auth';

// 强制动态渲染
export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  try {
    // 检查用户是否登录
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { 
          error: 'Authentication required',
          message: 'Please log in to delete music generation'
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const generationId = searchParams.get('id');

    console.log('Delete API called with generationId:', generationId, 'userId:', userId);

    if (!generationId) {
      return NextResponse.json(
        { error: 'Generation ID is required' },
        { status: 400 }
      );
    }

    const deleted = await hardDeleteMusicGeneration(generationId, userId);

    if (!deleted.success) {
      return NextResponse.json(
        {
          error: deleted.error || 'Generation not found or already deleted',
          success: false,
        },
        { status: deleted.statusCode || 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Music generation deleted successfully'
    });

  } catch (error) {
    console.error('Delete music generation error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error occurred during deletion',
        success: false 
      },
      { status: 500 }
    );
  }
}
