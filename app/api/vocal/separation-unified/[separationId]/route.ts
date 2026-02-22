import { NextRequest, NextResponse } from 'next/server';
import {
  deleteUserVocalSeparationHistoryRecord,
  type VocalSeparationHistorySource,
} from '@/features/vocal-tools/lib/vocal-separation-history-db';
import { getUserIdFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const parseSource = (value: string | null): VocalSeparationHistorySource | null => {
  if (value === 'replicate' || value === 'kie') return value;
  return null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * 统一删除人声分离记录（逻辑删除）
 * DELETE /api/vocal/separation-unified/:separationId?source=replicate|kie
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ separationId: string }> }
) {
  const requestId = `delete-unified-separation_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const { separationId } = await params;

  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Please log in to delete vocal separations',
        },
        { status: 401 }
      );
    }

    if (!separationId) {
      return NextResponse.json(
        {
          error: 'Missing separation ID',
          message: 'Separation ID is required',
        },
        { status: 400 }
      );
    }
    if (!UUID_REGEX.test(separationId)) {
      return NextResponse.json(
        {
          error: 'Invalid separation ID',
          message: 'Separation ID must be a valid UUID',
        },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const source = parseSource(searchParams.get('source'));

    if (!source) {
      return NextResponse.json(
        {
          error: 'Missing source',
          message: 'source must be either "replicate" or "kie"',
        },
        { status: 400 }
      );
    }

    const deleted = await deleteUserVocalSeparationHistoryRecord(userId, source, separationId);

    if (!deleted) {
      return NextResponse.json(
        {
          error: 'Not found',
          message: 'Vocal separation not found or already deleted',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      source,
      id: separationId,
      message: 'Vocal separation deleted successfully',
    });
  } catch (error) {
    console.error(`[DELETE-UNIFIED-SEPARATION-${requestId}] Unexpected error:`, error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
