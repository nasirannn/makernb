import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { grantDailyLoginCredits, hasReceivedTodayCredits } from '@/lib/daily-login-credits';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 从Authorization header获取token
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[daily-login-credits] No authorization header provided');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    
    // 为后端API创建独立的supabase客户端
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[daily-login-credits] Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // 验证token
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
      console.error('[daily-login-credits] Token validation error:', error.message);
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }

    if (!user) {
      console.error('[daily-login-credits] No user found for token');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 检查是否是管理员用户，如果是则直接返回
    const adminId = process.env.ADMIN_ID;
    if (adminId && user.id === adminId) {
      console.log('Admin user, skipping daily login credits');
      return NextResponse.json({
        success: false,
        message: 'Admin users are not eligible for daily login credits',
        alreadyReceived: false
      });
    }

    // 尝试发放每日登录积分
    const credits = await grantDailyLoginCredits(user.id);
    
    if (!credits) {
      // 检查是否已经获得今日积分
      const hasCredits = await hasReceivedTodayCredits(user.id);
      
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
    // 从Authorization header获取token
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[daily-login-credits GET] No authorization header provided');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    
    // 为后端API创建独立的supabase客户端
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[daily-login-credits GET] Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // 验证token
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.error('[daily-login-credits GET] Token validation error:', error.message);
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }

    if (!user) {
      console.error('[daily-login-credits GET] No user found for token');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 检查今日是否已获得积分
    const hasCredits = await hasReceivedTodayCredits(user.id);
    
    return NextResponse.json({
      hasReceivedToday: hasCredits,
      isEligible: user.id !== process.env.ADMIN_ID // 管理员不符合条件
    });

  } catch (error) {
    console.error('Error checking daily login credits status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
