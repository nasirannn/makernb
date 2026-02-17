import { NextRequest, NextResponse } from 'next/server';
import { getUserVocalSeparations } from '@/features/vocal-tools/lib/vocal-separation-db';
import { getUserVocalRemovals } from '@/features/vocal-tools/lib/vocal-removal-db';
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

/**
 * 统一获取用户的所有人声分离记录（包括两种来源）
 * GET /api/vocal/separation-unified?limit=20&offset=0
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

    console.log(`[UNIFIED-SEPARATIONS-${requestId}] Querying unified separations for user: ${userId}, limit: ${limit}, offset: ${offset}`);

    // 并行获取两种来源的数据
    const [replicateSeparations, kieRemovals] = await Promise.all([
      getUserVocalSeparations(userId, limit * 2, 0), // 获取更多以便合并排序
      getUserVocalRemovals(userId, limit * 2, 0)
    ]);

    // 统一数据格式
    const unifiedSeparations = [
      // Replicate API 来源
      ...replicateSeparations.map((sep: any) => ({
        id: sep.id,
        source: 'replicate' as const,
        predictionId: sep.predictionId || sep.prediction_id, // 映射数据库字段为 JavaScript 字段名
        status: sep.status,
        originalFilename: sep.originalFilename || sep.original_filename, // 映射数据库字段为 JavaScript 字段名
        vocalUrl: sep.vocalUrl || sep.vocal_audio_url, // 映射数据库字段为 JavaScript 字段名
        instrumentalUrl: sep.instrumentalUrl || sep.instrumental_audio_url, // 映射数据库字段为 JavaScript 字段名
        errorMessage: sep.errorMessage,
        createdAt: sep.createdAt || sep.created_at, // 映射数据库字段为 JavaScript 字段名
        updatedAt: sep.updatedAt || sep.updated_at, // 映射数据库字段为 JavaScript 字段名
        // 兼容字段
        accompanimentUrl: sep.instrumentalUrl || sep.instrumental_audio_url,
        trackId: undefined,
        taskId: undefined
      })),
      // KIE API 来源
      ...kieRemovals.map(removal => {
        // 优先使用 R2 URL，如果没有则使用临时 URL
        const vocalUrl = removal.r2_vocal_url || removal.vocal_url;
        const instrumentalUrl = removal.r2_instrumental_url || removal.instrumental_url;
        const stemsData = parseStemsData(removal.stems_data);
        
        return {
          id: removal.id,
          source: 'kie' as const,
          predictionId: removal.task_id, // 映射数据库字段为 JavaScript 字段名
          separationType: removal.separation_type || 'separate_vocal',
          status: removal.status,
          originalFilename: removal.track_id ? `Track ${removal.track_id.substring(0, 8)}...` : 'Studio Track',
          vocalUrl, // 映射数据库字段为 JavaScript 字段名
          instrumentalUrl, // 映射数据库字段为 JavaScript 字段名
          stemsData,
          errorMessage: removal.status === 'error' ? 'Vocal removal failed' : undefined,
          createdAt: removal.created_at, // 映射数据库字段为 JavaScript 字段名
          updatedAt: removal.updated_at, // 映射数据库字段为 JavaScript 字段名
          // KIE 特有字段（保持向后兼容）
          accompanimentUrl: instrumentalUrl,
          trackId: removal.track_id, // 映射数据库字段为 JavaScript 字段名
          taskId: removal.task_id // 映射数据库字段为 JavaScript 字段名
        };
      })
    ];

    // 按创建时间排序（最新的在前）
    unifiedSeparations.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // 分页处理
    const paginatedSeparations = unifiedSeparations.slice(offset, offset + limit);

    console.log(`[UNIFIED-SEPARATIONS-${requestId}] Found ${unifiedSeparations.length} total separations, returning ${paginatedSeparations.length}`);

    return NextResponse.json({
      success: true,
      data: paginatedSeparations,
      pagination: {
        limit,
        offset,
        total: unifiedSeparations.length,
        hasMore: offset + limit < unifiedSeparations.length
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
