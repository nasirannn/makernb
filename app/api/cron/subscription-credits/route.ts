import { NextRequest, NextResponse } from 'next/server';
import { processSubscriptionCreditGrants } from '@/lib/subscription-credits';

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
    console.log(`[CRON] Running subscription credit grant process at ${new Date().toISOString()}`);
    
    // 执行订阅积分发放
    const result = await processSubscriptionCreditGrants();
    
    const duration = Date.now() - startTime;
    const message = result.processedCount > 0 
      ? `Processed ${result.processedCount} subscriptions: ${result.successCount} successful, ${result.errorCount} failed in ${duration}ms`
      : `No subscriptions eligible for credit grant (checked in ${duration}ms)`;
    
    console.log(`[CRON] ${message}`);
    
    return NextResponse.json({
      success: true,
      message,
      ...result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in subscription credit grant cron job:', error);
    return NextResponse.json(
      { 
        error: 'Subscription credit grant failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
