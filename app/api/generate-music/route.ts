import { NextRequest, NextResponse } from 'next/server';
import MusicApiService from '@/lib/music-api';
import { createMusicGeneration } from '@/lib/music-db';
import { createGenerationError } from '@/lib/generation-errors-db';
import { consumeUserCredit } from '@/lib/user-db';
import { getUserIdFromRequest } from '@/lib/auth-utils';
import { R_AND_B_STYLES } from '@/lib/rnb-style-generator';

export async function POST(request: NextRequest) {
  try {
    // 检查用户是否登录 - 使用统一的身份验证方式
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { 
          error: 'Authentication required',
          message: 'Please log in to generate music'
        },
        { status: 401 }
      );
    }

    const requestData = await request.json();
    
    // 从前端获取所有参数
    const {
      mode,
      customPrompt,
      instrumentalMode,
      genre,
      vibe,
      songTitle,
      grooveType,
      leadInstrument,
      drumKit,
      bassTone,
      vocalStyle,
      vocalGender,
      harmonyPalette,
      bpm
    } = requestData;
    // 根据模式处理参数
    let selectedGenre = genre;
    
    if (mode === 'basic') {
      // Basic mode: 固定设置genre为"Contemporary R&B"
      selectedGenre = 'R&B'; // 固定设置为Contemporary R&B

    } else if (mode === 'custom') {
      // Custom mode: 使用用户选择的所有参数
      if (!genre || !vibe) {
        return NextResponse.json(
          { error: 'Please select genre and vibe for custom mode' },
          { status: 400 }
        );
      }

      // 验证genre ID是否有效
      const selectedStyle = R_AND_B_STYLES.find(style => style.id === genre);
      if (!selectedStyle) {
        return NextResponse.json(
          { error: `Invalid genre: ${genre}` },
          { status: 400 }
        );
      }
      selectedGenre = genre; // 保持ID不变，music-api.ts需要ID
      
    } else {
      return NextResponse.json(
        { error: 'Please select a valid mode (basic or custom)' },
        { status: 400 }
      );
    }

    // 根据模式和模型版本确定积分成本
    const modelVersion = mode === 'custom' ? 'V4_5' : 'V3_5';
    const creditCost = modelVersion.startsWith('V4') ? 10 : 7;

    // 先验证积分是否足够，避免浪费API调用
    try {
      const { query } = await import('@/lib/neon');
      const creditResult = await query(
        'SELECT credits FROM user_credits WHERE user_id = $1',
        [userId]
      );

      if (creditResult.rows.length === 0) {
        return NextResponse.json(
          {
            error: 'User account not found',
            message: 'Please try logging in again',
            success: false
          },
          { status: 404 }
        );
      }

      const userCredits = creditResult.rows[0].credits;
      if (userCredits < creditCost) {
        console.warn(`Insufficient credits: user has ${userCredits}, needs ${creditCost}`);
        return NextResponse.json(
          {
            error: 'Insufficient credits',
            message: `You need ${creditCost} credits but only have ${userCredits}. Please purchase more credits to continue.`,
            success: false,
            required: creditCost,
            available: userCredits
          },
          { status: 400 }
        );
      }

    } catch (error) {
      console.error('Failed to check user credits:', error);
      return NextResponse.json(
        {
          error: 'Service temporarily unavailable',
          message: 'We are experiencing technical difficulties. Please try again in a few moments.',
          success: false,
          technical_details: error instanceof Error ? error.message : 'Database connection error'
        },
        { status: 500 }
      );
    }

    // Get API key from environment variables
    const apiKey = process.env.SUNO_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    // 积分验证通过，调用音乐生成API
    const musicApi = new MusicApiService(apiKey);

    // 构造完整的请求对象传递给API
    const musicRequest = {
      mode,
      customPrompt,
      instrumentalMode,
      genre: selectedGenre,
      vibe,
      songTitle,
      grooveType,
      leadInstrument,
      drumKit,
      bassTone,
      vocalStyle,
      vocalGender,
      harmonyPalette,
      bpm
    };

    // Generate music
    const result = await musicApi.generateMusic(musicRequest);

    // 创建数据库记录和扣除积分（只有API调用成功才执行）
    if (result.taskId) {
      // 成功获得taskId，创建记录并扣除积分
      try {
        // 准备数据库存储的genre
        let genreForDb;
        if (mode === 'basic') {
          genreForDb = 'R&B'; // Basic Mode固定为R&B
        } else {
          const styleForDb = R_AND_B_STYLES.find(style => style.id === selectedGenre);
          genreForDb = styleForDb ? styleForDb.name : selectedGenre;
        }

        // 创建音乐生成记录
        await createMusicGeneration(userId, {
          title: musicRequest.songTitle || null,
          genre: genreForDb,
          prompt: customPrompt,
          task_id: result.taskId,
          status: 'generating'
        });

        // 扣除积分（这里应该不会失败，因为我们已经预先检查了）
        const creditConsumed = await consumeUserCredit(
          userId,
          creditCost,
          `Music generation (${modelVersion})`,
          result.taskId,
          'music_generation'
        );

        if (!creditConsumed) {
          console.error('Failed to consume credits after API call - this should not happen');
          // 这种情况理论上不应该发生，因为我们已经预先检查了积分
          // 但如果发生了，我们记录错误但不阻止流程
        }

      } catch (dbError) {
        console.error('Failed to create music generation record after API call:', dbError);
        // API已经调用成功，但数据库操作失败
        // 这种情况比较复杂，我们记录错误但不阻止返回成功响应
        console.error('Warning: Music generation API succeeded but database record creation failed');
      }
    } else {
      // 没有taskId，说明生成失败（可能包含敏感词等）

      try {
        // 生成失败不扣除积分，因为用户没有得到任何结果

        // 创建失败记录到数据库
        let genreForDb;
        if (mode === 'basic') {
          genreForDb = 'R&B';
        } else {
          const styleForDb = R_AND_B_STYLES.find(style => style.id === selectedGenre);
          genreForDb = styleForDb ? styleForDb.name : selectedGenre;
        }

        const failedGeneration = await createMusicGeneration(userId, {
          title: musicRequest.songTitle || undefined,
          genre: genreForDb,
          prompt: customPrompt,
          task_id: undefined, // 没有taskId
          status: 'error'
        });

        // 创建错误记录
        await createGenerationError(
          'music_generation',
          failedGeneration.id,
          result.errorMessage || result.error || 'Generation failed',
          result.error
        );


        // 修改result以包含失败信息和积分信息
        (result as any).creditConsumed = 0; // 失败时不扣除积分
        (result as any).generationFailed = true;
        (result as any).generationId = failedGeneration.id; // 返回generationId供前端删除使用

      } catch (dbError) {
        console.error('Failed to create failed music generation record:', dbError);
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('Music generation error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error instanceof Error ? error.message : 'Unknown error' : 'Error occurred during music generation',
        success: false 
      },
      { status: 500 }
    );
  }
}