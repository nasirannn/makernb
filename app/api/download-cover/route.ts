import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-query-builder';
import { getUserIdFromRequest } from '@/lib/auth';
import { hasFeaturePermission } from '@/lib/feature-permissions';

// 强制动态渲染
export const dynamic = 'force-dynamic';

/**
 * 下载封面图片
 * 通过 API 代理下载，避免 CORS 问题
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

    // 获取 trackId 参数
    const searchParams = request.nextUrl.searchParams;
    const trackId = searchParams.get('trackId');
    const purpose = searchParams.get('purpose');

    if (!trackId) {
      return NextResponse.json(
        { error: 'Track ID is required' },
        { status: 400 }
      );
    }

    if (purpose !== 'edit') {
      const hasCoverPermission = await hasFeaturePermission(userId, 'download_cover_track');

      if (!hasCoverPermission) {
        return NextResponse.json(
          {
            error: 'Feature not available',
            message: 'Cover download is not included in your current subscription plan.'
          },
          { status: 403 }
        );
      }
    }

    // 查询 track 信息，获取封面 URL
    const trackResult = await query(
      `SELECT
        mt.id as track_id,
        COALESCE(mt.title, mg.title) as title,
        mg.user_id,
        mt.cover_image_url as track_cover_image_url
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

    // 检查用户是否有权限访问这个 track
    if (track.user_id !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 获取封面 URL：只从 tracks.cover_image_url 读取
    const coverUrl = track.track_cover_image_url;

    if (!coverUrl) {
      return NextResponse.json(
        { error: 'Cover image not available' },
        { status: 404 }
      );
    }

    // 代理下载封面：不做类型校验，强制以附件形式下载，文件名固定为 .png
    const coverResponse = await fetch(coverUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MakernbBot/1.0)',
      },
      cache: 'no-store',
    });

    if (!coverResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch cover image' },
        { status: 502 }
      );
    }

    const buffer = await coverResponse.arrayBuffer();
    // 保留源图片类型与扩展名
    const sourceContentType = coverResponse.headers.get('content-type') || '';
    const lowerType = sourceContentType.toLowerCase();
    const isImageType = lowerType.startsWith('image/');
    let ext = 'bin';
    if (lowerType.includes('jpeg') || lowerType.includes('jpg')) {
      ext = 'jpg';
    } else if (lowerType.includes('png')) {
      ext = 'png';
    } else if (lowerType.includes('webp')) {
      ext = 'webp';
    } else if (lowerType.includes('gif')) {
      ext = 'gif';
    } else if (lowerType.includes('bmp')) {
      ext = 'bmp';
    } else if (lowerType.includes('tiff')) {
      ext = 'tiff';
    }
    const filename = `${encodeURIComponent(track.title || 'cover')}.${ext}`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': isImageType ? lowerType : 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.byteLength.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('[DOWNLOAD-COVER] Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}
