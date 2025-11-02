import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-query-builder';
import { getUserIdFromRequest } from '@/lib/auth';
import { hasFeaturePermission } from '@/lib/feature-permissions';
import { getTrackWavConversionByTrackId, getTrackWavConversionStatus } from '@/lib/track-wav-db';
import MusicApiService from '@/lib/music-api';

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
    // 统一使用 feature code 检查，与前端保持一致
    let hasPermission: boolean;
    
    if (format === 'wav') {
      // WAV 下载使用 feature code: download_wav_track
      const featureCode = 'download_wav_track';
      hasPermission = await hasFeaturePermission(userId, featureCode);
    } else {
      // MP3 下载使用 feature code: download_mp3_track
      const featureCode = 'download_mp3_track';
      hasPermission = await hasFeaturePermission(userId, featureCode);
    }
    
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
        mt.suno_track_id as audio_id,
        COALESCE(mt.title, mg.title) as title,
        mg.user_id,
        mg.task_id
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

    // 如果是 WAV 格式，需要先检查/生成 WAV
    if (format === 'wav') {
      // 检查是否有有效的 WAV 转换记录
      const wavStatus = await getTrackWavConversionStatus(trackId);
      
      if (wavStatus === 'none' || wavStatus === 'expired' || wavStatus === 'error') {
        // 没有 WAV 转换记录或已过期/失败，需要生成
        // 检查必需的字段
        if (!track.task_id || !track.audio_id) {
          return NextResponse.json(
            { 
              error: 'Cannot generate WAV',
              message: 'Track does not have required task ID or audio ID for WAV conversion'
            },
            { status: 400 }
          );
        }

        // 调用生成 WAV API
        try {
          const apiKey = process.env.KIE_API_KEY;
          if (!apiKey) {
            return NextResponse.json(
              { error: 'API key not configured' },
              { status: 500 }
            );
          }

          const musicApi = new MusicApiService(apiKey);
          const result = await musicApi.generateWavConversion({
            taskId: track.task_id,
            audioId: track.audio_id,
          });

          // 创建数据库记录
          const { createTrackWavConversion } = await import('@/lib/track-wav-db');
          await createTrackWavConversion({
            track_id: trackId,
            task_id: result.data.taskId,
            status: 'generating'
          });

          return NextResponse.json(
            {
              error: 'WAV generation started',
              message: 'WAV conversion has been started. Please try again in a few moments.',
              status: 'generating',
              taskId: result.data.taskId
            },
            { status: 202 } // 202 Accepted - 已接受处理请求，但尚未完成
          );
        } catch (error) {
          console.error('[DOWNLOAD-TRACK] Error generating WAV:', error);
          return NextResponse.json(
            {
              error: 'Failed to generate WAV',
              details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
          );
        }
      } else if (wavStatus === 'generating') {
        // WAV 正在生成中，返回详细状态信息以便前端显示进度
        const { getTrackWavConversionsByTrackId } = await import('@/lib/track-wav-db');
        const allConversions = await getTrackWavConversionsByTrackId(trackId);
        const latestConversion = allConversions.length > 0 ? allConversions[0] : null;
        
        return NextResponse.json(
          {
            error: 'WAV generation in progress',
            message: 'WAV conversion is in progress. Please try again in a few moments.',
            status: 'generating',
            hasWavUrl: !!latestConversion?.wav_url, // 是否有 wav_url（回调已收到）
            taskId: latestConversion?.task_id
          },
          { status: 202 }
        );
      } else if (wavStatus === 'complete') {
        // WAV 已生成，获取 WAV URL
        // 优先使用 R2 持久化 URL，如果没有则使用临时 URL
        const conversion = await getTrackWavConversionByTrackId(trackId);
        if (conversion) {
          // 优先使用 wav_r2_url（持久化链接），如果没有则使用 wav_url（临时链接）
          const wavUrl = conversion.wav_r2_url || conversion.wav_url;
          
          if (wavUrl) {
            // 使用 WAV URL 下载
            try {
              const wavResponse = await fetch(wavUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (compatible; MakernbBot/1.0)',
                },
              });

              if (!wavResponse.ok) {
                throw new Error(`Failed to fetch WAV: ${wavResponse.status}`);
              }

              const wavBuffer = await wavResponse.arrayBuffer();

              return new NextResponse(wavBuffer, {
                status: 200,
                headers: {
                  'Content-Type': 'audio/wav',
                  'Content-Disposition': `attachment; filename="${encodeURIComponent(track.title || 'track')}.wav"`,
                  'Content-Length': wavBuffer.byteLength.toString(),
                },
              });
            } catch (fetchError) {
              console.error('[DOWNLOAD-TRACK] Error fetching WAV:', fetchError);
              
              // 如果代理下载失败，返回原始 URL（让前端直接下载）
              return NextResponse.json(
                {
                  error: 'WAV download proxy failed',
                  wavUrl: wavUrl,
                  fallback: true
                },
                { status: 200 }
              );
            }
          }
        }
      }
    }

    // MP3 格式或 WAV 下载失败时的回退逻辑
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

