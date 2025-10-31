import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-query-builder';
import { getUserIdFromRequest } from '@/lib/auth';
import { hasFeaturePermission } from '@/lib/feature-permissions';

// 强制动态渲染
export const dynamic = 'force-dynamic';

/**
 * 下载音频文件
 * 需要检查用户是否有下载权限
 */
export async function GET(request: NextRequest) {
  try {
    // 获取用户ID
    const userId = await getUserIdFromRequest(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 获取 trackId 和 format 参数
    const searchParams = request.nextUrl.searchParams;
    const trackId = searchParams.get('trackId');
    const format = searchParams.get('format') || 'mp3'; // 默认 mp3

    // 验证格式参数
    if (format !== 'mp3' && format !== 'wav') {
      return NextResponse.json(
        { error: 'Invalid format. Supported formats: mp3, wav' },
        { status: 400 }
      );
    }

    if (!trackId) {
      return NextResponse.json(
        { error: 'Track ID is required' },
        { status: 400 }
      );
    }

    // 检查用户是否有下载权限（根据格式检查对应的权限）
    const featureCode = format === 'wav' ? 'download_wav_track' : 'download_mp3_track';
    const hasPermission = await hasFeaturePermission(userId, featureCode);
    
    if (!hasPermission) {
      return NextResponse.json(
        { 
          error: 'Feature not available',
          message: `${format.toUpperCase()} download feature is not available for your subscription tier. Please upgrade to access this feature.`
        },
        { status: 403 }
      );
    }

    // 查询 track 信息
    const trackResult = await query(
      `SELECT 
        mt.id as track_id,
        mt.audio_url,
        COALESCE(mt.title, mg.title) as title,
        mg.user_id
      FROM tracks mt
      INNER JOIN music mg ON mt.music_id = mg.id
      WHERE mt.id = $1::uuid
        AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)`,
      [trackId]
    );

    if (trackResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 }
      );
    }

    const track = trackResult.rows[0];

    // 检查音频URL是否存在
    if (!track.audio_url) {
      return NextResponse.json(
        { error: 'Audio file not available' },
        { status: 404 }
      );
    }

    // 获取音频文件（代理下载）
    try {
      const audioResponse = await fetch(track.audio_url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MakernbBot/1.0)',
        },
      });

      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
      }

      // 获取音频数据
      const audioBuffer = await audioResponse.arrayBuffer();
      
      // 根据格式设置 content-type 和文件名
      const contentType = format === 'wav' 
        ? 'audio/wav' 
        : (audioResponse.headers.get('content-type') || 'audio/mpeg');
      const fileExtension = format;

      // 返回音频文件
      return new NextResponse(audioBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${encodeURIComponent(track.title || 'track')}.${fileExtension}"`,
          'Content-Length': audioBuffer.byteLength.toString(),
        },
      });

    } catch (fetchError) {
      console.error('[DOWNLOAD-TRACK] Error fetching audio:', fetchError);
      
      // 如果代理下载失败，返回原始URL（让前端直接下载）
      return NextResponse.json(
        { 
          error: 'Download proxy failed',
          audioUrl: track.audio_url,
          fallback: true
        },
        { status: 200 }
      );
    }

  } catch (error) {
    console.error('[DOWNLOAD-TRACK] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to download track',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

