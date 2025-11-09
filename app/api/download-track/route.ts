import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-query-builder';
import { getUserIdFromRequest } from '@/lib/auth';
import { hasFeaturePermission } from '@/lib/feature-permissions';
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

    const trackRow = trackResult.rows[0];
    // 映射数据库字段为 JavaScript 字段名
    const track = {
      id: trackRow.track_id,
      audioUrl: trackRow.audio_url,
      audio_id: trackRow.audio_id,
      title: trackRow.title,
      user_id: trackRow.user_id,
      task_id: trackRow.task_id,
    };

    // 如果是 WAV 格式，需要生成 WAV
    // 注意：如果前端有 wav_r2_url，应该直接下载，不会调用这个 API
    // 所以这里只需要处理生成逻辑
    if (format === 'wav') {
      // 首先检查数据库中是否已经有 status = 'completed' 且 wav_r2_url 不为空的记录
      // 如果存在，直接返回下载链接
      let existingWavCheck;
      try {
        existingWavCheck = await query(
          `SELECT id, status, task_id, wav_r2_url
           FROM track_wav_conversions 
           WHERE track_id = $1::uuid 
             AND status = 'completed'
             AND (wav_r2_url IS NOT NULL AND wav_r2_url != '')
           ORDER BY created_at DESC
           LIMIT 1`,
          [trackId]
        );
      } catch (dbError) {
        console.error('[DOWNLOAD-TRACK] Error querying track_wav_conversions:', dbError);
        // 如果查询失败，继续走生成流程，不抛出异常
        existingWavCheck = { rows: [] };
      }

      if (existingWavCheck.rows.length > 0) {
        const existingWav = existingWavCheck.rows[0];
        
        // 如果 wav_r2_url 存在，直接返回下载
        if (existingWav.wav_r2_url) {
          try {
            const wavResponse = await fetch(existingWav.wav_r2_url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; MakernbBot/1.0)',
              },
              // 禁用缓存，避免 Next.js 尝试缓存超过 2MB 的文件
              cache: 'no-store',
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
            console.error('[DOWNLOAD-TRACK] Error fetching WAV from R2:', fetchError);
            // 如果下载失败，继续走生成流程
          }
        }
      }

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

      // 检查数据库中是否已经有 generating 状态的记录，避免重复生成
      const existingRecordCheck = await query(
        `SELECT id, status, task_id FROM track_wav_conversions 
         WHERE track_id = $1::uuid 
           AND status = 'generating'
         ORDER BY created_at DESC
         LIMIT 1`,
        [trackId]
      );

      if (existingRecordCheck.rows.length > 0) {
        // 如果已经有 generating 状态的记录，返回生成中状态，让前端轮询
        const existingRecord = existingRecordCheck.rows[0];
        return NextResponse.json(
          {
            error: 'WAV generation in progress',
            message: 'WAV conversion is already in progress. Please try again in a few moments.',
            status: 'generating',
            taskId: existingRecord.task_id || track.task_id
          },
          { status: 202 }
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

        // 创建或更新数据库记录（使用 upsert 避免重复键错误）
        const { upsertTrackWavConversion } = await import('@/lib/track-wav-db');
        await upsertTrackWavConversion({
          trackId: trackId, // 映射为 JavaScript 字段名
          taskId: result.data.taskId, // 映射为 JavaScript 字段名
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
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // 检查是否是 409 错误（Wav record already exists）
        // 如果 API 返回 409，说明可能已经有记录，查询并返回生成中状态
        if (errorMessage.includes('409') || errorMessage.includes('already exists')) {
          const existingRecord = await query(
            `SELECT id, status, task_id
             FROM track_wav_conversions 
             WHERE track_id = $1::uuid 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [trackId]
          );

          if (existingRecord.rows.length > 0) {
            const conversion = existingRecord.rows[0];
            return NextResponse.json(
              {
                error: 'WAV generation in progress',
                message: 'WAV conversion is already in progress. Please try again in a few moments.',
                status: conversion.status === 'generating' ? 'generating' : 'processing',
                taskId: conversion.task_id || track.task_id
              },
              { status: 202 }
            );
          }
        }
        
        return NextResponse.json(
          {
            error: 'Failed to generate WAV',
            details: errorMessage
          },
          { status: 500 }
        );
      }
    }

    // MP3 格式或 WAV 下载失败时的回退逻辑
    // 检查音频URL是否存在
    if (!track.audioUrl) {
      return NextResponse.json(
        { error: 'Audio file not available' },
        { status: 404 }
      );
    }

    // 获取音频文件（代理下载）
    try {
      const audioResponse = await fetch(track.audioUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MakernbBot/1.0)',
        },
        // 禁用缓存，避免 Next.js 尝试缓存超过 2MB 的文件
        cache: 'no-store',
      });

      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
      }

      // 获取音频数据
      const audioBuffer = await audioResponse.arrayBuffer();
      
      // 根据格式设置 content-type 和文件名
      // 注意：如果 format === 'wav'，应该已经在上面处理了，这里主要处理 MP3
      const contentType = format === 'mp3'
        ? (audioResponse.headers.get('content-type') || 'audio/mpeg')
        : 'audio/mpeg'; // 默认 MP3
      const fileExtension = format === 'mp3' ? 'mp3' : 'mp3'; // 默认 MP3

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
          audioUrl: track.audioUrl,
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

