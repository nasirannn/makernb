import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { hasFeaturePermission } from '@/lib/feature-permissions';
import { query } from '@/lib/db-query-builder';
import MusicApiService from '@/lib/music-api';
import { createTrackWavConversion, getTrackWavConversionsByTrackId } from '@/lib/track-wav-db';

// 强制动态渲染
export const dynamic = 'force-dynamic';

/**
 * 生成 WAV 文件
 * 将 MP3 音频转换为 WAV 格式
 */
export async function POST(request: NextRequest) {
  try {
    // 获取用户ID
    const userId = await getUserIdFromRequest(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 检查用户是否有 WAV 下载权限
    // 统一使用 feature code 检查，与前端保持一致
    const featureCode = 'download_wav_track';
    const hasPermission = await hasFeaturePermission(userId, featureCode);
    
    if (!hasPermission) {
      return NextResponse.json(
        { 
          error: 'Feature not available',
          message: 'WAV download feature is not available for your subscription tier. Please upgrade to access this feature.'
        },
        { status: 403 }
      );
    }

    // 获取请求体
    const body = await request.json();
    const { trackId } = body;

    if (!trackId) {
      return NextResponse.json(
        { error: 'Track ID is required' },
        { status: 400 }
      );
    }

    // 查询 track 信息，获取 taskId 和 audioId
    const trackResult = await query(
      `SELECT 
        mt.id as track_id,
        mt.suno_track_id as audio_id,
        mg.task_id,
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

    // 检查用户是否有权限访问这个 track
    if (track.user_id !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 检查必需的字段
    if (!track.task_id) {
      return NextResponse.json(
        { error: 'Track does not have a task ID' },
        { status: 400 }
      );
    }

    if (!track.audio_id) {
      return NextResponse.json(
        { error: 'Track does not have an audio ID' },
        { status: 400 }
      );
    }

    // 获取所有该track的WAV转换记录（按创建时间倒序）
    const allConversions = await getTrackWavConversionsByTrackId(trackId);
    const latestConversion = allConversions[0]; // 最新的记录

    // 如果存在转换记录，检查状态
    if (latestConversion) {
      // 1. 正在生成中 - 避免重复创建
      if (latestConversion.status === 'generating') {
        return NextResponse.json({
          success: true,
          data: {
            trackId,
            taskId: latestConversion.task_id,
            status: 'generating',
            message: 'WAV conversion is already in progress'
          }
        });
      }

      // 2. 已完成 - 优先使用 R2 URL，如果没有则使用临时 URL
      const availableWavUrl = latestConversion.wav_r2_url || latestConversion.wav_url;
      if (latestConversion.status === 'complete' && availableWavUrl) {
        // 如果有 R2 URL，直接返回（永久链接，不过期）
        if (latestConversion.wav_r2_url) {
          return NextResponse.json({
            success: true,
            data: {
              trackId,
              taskId: latestConversion.task_id,
              wavUrl: latestConversion.wav_r2_url,
              status: 'complete',
              isExisting: true,
              isPersistent: true // 标记为持久化链接
            }
          });
        }
        
        // 使用临时 URL，直接返回（如果 URL 无效，用户会触发重新生成）
        return NextResponse.json({
          success: true,
          data: {
            trackId,
            taskId: latestConversion.task_id,
            wavUrl: latestConversion.wav_url,
            status: 'complete',
            isExisting: true,
            isPersistent: false // 临时链接
          }
        });
      }

      // 3. error 或 expired 状态 - 继续创建新的转换任务
    }

    // 获取 API key
    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    // 调用 KIE API 生成 WAV
    const musicApi = new MusicApiService(apiKey);
    const result = await musicApi.generateWavConversion({
      taskId: track.task_id,
      audioId: track.audio_id,
    });

    // 创建数据库记录
    const conversion = await createTrackWavConversion({
      track_id: trackId,
      task_id: result.data.taskId,
      status: 'generating'
    });

    return NextResponse.json({
      success: true,
      data: {
        trackId,
        taskId: result.data.taskId,
        status: 'generating',
        conversionId: conversion.id
      }
    });

  } catch (error) {
    console.error('[GENERATE-WAV] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate WAV',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

