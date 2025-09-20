import { NextRequest, NextResponse } from 'next/server';
import MusicApiService from '@/lib/music-api';
import { createMusicGeneration } from '@/lib/music-db';
import { createGenerationError } from '@/lib/generation-errors-db';
import { consumeUserCredit } from '@/lib/user-db';
import { getUserIdFromRequest } from '@/lib/auth-utils';
import { R_AND_B_STYLES } from '@/lib/90s-rnb-style-prompts';

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
      mood,
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
    let selectedMood = mood;
    
    if (mode === 'basic') {
      // Basic mode: 固定设置genre为"Contemporary R&B"，不再依赖mood
      selectedGenre = 'Contemporary R&B'; // 固定设置为Contemporary R&B
      selectedMood = null; // 不再使用mood

      console.log(`Basic mode: Fixed genre set to "Contemporary R&B"`);

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
      selectedMood = mood; // 使用用户选择的mood，不设置默认值
      
    } else {
      return NextResponse.json(
        { error: 'Please select a valid mode (basic or custom)' },
        { status: 400 }
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

    const musicApi = new MusicApiService(apiKey);
    console.log('Full request data:', requestData);
    
    // 构造完整的请求对象传递给API
    const musicRequest = {
      mode,
      mood: selectedMood,
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

    console.log('API Response:', JSON.stringify(result, null, 2));

    // 根据模式和模型版本确定积分成本
    const modelVersion = mode === 'custom' ? 'V4_5' : 'V3_5';
    const creditCost = modelVersion.startsWith('V4') ? 10 : 7;

    // 创建数据库记录（包含用户ID）
    if (result.taskId) {
      // 成功获得taskId，正常处理
      try {
        
        // 扣除积分
        const creditConsumed = await consumeUserCredit(
          userId, 
          creditCost,
          `Music generation (${modelVersion})`,
          result.taskId,
          'music_generation'
        );
        
        if (!creditConsumed) {
          console.warn('Failed to consume credits, stopping generation');
          return NextResponse.json(
            { 
              error: 'Insufficient credits',
              success: false 
            },
            { status: 400 }
          );
        }
        // 创建音乐生成记录
        // Basic Mode固定使用"R&B"，Custom Mode将genre ID转换为名称用于数据库存储
        let genreForDb;
        if (mode === 'basic') {
          genreForDb = 'R&B'; // Basic Mode固定为R&B
        } else {
          const styleForDb = R_AND_B_STYLES.find(style => style.id === selectedGenre);
          genreForDb = styleForDb ? styleForDb.name : selectedGenre;
        }

        console.log(`Creating music generation record with genre: "${genreForDb}" (mode: ${mode})`);
        await createMusicGeneration(userId, {
          title: musicRequest.songTitle || null, // 有值就插入，没有就为空
          genre: genreForDb, // 存储风格名称到数据库
          prompt: customPrompt, // 记录用户输入的prompt
          task_id: result.taskId,
          status: 'generating'
        });
        console.log(`Music generation record created for taskId: ${result.taskId}`);
        
        // 封面生成将在音乐回调成功时触发，确保只为成功的音乐生成封面
        console.log('Cover generation will be triggered after music generation completes successfully');
      } catch (dbError) {
        console.error('Failed to create music generation record:', dbError);
        // 不阻止API调用，继续执行
      }
    } else {
      // 没有taskId，说明生成失败（可能包含敏感词等）
      console.log('Music generation failed - no taskId received');

      try {
        // 生成失败不扣除积分，因为用户没有得到任何结果
        console.log('Generation failed - credits not consumed');

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

        console.log('Failed music generation record created');

        // 修改result以包含失败信息和积分信息
        (result as any).creditConsumed = 0; // 失败时不扣除积分
        (result as any).generationFailed = true;

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