import { NextRequest, NextResponse } from 'next/server';
import {
  getUserVocalSeparationHistory,
  type VocalSeparationHistorySourceFilter,
} from '@/features/vocal-tools/lib/vocal-separation-history-db';
import { getUserIdFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const parseStemsData = (value: unknown): Record<string, string> | null => {
  if (!value) return null;
  if (typeof value === 'object') return value as Record<string, string>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : null;
    } catch {
      return null;
    }
  }
  return null;
};

const resolveOriginUrlFromStems = (stemsData: Record<string, string> | null): string | undefined => {
  if (!stemsData) return undefined;
  const candidateKeys = ['origin', 'original', 'source', 'audio', 'originUrl', 'originalUrl'];
  for (const key of candidateKeys) {
    const value = stemsData[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
};

const toNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const normalizeUnifiedStatus = (
  rawStatus: unknown,
  context: { hasOutput: boolean; hasError: boolean }
): 'processing' | 'completed' | 'error' => {
  const status = typeof rawStatus === 'string' ? rawStatus.trim().toLowerCase() : '';
  if (status === 'completed' || status === 'complete' || status === 'success' || status === 'succeeded' || status === 'done') {
    return 'completed';
  }

  if (status === 'error' || status === 'failed' || status === 'fail' || status === 'failure' || status === 'canceled' || status === 'cancelled') {
    return 'error';
  }

  if (context.hasError) return 'error';
  if (context.hasOutput) return 'completed';
  return 'processing';
};

const parseSourceFilter = (value: string | null): VocalSeparationHistorySourceFilter => {
  if (value === 'replicate' || value === 'kie') return value;
  return 'all';
};

/**
 * 统一获取用户的所有人声分离记录（包括两种来源）
 * GET /api/vocal/separation-unified?source=all|replicate|kie&limit=20&offset=0
 */
export async function GET(request: NextRequest) {
  const requestId = `unified-separations_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[UNIFIED-SEPARATIONS-${requestId}] Getting unified vocal separations`);

  try {
    // 检查用户是否登录
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      console.log(`[UNIFIED-SEPARATIONS-${requestId}] Authentication failed - no userId`);
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Please log in to view vocal separations'
        },
        { status: 401 }
      );
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sourceFilter = parseSourceFilter(searchParams.get('source'));
    const effectiveSourceFilter: VocalSeparationHistorySourceFilter = sourceFilter === 'all' ? 'kie' : sourceFilter;

    if (sourceFilter === 'replicate') {
      return NextResponse.json(
        {
          error: 'Unsupported source',
          message: 'Replicate separation is one-time only and does not provide history records.',
        },
        { status: 400 }
      );
    }

    console.log(
      `[UNIFIED-SEPARATIONS-${requestId}] Querying unified separations for user: ${userId}, source: ${effectiveSourceFilter}, limit: ${limit}, offset: ${offset}`
    );

    const { rows, total } = await getUserVocalSeparationHistory(userId, effectiveSourceFilter, limit, offset);

    const paginatedSeparations = rows.map((row: any) => {
      const stemsData = parseStemsData(row.stems_data);
      const vocalUrl = toNonEmptyString(row.vocal_url);
      const instrumentalUrl = toNonEmptyString(row.instrumental_url);
      const originalAudioUrl =
        toNonEmptyString(row.original_audio_url) ||
        toNonEmptyString(row.track_audio_url) ||
        resolveOriginUrlFromStems(stemsData);
      const errorCode =
        typeof row.error_code === 'string' || typeof row.error_code === 'number'
          ? String(row.error_code)
          : undefined;
      const errorMessage = typeof row.error_message === 'string' ? row.error_message : undefined;

      const status = normalizeUnifiedStatus(row.status, {
        hasOutput: Boolean(originalAudioUrl || vocalUrl || instrumentalUrl),
        hasError: Boolean(errorCode || errorMessage),
      });

      const source = row.source === 'kie' ? 'kie' : 'replicate';
      const originalFilename =
        source === 'kie'
          ? (typeof row.resolved_title === 'string' && row.resolved_title.trim().length > 0
              ? row.resolved_title.trim()
              : typeof row.track_id === 'string' && row.track_id.length > 0
                ? `Track ${row.track_id.substring(0, 8)}...`
                : 'Studio Track')
          : (typeof row.original_filename === 'string' && row.original_filename.trim().length > 0
              ? row.original_filename.trim()
              : 'Uploaded Audio');

      return {
        id: typeof row.id === 'string' ? row.id : '',
        source,
        predictionId: source === 'replicate' ? row.prediction_id : row.task_id,
        separationType:
          typeof row.separation_type === 'string' && row.separation_type.trim().length > 0
            ? row.separation_type
            : 'separate_vocal',
        status,
        originalFilename,
        originalAudioUrl,
        vocalUrl,
        instrumentalUrl,
        stemsData,
        errorCode,
        errorMessage: errorMessage || (status === 'error' ? 'Vocal removal failed' : undefined),
        createdAt: typeof row.created_at === 'string' ? row.created_at : '',
        updatedAt:
          typeof row.updated_at === 'string'
            ? row.updated_at
            : typeof row.created_at === 'string'
              ? row.created_at
              : '',
        accompanimentUrl: instrumentalUrl,
        hasPersistentAudio: Boolean(row.has_persistent_audio),
        trackId: typeof row.track_id === 'string' ? row.track_id : undefined,
        taskId: source === 'kie' ? row.task_id : undefined,
      };
    }).filter((record) => Boolean(record.id));

    console.log(
      `[UNIFIED-SEPARATIONS-${requestId}] Found ${total} total separations, returning ${paginatedSeparations.length}`
    );

    return NextResponse.json({
      success: true,
      data: paginatedSeparations,
      source: effectiveSourceFilter,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    console.error(`[UNIFIED-SEPARATIONS-${requestId}] Unexpected error:`, error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}
