import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredDailyCreditsForUser, grantDailyLoginCredits, hasReceivedTodayCredits } from '@/lib/daily-login-credits';
import { getUserIdFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      console.error('[daily-login-credits] Authentication failed');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    try {
      await cleanupExpiredDailyCreditsForUser(userId);
    } catch (cleanupError) {
      console.error('[daily-login-credits] Failed to cleanup expired credits for user:', cleanupError);
    }

    // 尝试发放每日登录积分
    const credits = await grantDailyLoginCredits(userId);
    
    if (!credits) {
      // 检查是否已经获得今日积分
      const hasCredits = await hasReceivedTodayCredits(userId);
      
      if (hasCredits) {
        return NextResponse.json({
          success: false,
          message: 'Already received today\'s login credits',
          alreadyReceived: true
        });
      } else {
        // 可能是管理员用户
        return NextResponse.json({
          success: false,
          message: 'Not eligible for daily login credits',
          alreadyReceived: false
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Daily login credits granted successfully',
      reward: {
        id: credits.id,
        credits_awarded: credits.daily_credits,
        reward_date: credits.last_login_date,
        expires_tomorrow: true
      },
      alreadyReceived: false
    });

  } catch (error) {
    console.error('Error processing daily login credits:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      console.error('[daily-login-credits GET] Authentication failed');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 检查今日是否已获得积分
    const hasCredits = await hasReceivedTodayCredits(userId);
    
    return NextResponse.json({
      hasReceivedToday: hasCredits,
      isEligible: true
    });

  } catch (error) {
    console.error('Error checking daily login credits status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
