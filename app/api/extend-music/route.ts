/**
 * 扩展音乐 API
 * POST /api/extend-music
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { getExtendMusicCredits } from '@/lib/credits-config';
import { consumeUserCredit } from '@/lib/user-db';
import { createExtendMusicTask, getOriginalTrackInfo } from '@/lib/extend-music-db';
import { hasFeaturePermission } from '@/lib/feature-permissions';
import {
  ExtendMusicAPIRequest,
  ExtendMusicAPIResponse,
  KIEExtendMusicRequest,
  KIEExtendMusicResponse
} from '@/types/extend-music';
import { DEFAULT_NEGATIVE_TAGS } from '@/lib/music-generation-config';

// 强制动态渲染
export const dynamic = 'force-dynamic';

/**
 * KIE API 配置
 */
const KIE_API_BASE_URL = process.env.KIE_API_BASE_URL;
const KIE_API_KEY = process.env.KIE_API_KEY;

/**
 * 调用 KIE API 创建扩展任务
 */
async function callKIEExtendMusicAPI(params: KIEExtendMusicRequest): Promise<KIEExtendMusicResponse> {
  if (!KIE_API_BASE_URL) {
    throw new Error('KIE_API_BASE_URL environment variable is not configured');
  }
  
  if (!KIE_API_KEY) {
    throw new Error('KIE_API_KEY environment variable is not configured');
  }

  // 确保 URL 是绝对路径，使用 /api/v1/generate/extend 端点（根据 KIE API 文档）
  const apiUrl = `${KIE_API_BASE_URL}/api/v1/generate/extend`;

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
 * POST /api/extend-music
 * 创建音乐扩展任务
 */
export async function POST(request: NextRequest) {
  const requestId = `extend_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  console.log(`[EXTEND-MUSIC-${requestId}] Starting extend music request`);
  
  try {
    // 1. 验证用户身份
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      console.log(`[EXTEND-MUSIC-${requestId}] Authentication failed`);
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log(`[EXTEND-MUSIC-${requestId}] User authenticated: ${userId}`);

    // 2. 解析请求参数
    const body: ExtendMusicAPIRequest = await request.json();
    const {
      trackId,
      model,
      defaultParamFlag,
      prompt,
      style,
      title,
      continueAt,
      vocalGender,
      styleWeight,
      weirdnessConstraint,
      audioWeight,
      personaId,
    } = body;

    console.log(`[EXTEND-MUSIC-${requestId}] Request params:`, {
      trackId,
      model,
      defaultParamFlag,
      hasPrompt: !!prompt,
      hasStyle: !!style,
      hasTitle: !!title,
      continueAt,
      hasAdvancedParams: !!(styleWeight || weirdnessConstraint || audioWeight),
    });

    // 3. 参数验证
    if (!trackId) {
      console.log(`[EXTEND-MUSIC-${requestId}] Validation failed: trackId is required`);
      return NextResponse.json(
        { success: false, error: 'trackId is required' },
        { status: 400 }
      );
    }

    if (!model) {
      console.log(`[EXTEND-MUSIC-${requestId}] Validation failed: model is required`);
      return NextResponse.json(
        { success: false, error: 'model is required' },
        { status: 400 }
      );
    }

    // 自定义模式参数验证
    if (!defaultParamFlag) {
      if (!prompt || !style || !title || continueAt === undefined) {
        console.log(`[EXTEND-MUSIC-${requestId}] Validation failed: Custom mode requires prompt, style, title, and continueAt`);
        return NextResponse.json(
          { 
            success: false, 
            error: 'Custom mode requires prompt, style, title, and continueAt' 
          },
          { status: 400 }
        );
      }
    }

    console.log(`[EXTEND-MUSIC-${requestId}] Parameters validated successfully`);

    // 3.5. 验证 KIE API 配置
    if (!KIE_API_BASE_URL) {
      console.error(`[EXTEND-MUSIC-${requestId}] KIE_API_BASE_URL environment variable is not configured`);
      return NextResponse.json(
        { success: false, error: 'KIE API base URL is not configured' },
        { status: 500 }
      );
    }

    if (!KIE_API_KEY) {
      console.error(`[EXTEND-MUSIC-${requestId}] KIE_API_KEY environment variable is not configured`);
      return NextResponse.json(
        { success: false, error: 'KIE API key is not configured' },
        { status: 500 }
      );
    }

    // 4. 获取原始 track 信息
    console.log(`[EXTEND-MUSIC-${requestId}] Fetching original track info for trackId: ${trackId}`);
    const originalTrack = await getOriginalTrackInfo(trackId);
    if (!originalTrack) {
      console.error(`[EXTEND-MUSIC-${requestId}] Original track not found: ${trackId}`);
      return NextResponse.json(
        { success: false, error: 'Original track not found' },
        { status: 404 }
      );
    }

    if (!originalTrack.sunoTrackId) {
      console.error(`[EXTEND-MUSIC-${requestId}] Track does not have suno_track_id: ${trackId}`);
      return NextResponse.json(
        { success: false, error: 'Track does not have suno_track_id, cannot extend' },
        { status: 400 }
      );
    }

    console.log(`[EXTEND-MUSIC-${requestId}] Original track found:`, {
      trackId: originalTrack.trackId,
      musicId: originalTrack.musicId,
      sunoTrackId: originalTrack.sunoTrackId,
      title: originalTrack.title,
    });

    // 4.5. 检查权限
    const hasPermission = await hasFeaturePermission(userId, 'extend_music');
    if (!hasPermission) {
      console.log(`[EXTEND-MUSIC-${requestId}] Permission denied for user: ${userId}`);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Permission denied',
          message: 'You do not have permission to extend music'
        },
        { status: 403 }
      );
    }

    // 5. 计算所需积分
    const requiredCredits = getExtendMusicCredits(model);
    console.log(`[EXTEND-MUSIC-${requestId}] Credit calculation: model=${model}, required=${requiredCredits}`);

    // 6. 检查用户积分
    const { getUserCredits } = await import('@/lib/user-db');
    const userCredits = await getUserCredits(userId);
    if (!userCredits || userCredits.credits < requiredCredits) {
      console.log(`[EXTEND-MUSIC-${requestId}] Insufficient credits: required=${requiredCredits}, available=${userCredits?.credits || 0}`);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Insufficient credits',
          insufficientCredits: true,
        },
        { status: 402 }
      );
    }

    console.log(`[EXTEND-MUSIC-${requestId}] Credits check passed: available=${userCredits.credits}, required=${requiredCredits}`);

    // 7. 扣除积分
    console.log(`[EXTEND-MUSIC-${requestId}] Deducting credits: ${requiredCredits}`);
    const creditConsumed = await consumeUserCredit(
      userId,
      requiredCredits,
      `Extend music: ${originalTrack.title}`,
      trackId,
      'extend_music'
    );

    if (!creditConsumed) {
      console.error(`[EXTEND-MUSIC-${requestId}] Failed to deduct credits`);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to deduct credits',
          insufficientCredits: true,
        },
        { status: 402 }
      );
    }

    console.log(`[EXTEND-MUSIC-${requestId}] Credits deducted successfully`);

    // 8. 构建 KIE API 请求参数
    const kieParams: KIEExtendMusicRequest = {
      audio_id: originalTrack.sunoTrackId,
      model,
      default_param_flag: defaultParamFlag,
      callBackUrl: `${process.env.CallBackURL}/api/extend-music-callback`,
    };

    // 添加自定义参数
    if (!defaultParamFlag) {
      kieParams.prompt = prompt;
      kieParams.style = style;
      kieParams.title = title;
      kieParams.continue_at = continueAt;
      kieParams.negative_tags = DEFAULT_NEGATIVE_TAGS;
      if (vocalGender) kieParams.vocal_gender = vocalGender;
      if (styleWeight !== undefined && styleWeight !== 0.65) kieParams.style_weight = styleWeight;
      if (weirdnessConstraint !== undefined && weirdnessConstraint !== 0.65) kieParams.weirdness_constraint = weirdnessConstraint;
      if (audioWeight !== undefined && audioWeight !== 0.65) kieParams.audio_weight = audioWeight;
      if (personaId) kieParams.persona_id = personaId;
    }

    // 9. 调用 KIE API
    console.log(`[EXTEND-MUSIC-${requestId}] Calling KIE API with params:`, {
      audio_id: kieParams.audio_id,
      model: kieParams.model,
      default_param_flag: kieParams.default_param_flag,
      has_custom_params: !kieParams.default_param_flag,
    });

    let kieResponse: KIEExtendMusicResponse;
    try {
      kieResponse = await callKIEExtendMusicAPI(kieParams);
      // KIE API 返回的是 taskId (驼峰，没有下划线)
      const responseTaskId = kieResponse.data?.taskId;
      console.log(`[EXTEND-MUSIC-${requestId}] KIE API response received:`, {
        code: kieResponse.code,
        hasTaskId: !!responseTaskId,
        taskId: responseTaskId,
        msg: kieResponse.msg,
      });
    } catch (error) {
      console.error(`[EXTEND-MUSIC-${requestId}] KIE API error:`, error);
      
      // 退还积分
      console.log(`[EXTEND-MUSIC-${requestId}] Refunding credits due to KIE API error`);
      const { addUserCredits } = await import('@/lib/user-db');
      await addUserCredits(userId, requiredCredits, 'Refund: KIE API error', trackId, 'refund_extend_music');
      console.log(`[EXTEND-MUSIC-${requestId}] Credits refunded: ${requiredCredits}`);

      return NextResponse.json(
        { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to call KIE API',
        },
        { status: 500 }
      );
    }

    // 10. 检查 KIE API 响应
    // KIE API 返回的是 taskId (驼峰，没有下划线)
    const taskId = kieResponse.data?.taskId;
    
    if (kieResponse.code !== 200 || !taskId) {
      console.error(`[EXTEND-MUSIC-${requestId}] KIE API returned error:`, kieResponse);
      
      // 退还积分
      console.log(`[EXTEND-MUSIC-${requestId}] Refunding credits due to KIE API error response`);
      const { addUserCredits } = await import('@/lib/user-db');
      await addUserCredits(userId, requiredCredits, `Refund: ${kieResponse.msg || 'KIE API error'}`, trackId, 'refund_extend_music');
      console.log(`[EXTEND-MUSIC-${requestId}] Credits refunded: ${requiredCredits}`);

      return NextResponse.json(
        { 
          success: false, 
          error: kieResponse.msg || 'KIE API returned error',
        },
        { status: 500 }
      );
    }
    console.log(`[EXTEND-MUSIC-${requestId}] KIE API task created: taskId=${taskId}`);

    // 11. 在数据库中创建扩展任务记录
    const extendTitle = defaultParamFlag 
      ? `${originalTrack.title} (Extended)`
      : title!;

    const extendPrompt = defaultParamFlag
      ? `Extended from: ${originalTrack.title}`
      : prompt!;

    const extendStyle = defaultParamFlag
      ? originalTrack.tags
      : style!;

    try {
      console.log(`[EXTEND-MUSIC-${requestId}] Creating extend music task in database`);
      const musicId = await createExtendMusicTask({
        userId,
        taskId,
        title: extendTitle,
        genre: originalTrack.genre,
        tags: extendStyle,
        prompt: extendPrompt,
        isInstrumental: originalTrack.isInstrumental,
        originalMusicId: originalTrack.musicId,
        originalTrackId: originalTrack.trackId,
      });

      console.log(`[EXTEND-MUSIC-${requestId}] Extend music task created successfully:`, {
        taskId,
        musicId,
        title: extendTitle,
      });

      // 11.5. 创建两条占位 track 记录（与普通生成音乐保持一致）
      const isPublished = false; // 默认设置为私有状态
      const { query } = await import('@/lib/db-query-builder');
      const tracksResult = await query(
        `INSERT INTO tracks (music_id, is_published, cover_image_url, suno_track_id, original_track_id, source_type)
         VALUES ($1, $2, NULL, NULL, $3, 'extended'), ($1, $2, NULL, NULL, $3, 'extended')
         RETURNING *`,
        [musicId, isPublished, originalTrack.trackId]
      );

      // 构建初始 tracks 数据返回给前端
      const initialTracks = tracksResult.rows.map((row: any, index: number) => ({
        id: row.id,
        generationId: musicId,
        suno_track_id: row.suno_track_id || null,
        title: extendTitle,
        audioUrl: '',
        duration: undefined,
        coverImage: row.cover_image_url || null,
        tags: extendStyle || '',
        genre: originalTrack.genre,
        lyrics: '',
        isGenerating: true,
        isCompleted: false,
        streamAudioUrl: '',
        createdAt: row.created_at || new Date().toISOString(),
        originalTrackId: originalTrack.trackId, // 设置原歌曲ID，用于分组
        originalTrackTitle: originalTrack.title, // 原歌曲标题
        sourceType: 'extended', // 来源类型
      }));

      console.log(`[EXTEND-MUSIC-${requestId}] ✅ Created ${initialTracks.length} placeholder tracks`);

      // 12. 返回成功响应（包含初始 tracks）
      const response: ExtendMusicAPIResponse = {
        success: true,
        message: 'Extend music task created successfully',
        data: {
          taskId,
          musicId,
          estimatedCredits: requiredCredits,
          initialTracks, // 添加初始占位 tracks
        },
      };

      // 13. 封面图片处理
      // 注意：不再调用 generate-cover API，直接使用延长音乐接口返回的 image_url 作为封面
      // 封面图片将在 extend-music-callback 中从回调数据中获取并保存

      console.log(`[EXTEND-MUSIC-${requestId}] Request completed successfully`);
      return NextResponse.json(response);
    } catch (error) {
      console.error(`[EXTEND-MUSIC-${requestId}] Failed to create extend music task in database:`, error);
      
      // 退还积分
      console.log(`[EXTEND-MUSIC-${requestId}] Refunding credits due to database error`);
      const { addUserCredits } = await import('@/lib/user-db');
      await addUserCredits(userId, requiredCredits, 'Refund: Database error', trackId, 'refund_extend_music');
      console.log(`[EXTEND-MUSIC-${requestId}] Credits refunded: ${requiredCredits}`);

      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create extend music task in database',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error(`[EXTEND-MUSIC-${requestId}] Extend music API error:`, error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

