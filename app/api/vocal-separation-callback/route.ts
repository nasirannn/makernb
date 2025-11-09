import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-query-builder';
import { addUserCredits } from '@/lib/user-db';
import { updateVocalSeparationByPredictionId } from '@/lib/vocal-separation-db';
import { getFeatureCredits } from '@/lib/credits-config';

// Cache for processed predictions to handle idempotency
const processedPredictions = new Set<string>();

export async function POST(request: NextRequest) {
  const callbackId = `vocal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const body = await request.json();
    console.log(`[CALLBACK-${callbackId}] Received webhook:`, JSON.stringify(body, null, 2));

    const { id: predictionId, status, output, error } = body;

    if (!predictionId) {
      console.error(`[CALLBACK-${callbackId}] Missing prediction ID`);
      return NextResponse.json({ error: 'Missing prediction ID' }, { status: 400 });
    }

    // 检查是否已经处理过这个prediction
    if (processedPredictions.has(predictionId)) {
      console.log(`[CALLBACK-${callbackId}] Prediction ${predictionId} already processed, skipping`);
      return NextResponse.json({ message: 'Already processed' }, { status: 200 });
    }

    if (status === 'succeeded' && output) {
      console.log(`[CALLBACK-${callbackId}] Processing successful separation for prediction ${predictionId}`);
      
      // 通过predictionId查库获得user_id
      const userId = await getUserIdByPredictionId(predictionId);
      
      if (userId) {
        // 扣除积分
        const creditCost = getFeatureCredits('separate_vocals_from_music_local');
        await addUserCredits(
          userId, 
          -creditCost, 
          'Vocal separation', 
          predictionId, 
          'separate_vocals_from_music_local'
        );
        console.log(`[CALLBACK-${callbackId}] Deducted ${creditCost} credits from user ${userId}`);
      }

      // 更新数据库记录
      try {
        console.log(`[CALLBACK-${callbackId}] Updating separation with data:`, {
          predictionId,
          status: 'completed',
          vocal_audio_url: output.vocals,
          instrumental_audio_url: output.accompaniment
        });
        
        const result = await updateVocalSeparationByPredictionId(predictionId, {
          status: 'completed',
          vocal_audio_url: output.vocals,
          instrumental_audio_url: output.accompaniment
        });
        
        console.log(`[CALLBACK-${callbackId}] Successfully updated separation:`, result);
        
        // 只有在数据库更新成功后才标记为已处理
        processedPredictions.add(predictionId);
        
      } catch (e) {
        console.error(`[CALLBACK-${callbackId}] Failed to update separation row:`, e);
        console.error(`[CALLBACK-${callbackId}] Error details:`, {
          predictionId,
          status: 'completed',
          vocal_audio_url: output.vocals,
          instrumental_audio_url: output.accompaniment,
          error: e
        });
        
        // 数据库更新失败，不标记为已处理，允许重试
        console.log(`[CALLBACK-${callbackId}] Database update failed, will retry on next webhook`);
      }
      
      console.log(`[CALLBACK-${callbackId}] Successfully processed separation for prediction ${predictionId}`);
      
    } else if (status === 'failed') {
      console.error(`[CALLBACK-${callbackId}] Separation failed for prediction ${predictionId}:`, error);
      
      // 标记失败
      try {
        await updateVocalSeparationByPredictionId(predictionId, {
          status: 'error'
        });
        
        // 失败也标记为已处理，避免重复处理
        processedPredictions.add(predictionId);
        
      } catch (e) {
        console.error(`[CALLBACK-${callbackId}] Failed to update separation status to error:`, e);
      }
    }

    return NextResponse.json({ message: 'Webhook processed successfully' }, { status: 200 });

  } catch (error) {
    console.error(`[CALLBACK-${callbackId}] Webhook processing error:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 从prediction ID获取用户ID（需要根据你的业务逻辑实现）
async function getUserIdByPredictionId(predictionId: string): Promise<string | null> {
  try {
    const res = await query('SELECT user_id FROM vocal_separations WHERE prediction_id = $1 LIMIT 1', [predictionId]);
    if (res.rows.length > 0) return res.rows[0].user_id as string;
    return null;
  } catch (error) {
    console.error('Failed to get user ID from predictionId:', error);
    return null;
  }
}

// 存储分离结果
async function storeSeparationResult(predictionId: string, output: any, userId: string | null) {
  try {
    // 如果需要存储到数据库，在这里实现
    console.log('Storing separation result:', { predictionId, output, userId });
  } catch (error) {
    console.error('Failed to store separation result:', error);
  }
}

// 存储错误信息
async function storeSeparationError(predictionId: string, error: string) {
  try {
    // 如果需要存储错误信息到数据库，在这里实现
    console.log('Storing separation error:', { predictionId, error });
  } catch (error) {
    console.error('Failed to store separation error:', error);
  }
}