/**
 * 替换音乐分区 API
 * POST /api/music/replace-section
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserInfoFromRequest } from '@/lib/auth';
import { getFeatureCredits } from '@/lib/credits-config';
import { DEFAULT_NEGATIVE_TAGS } from '@/lib/music-generation-config';
import { consumeUserCredit, getUserCredits, addUserCredits } from '@/lib/user-db';
import { hasFeaturePermission } from '@/lib/feature-permissions';
import { query } from '@/lib/db-query-builder';
import {
  ReplaceSectionAPIRequest,
  ReplaceSectionAPIResponse,
  KIEReplaceSectionRequest,
  KIEReplaceSectionResponse
} from '@/features/music-upload/types/replace-section';

// 强制动态渲染
export const dynamic = 'force-dynamic';

/**
 * KIE API 配置
 */
const KIE_API_BASE_URL = process.env.KIE_API_BASE_URL;
const KIE_API_KEY = process.env.KIE_API_KEY;

/**
 * 获取原始 track 信息
 */
async function getOriginalTrackInfo(trackId: string) {
  const result = await query(
    `SELECT
      t.id as track_id,
      t.suno_track_id,
      t.title as track_title,
      t.duration,
      m.id as music_id,
      m.task_id,
      m.title as music_title,
      COALESCE(NULLIF(m.tags, ''), '') as genre,
      m.tags,
      m.model,
      m.user_id
    FROM tracks t
    JOIN music m ON t.music_id = m.id
    WHERE t.id = $1`,
    [trackId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    trackId: row.track_id,
    sunoTrackId: row.suno_track_id,
    trackTitle: row.track_title,
    duration: row.duration,
    musicId: row.music_id,
    taskId: row.task_id,
    musicTitle: row.music_title,
    genre: row.genre,
    tags: row.tags,
    model: row.model,
    userId: row.user_id
  };
}

/**
 * 调用 KIE API 创建替换分区任务
 */
async function callKIEReplaceSectionAPI(params: KIEReplaceSectionRequest): Promise<KIEReplaceSectionResponse> {
  if (!KIE_API_BASE_URL) {
    throw new Error('KIE_API_BASE_URL environment variable is not configured');
  }

  if (!KIE_API_KEY) {
    throw new Error('KIE_API_KEY environment variable is not configured');
  }

  const apiUrl = `${KIE_API_BASE_URL}/api/v1/generate/replace-section`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KIE_API_KEY}`,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`KIE API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * POST /api/music/replace-section
 * 创建替换音乐分区任务
 */
export async function POST(request: NextRequest) {
  const requestId = `replace_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  console.log(`[REPLACE-SECTION-${requestId}] Starting replace section request`);

  try {
    // 1. 验证用户身份
    const userInfo = await getUserInfoFromRequest(request);
    if (!userInfo) {
      console.log(`[REPLACE-SECTION-${requestId}] Authentication failed`);
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { userId, authorName } = userInfo;
    console.log(`[REPLACE-SECTION-${requestId}] User authenticated: ${userId}`);

    // 2. 解析请求参数
    const body: ReplaceSectionAPIRequest = await request.json();
    const {
      trackId,
      infillStartS,
      infillEndS,
      prompt,
      tags,
      title,
      fullLyrics,
    } = body;

    console.log(`[REPLACE-SECTION-${requestId}] Request params:`, {
      trackId,
      infillStartS,
      infillEndS,
      prompt,
      tags,
      title,
      fullLyrics,
    });

    // 3. 参数验证
    if (!trackId) {
      return NextResponse.json(
        { success: false, error: 'trackId is required' },
        { status: 400 }
      );
    }

    if (!prompt || !tags || !title) {
      return NextResponse.json(
        { success: false, error: 'prompt, tags, and title are required' },
        { status: 400 }
      );
    }

    if (infillStartS === undefined || infillEndS === undefined) {
      return NextResponse.json(
        { success: false, error: 'infillStartS and infillEndS are required' },
        { status: 400 }
      );
    }

    if (infillStartS >= infillEndS) {
      return NextResponse.json(
        { success: false, error: 'infillStartS must be less than infillEndS' },
        { status: 400 }
      );
    }

    const minSegmentSeconds = 6;
    const maxSegmentSeconds = 60;
    const segmentLength = infillEndS - infillStartS;
    if (segmentLength < minSegmentSeconds || segmentLength > maxSegmentSeconds) {
      return NextResponse.json(
        {
          success: false,
          error: `Replacement range must be between ${minSegmentSeconds}s and ${maxSegmentSeconds}s.`,
        },
        { status: 400 }
      );
    }

    // 4. 获取原始 track 信息
    console.log(`[REPLACE-SECTION-${requestId}] Fetching original track info for trackId: ${trackId}`);
    const originalTrack = await getOriginalTrackInfo(trackId);
    if (!originalTrack) {
      console.error(`[REPLACE-SECTION-${requestId}] Original track not found: ${trackId}`);
      return NextResponse.json(
        { success: false, error: 'Original track not found' },
        { status: 404 }
      );
    }

    if (!originalTrack.sunoTrackId) {
      console.error(`[REPLACE-SECTION-${requestId}] Track does not have suno_track_id: ${trackId}`);
      return NextResponse.json(
        { success: false, error: 'Track does not have suno_track_id, cannot replace section' },
        { status: 400 }
      );
    }

    if (!originalTrack.taskId) {
      console.error(`[REPLACE-SECTION-${requestId}] Track does not have task_id: ${trackId}`);
      return NextResponse.json(
        { success: false, error: 'Track does not have task_id, cannot replace section' },
        { status: 400 }
      );
    }

    console.log(`[REPLACE-SECTION-${requestId}] Original track found:`, {
      trackId: originalTrack.trackId,
      musicId: originalTrack.musicId,
      taskId: originalTrack.taskId,
      sunoTrackId: originalTrack.sunoTrackId,
      title: originalTrack.trackTitle,
    });

    // 5. 检查权限
    const hasPermission = await hasFeaturePermission(userId, 'replace_section');
    if (!hasPermission) {
      console.log(`[REPLACE-SECTION-${requestId}] Permission denied for user: ${userId}`);
      return NextResponse.json(
        {
          success: false,
          error: 'Permission denied',
          message: 'You do not have permission to replace section'
        },
        { status: 403 }
      );
    }

    // 6. 计算所需积分
    const requiredCredits = getFeatureCredits('replace_section');
    console.log(`[REPLACE-SECTION-${requestId}] Credit calculation: required=${requiredCredits}`);

    // 7. 检查用户积分
    const userCredits = await getUserCredits(userId);
    if (!userCredits || userCredits.credits < requiredCredits) {
      console.log(`[REPLACE-SECTION-${requestId}] Insufficient credits: required=${requiredCredits}, available=${userCredits?.credits || 0}`);
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient credits',
          insufficientCredits: true,
        },
        { status: 402 }
      );
    }

    console.log(`[REPLACE-SECTION-${requestId}] Credits check passed: available=${userCredits.credits}, required=${requiredCredits}`);

    // 8. 扣除积分
    console.log(`[REPLACE-SECTION-${requestId}] Deducting credits: ${requiredCredits}`);
    const creditConsumed = await consumeUserCredit(
      userId,
      requiredCredits,
      `Replace section: ${originalTrack.trackTitle}`,
      trackId,
      'replace_section'
    );

    if (!creditConsumed) {
      console.error(`[REPLACE-SECTION-${requestId}] Failed to deduct credits`);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to deduct credits',
          insufficientCredits: true,
        },
        { status: 402 }
      );
    }

    console.log(`[REPLACE-SECTION-${requestId}] Credits deducted successfully`);

    // 9. 构建 KIE API 请求参数
    const kieParams: KIEReplaceSectionRequest = {
      taskId: originalTrack.taskId,
      audioId: originalTrack.sunoTrackId,
      prompt,
      tags,
      title,
      infillStartS: Number(infillStartS.toFixed(2)),
      infillEndS: Number(infillEndS.toFixed(2)),
      callBackUrl: `${process.env.CallBackURL}/api/callbacks/replace-section`,
      negativeTags: DEFAULT_NEGATIVE_TAGS,
      fullLyrics: fullLyrics || '', // 必须传递，即使是空字符串
    };

    // 10. 调用 KIE API
    console.log(`[REPLACE-SECTION-${requestId}] Calling KIE API with params:`, kieParams);

    let kieResponse: KIEReplaceSectionResponse;
    try {
      kieResponse = await callKIEReplaceSectionAPI(kieParams);
      console.log(`[REPLACE-SECTION-${requestId}] KIE API response received:`, {
        code: kieResponse.code,
        hasTaskId: !!kieResponse.data?.taskId,
        msg: kieResponse.msg,
      });
    } catch (error) {
      console.error(`[REPLACE-SECTION-${requestId}] KIE API error:`, error);

      // 退还积分
      console.log(`[REPLACE-SECTION-${requestId}] Refunding credits due to KIE API error`);
      await addUserCredits(userId, requiredCredits, 'Refund: KIE API error', trackId, 'refund_replace_section');
      console.log(`[REPLACE-SECTION-${requestId}] Credits refunded: ${requiredCredits}`);

      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to call KIE API',
        },
        { status: 500 }
      );
    }

    // 11. 检查 KIE API 响应
    const newTaskId = kieResponse.data?.taskId;

    if (kieResponse.code !== 200 || !newTaskId) {
      console.error(`[REPLACE-SECTION-${requestId}] KIE API returned error:`, kieResponse);

      // 退还积分
      console.log(`[REPLACE-SECTION-${requestId}] Refunding credits due to KIE API error response`);
      await addUserCredits(userId, requiredCredits, `Refund: ${kieResponse.msg || 'KIE API error'}`, trackId, 'refund_replace_section');
      console.log(`[REPLACE-SECTION-${requestId}] Credits refunded: ${requiredCredits}`);

      return NextResponse.json(
        {
          success: false,
          error: kieResponse.msg || 'KIE API returned error',
        },
        { status: 500 }
      );
    }

    console.log(`[REPLACE-SECTION-${requestId}] KIE API task created: taskId=${newTaskId}`);

    // 12. 在数据库中创建音乐记录
    try {
      // 创建 music 记录，使用用户输入的 title
      const musicResult = await query(
        `INSERT INTO music (
          user_id, author_name, task_id, title, tags, prompt,
          is_instrumental, status, type, model
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id`,
        [
          userId,
          authorName,
          newTaskId,
          title,
          tags,
          prompt,
          false,
          'generating',
          'replace_section',
          'V4'
        ]
      );

      const musicId = musicResult.rows[0].id;
      console.log(`[REPLACE-SECTION-${requestId}] Created music record: ${musicId}, title: ${title}`);

      // 创建占位 track 记录（创建2个占位，与extend music保持一致）
      const tracksResult = await query(
        `INSERT INTO tracks (music_id, is_published, cover_image_url, suno_track_id, title, original_track_id, source_type)
         VALUES ($1, $2, NULL, NULL, $3, $4, 'replace_section'), ($1, $2, NULL, NULL, $3, $4, 'replace_section')
         RETURNING *`,
        [musicId, false, title, trackId]
      );

      // 构建初始 tracks 数据返回给前端
      const initialTracks = tracksResult.rows.map((row: any) => ({
        id: row.id,
        generationId: musicId,
        suno_track_id: row.suno_track_id || null,
        title: title,
        audioUrl: '',
        duration: undefined,
        coverImage: row.cover_image_url || null,
        tags: tags,
        lyrics: '',
        isGenerating: true,
        isCompleted: false,
        streamAudioUrl: '',
        createdAt: row.created_at || new Date().toISOString(),
        model: originalTrack.model || 'V4',
        originalTrackId: trackId, // 设置原歌曲ID
        originalTrackTitle: originalTrack.trackTitle, // 原歌曲标题
        sourceType: 'replace_section', // 来源类型
        musicType: 'replace_section',
      }));

      console.log(`[REPLACE-SECTION-${requestId}] Created ${initialTracks.length} placeholder track(s)`);

      // 13. 返回成功响应
      const response: ReplaceSectionAPIResponse = {
        success: true,
        data: {
          taskId: newTaskId,
          musicId,
          estimatedCredits: requiredCredits,
          initialTracks,
        },
      };

      console.log(`[REPLACE-SECTION-${requestId}] Request completed successfully`);
      return NextResponse.json(response);

    } catch (dbError) {
      console.error(`[REPLACE-SECTION-${requestId}] Database error:`, dbError);

      // 退还积分
      await addUserCredits(userId, requiredCredits, 'Refund: Database error', trackId, 'refund_replace_section');

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create database records',
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error(`[REPLACE-SECTION-${requestId}] Unexpected error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
