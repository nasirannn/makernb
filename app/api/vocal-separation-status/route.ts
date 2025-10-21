import { NextRequest, NextResponse } from 'next/server';
import { getVocalSeparationByPredictionId } from '@/lib/vocal-separation-db';
import { getUserIdFromRequest } from '@/lib/auth-utils-optimized';

export async function GET(request: NextRequest) {
  const requestId = `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[VOCAL-SEPARATION-STATUS-${requestId}] Checking vocal separation status`);

  try {
    // 检查用户是否登录
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      console.log(`[VOCAL-SEPARATION-STATUS-${requestId}] Authentication failed - no userId`);
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Please log in to check vocal separation status'
        },
        { status: 401 }
      );
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const predictionId = searchParams.get('predictionId');
    const separationId = searchParams.get('separationId');

    if (!predictionId && !separationId) {
      return NextResponse.json(
        {
          error: 'Missing parameters',
          message: 'Either predictionId or separationId is required'
        },
        { status: 400 }
      );
    }

    let separationRecord;

    if (predictionId) {
      // 通过predictionId查询
      console.log(`[VOCAL-SEPARATION-STATUS-${requestId}] Querying by predictionId: ${predictionId}`);
      separationRecord = await getVocalSeparationByPredictionId(predictionId);
    } else if (separationId) {
      // 通过separationId查询（需要验证用户权限）
      console.log(`[VOCAL-SEPARATION-STATUS-${requestId}] Querying by separationId: ${separationId}`);
      // 这里需要实现通过separationId查询的方法
      // 暂时返回错误，提示使用predictionId
      return NextResponse.json(
        {
          error: 'Not implemented',
          message: 'Please use predictionId parameter for now'
        },
        { status: 501 }
      );
    }

    if (!separationRecord) {
      console.log(`[VOCAL-SEPARATION-STATUS-${requestId}] No separation record found`);
      return NextResponse.json(
        {
          error: 'Not found',
          message: 'Vocal separation record not found'
        },
        { status: 404 }
      );
    }

    // 验证用户权限
    if (separationRecord.user_id !== userId) {
      console.log(`[VOCAL-SEPARATION-STATUS-${requestId}] Access denied for user: ${userId}`);
      return NextResponse.json(
        {
          error: 'Access denied',
          message: 'You do not have permission to access this vocal separation'
        },
        { status: 403 }
      );
    }

    console.log(`[VOCAL-SEPARATION-STATUS-${requestId}] Found separation record:`, {
      id: separationRecord.id,
      status: separationRecord.status,
      hasVocalUrl: !!separationRecord.vocal_audio_url,
      hasInstrumentalUrl: !!separationRecord.instrumental_audio_url,
    });

    // 构建响应数据
    const responseData: any = {
      id: separationRecord.id,
      predictionId: separationRecord.prediction_id,
      status: separationRecord.status,
      originalFilename: separationRecord.original_filename,
      originalAudioUrl: separationRecord.original_audio_url, // 始终返回原始音频URL
      createdAt: separationRecord.created_at,
      updatedAt: separationRecord.updated_at
    };

    // 根据分离类型和状态添加相应的URL
    if (separationRecord.status === 'completed') {
      if (separationRecord.vocal_audio_url) responseData.vocalUrl = separationRecord.vocal_audio_url;
      if (separationRecord.instrumental_audio_url) responseData.instrumentalUrl = separationRecord.instrumental_audio_url;
    }

    return NextResponse.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error(`[VOCAL-SEPARATION-STATUS-${requestId}] Unexpected error:`, error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}
