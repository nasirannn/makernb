import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredDailyCredits } from '@/lib/daily-login-credits';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 验证请求来源（Vercel Cron或本地测试）
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'cron-secret-2024';
    
    // 在生产环境中验证cron secret
    if (process.env.NODE_ENV === 'production') {
      if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log('Running scheduled cleanup of expired daily credits...');
    
    // 执行清理过期积分
    const cleanedCount = await cleanupExpiredDailyCredits();
    
    const message = cleanedCount > 0 
      ? `Successfully cleaned up ${cleanedCount} expired daily login credits`
      : 'No expired daily login credits to clean up';
    
    console.log(message);
    
    return NextResponse.json({
      success: true,
      message,
      cleanedCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in scheduled cleanup:', error);
    return NextResponse.json(
      { 
        error: 'Cleanup failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
