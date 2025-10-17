import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth-utils-optimized';
import { createCoverGeneration, updateCoverGeneration } from '@/lib/cover-db';
import MusicApiService from '@/lib/music-api';
import { downloadFromUrl, uploadCoverImage } from '@/lib/r2-storage';

export async function POST(request: NextRequest) {
  try {
    // 先解析请求体
    const body = await request.json();
    const { musicTaskId, userId: bodyUserId } = body;
    
    // 检查用户是否登录
    let userId = await getUserIdFromRequest(request);
    
    // 如果从Authorization header获取不到用户ID，尝试从请求体中获取
    if (!userId) {
      userId = bodyUserId;
      
      if (!userId) {
        // 开发环境：使用默认用户ID进行测试
        if (process.env.NODE_ENV === 'development') {
          console.log('Development mode: using default user ID');
          userId = '00000000-0000-0000-0000-000000000000';
        } else {
          return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
          );
        }
      } else {
        console.log(`Using userId from request body: ${userId}`);
      }
    }

    // 初始化音乐API
    const apiKey = process.env.SUNO_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }
    const musicApi = new MusicApiService(apiKey);

    if (!musicTaskId) {
      return NextResponse.json(
        { error: 'musicTaskId is required' },
        { status: 400 }
      );
    }

    // 由于封面生成现在只在音乐成功完成后触发，不需要额外的状态检查
    console.log(`Generating cover for music task: ${musicTaskId}`);

    // 调用封面生成API
    const result = await musicApi.generateCover({ 
      taskId: musicTaskId,
      // Remove trailing slash to match trailingSlash: false configuration
      callBackUrl: `${process.env.CallBackURL}/api/cover-callback`
    });
    console.log('KIE API cover generation response:', result);
    console.log('Processing result code:', result.code);
    
    if (result.code === 200) {
      console.log(`Cover generation started for music taskId: ${musicTaskId}, cover taskId: ${result.data.taskId}`);
      
      // 创建封面生成记录
      const coverRecord = await createCoverGeneration(result.data.taskId, {
        music_task_id: musicTaskId,
        user_id: userId,
        status: 'generating'
      });
      
      return NextResponse.json({
        success: true,
        coverTaskId: result.data.taskId,
        coverRecordId: coverRecord.id
      });
    } else if (result.code === 400) {
      // 封面已存在，需要查询已存在的封面状态
      console.log(`Cover already exists for music taskId: ${musicTaskId}, cover taskId: ${result.data.taskId}`);
      console.log(`Processing 400 status code for cover taskId: ${result.data.taskId}`);
      
      // 创建封面生成记录（如果不存在）
      const coverRecord = await createCoverGeneration(result.data.taskId, {
        music_task_id: musicTaskId,
        user_id: userId,
        status: 'generating' // 先设为generating，后续通过查询更新
      });
      
      // 立即查询已存在的封面状态
      try {
        console.log(`Querying cover status for taskId: ${result.data.taskId}`);
        const coverStatus = await musicApi.getCoverStatus(result.data.taskId);
        console.log(`Cover status for existing cover ${result.data.taskId}:`, JSON.stringify(coverStatus, null, 2));
        
        if (coverStatus.code === 200 && coverStatus.data?.images) {
          // 封面已完成，更新状态并保存图片
          await updateCoverGeneration(result.data.taskId, {
            status: 'complete'
          });
          
          // 保存封面图片到数据库
          for (let i = 0; i < coverStatus.data.images.length; i++) {
            try {
              const imageUrl = coverStatus.data.images[i];
              // 下载图片
              const imageBuffer = await downloadFromUrl(imageUrl);
              
              // 从URL中提取原始文件名，确保使用图片的唯一ID
              const urlParts = imageUrl.split('/');
              let filename = urlParts[urlParts.length - 1];

              // 确保文件名有效，如果提取失败则使用时间戳+索引作为备用
              if (!filename || filename.trim() === '') {
                console.warn(`Failed to extract filename from URL: ${imageUrl}, using fallback`);
                filename = `cover_${Date.now()}_${i + 1}.png`;
              }

              console.log(`Extracted filename: ${filename} from URL: ${imageUrl}`);
              
              const r2Url = await uploadCoverImage(
                imageBuffer,
                result.data.taskId,
                filename,
                userId
              );
              
              // 封面图片已上传到R2，无需额外数据库操作
              
              console.log(`Cover image ${i + 1} uploaded to R2: ${r2Url}`);
            } catch (imageError) {
              console.error(`Failed to process cover image ${i + 1}:`, imageError);
              
              // R2上传失败，记录错误
              console.log(`Cover image ${i + 1} R2 upload failed`);
            }
          }
          
          console.log(`Cover images saved for existing cover ${result.data.taskId}`);
        }
      } catch (statusError) {
        console.error('Failed to query existing cover status:', statusError);
        // 继续执行，不中断流程
      }
      
      return NextResponse.json({
        success: true,
        coverTaskId: result.data.taskId,
        coverRecordId: coverRecord.id,
        isDuplicate: true
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.msg || 'Cover generation failed'
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Cover generation error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: 'Failed to generate cover', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}