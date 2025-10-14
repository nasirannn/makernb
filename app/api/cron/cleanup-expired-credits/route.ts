import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredDailyCredits } from '@/lib/daily-login-credits';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 验证请求来源（Vercel Cron或本地测试）
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // 在生产环境中验证cron secret
    if (process.env.NODE_ENV === 'production') {
      if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const startTime = Date.now();
    console.log(`[CRON] Running scheduled cleanup of expired daily credits at ${new Date().toISOString()}`);
    
    // 执行清理过期积分
    const cleanedCount = await cleanupExpiredDailyCredits();
    
    const duration = Date.now() - startTime;
    const message = cleanedCount > 0 
      ? `Successfully cleaned up ${cleanedCount} expired daily login credits in ${duration}ms`
      : `No expired daily login credits to clean up (checked in ${duration}ms)`;
    
    console.log(`[CRON] ${message}`);
    
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
