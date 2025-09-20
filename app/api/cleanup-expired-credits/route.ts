import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredDailyCredits } from '@/lib/daily-login-credits';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 验证请求来源（可以添加API密钥验证）
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CLEANUP_API_TOKEN || 'cleanup-token-2024';
    
    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 执行清理过期积分
    const cleanedCount = await cleanupExpiredDailyCredits();
    
    return NextResponse.json({
      success: true,
      message: `Cleaned up ${cleanedCount} expired daily login credits`,
      cleanedCount
    });

  } catch (error) {
    console.error('Error cleaning up expired credits:', error);
    return NextResponse.json(
      { 
        error: 'Cleanup failed', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
