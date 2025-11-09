import { NextRequest, NextResponse } from 'next/server';
import { vocalSeparationService } from '@/lib/vocal-separation-api';
import { getUserIdFromRequest } from '@/lib/auth';
import { createVocalSeparation } from '@/lib/vocal-separation-db';
import { getFeatureCredits } from '@/lib/credits-config';
import { getUserCredits } from '@/lib/user-db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const audioUrl = formData.get('audioUrl') as string | null;

    if (!file && !audioUrl) {
      return NextResponse.json({ error: 'No file or audio URL provided' }, { status: 400 });
    }

    // 文件大小限制：100MB
    if (file && file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 100MB limit' }, { status: 400 });
    }

    let processedAudioUrl: string;
    let filename: string;

    // 获取用户ID（用于最小落库与权限校验）
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // 检查积分
    const creditCost = getFeatureCredits('separate_vocals_from_music_local');
    const userCredits = await getUserCredits(userId);
    const credits = userCredits?.credits || 0;
    
    if (credits < creditCost) {
      return NextResponse.json(
        { 
          error: 'Insufficient credits',
          required: creditCost,
          current: credits
        },
        { status: 403 }
      );
    }

    if (file) {
      // 上传文件到KIE，获取临时链接
      const uploadResult = await vocalSeparationService.uploadFileToKIE(file);
      processedAudioUrl = uploadResult.data.downloadUrl || uploadResult.data.fileUrl;
      filename = file.name;
    } else if (audioUrl) {
      processedAudioUrl = audioUrl;
      filename = audioUrl.split('/').pop() || 'audio';
    } else {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    // 先创建数据库记录（processing状态）
    let predictionId: string;
    try {
      // 创建Replicate预测（带webhook）
      const webhookUrl = `${process.env.CallBackURL}/api/vocal-separation-callback`;
      
      const prediction = await vocalSeparationService.createReplicatePrediction(
        processedAudioUrl, 
        webhookUrl
      );
      
      predictionId = prediction.id;

      // 创建数据库记录，使用真实的predictionId
      await createVocalSeparation(userId, {
        prediction_id: predictionId,
        status: 'processing',
        original_audio_url: processedAudioUrl,
        original_filename: filename,
      });

    } catch (e) {
      console.error('[vocal-separation] failed to create separation:', e);
      throw e;
    }

    return NextResponse.json({ 
      success: true,
      data: {
        predictionId,
        status: 'processing',
        originalAudioUrl: processedAudioUrl,
        originalFilename: filename,
        message: 'Separation started. You will be notified when complete.'
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Vocal separation API error:', error);
    return NextResponse.json({ 
      error: (error as Error).message || 'Internal server error' 
    }, { status: 500 });
  }
}