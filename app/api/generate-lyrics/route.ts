import { NextRequest, NextResponse } from 'next/server';
import { createLyricsGeneration } from '@/lib/lyrics-db';
import { createGenerationError } from '@/lib/generation-errors-db';
import { getUserIdFromRequest } from '@/lib/auth-utils-optimized';

export async function POST(request: NextRequest) {
  try {
    // 检查用户是否登录 - 使用统一的身份验证方式
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { 
          error: 'Authentication required',
          message: 'Please log in to generate lyrics'
        },
        { status: 401 }
      );
    }

    const { prompt } = await request.json();

    // Validate required parameters
    if (!prompt) {
      return NextResponse.json(
        { error: 'Please provide a prompt for lyrics generation' },
        { status: 400 }
      );
    }

    // Validate prompt length (max 200 characters)
    if (prompt.length > 200) {
      return NextResponse.json(
        { error: 'Prompt must be 200 characters or less' },
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

    console.log('Generating lyrics with prompt:', prompt);

    const response = await fetch('https://api.kie.ai/api/v1/lyrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt,
        // Note: trailingSlash is enabled in next.config/vercel.json; add trailing slash to avoid 308 redirects from third-party callbacks
        callBackUrl: `${process.env.CallBackURL}/api/lyrics-callback/`,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Lyrics API call failed: ${response.statusText} - ${errorData}`);
    }

    const data = await response.json();
    
    console.log('Lyrics API response:', JSON.stringify(data, null, 2));
    
    // Check for API success
    if (data.code === 200) {
      const taskId = data.data?.taskId;

      if (taskId) {
        // 有taskId，创建正常的生成记录
        try {
          await createLyricsGeneration(taskId, userId, {
            title: 'Generating...', // 临时标题，回调时会更新
            content: prompt // 使用用户输入的prompt作为初始文本
          });
          console.log(`Lyrics generation record created for taskId: ${taskId}, userId: ${userId}`);
        } catch (dbError) {
          console.error('Failed to create lyrics generation record:', dbError);
          // 不阻止API调用，继续执行
        }

        return NextResponse.json({
          success: true,
          data: {
            taskId: taskId,
            status: 'generating'
          }
        });
      } else {
        // 没有taskId，说明生成失败（可能包含敏感词等）
        console.log('Lyrics generation failed - no taskId received');

        try {
          // 创建失败的歌词生成记录
          const failedGeneration = await createLyricsGeneration(null, userId, {
            title: 'Failed Generation',
            content: prompt,
            status: 'error'
          });

          // 创建错误记录
          await createGenerationError(
            'lyrics_generation',
            failedGeneration.id,
            data.msg || 'Lyrics generation failed - may contain sensitive content',
            `API_ERROR_${data.code}`
          );

          console.log('Failed lyrics generation record created');

        } catch (dbError) {
          console.error('Failed to create failed lyrics generation record:', dbError);
        }

        return NextResponse.json({
          success: true,
          data: {
            taskId: null,
            status: 'error',
            error: data.msg || 'Lyrics generation failed',
            errorMessage: data.msg || 'Generation failed - may contain sensitive content',
            generationFailed: true
          }
        });
      }
    } else {
      throw new Error(`Lyrics API error (${data.code}): ${data.msg || 'Unknown error'}`);
    }

  } catch (error) {
    console.error('Lyrics generation error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error occurred during lyrics generation',
        success: false 
      },
      { status: 500 }
    );
  }
}

