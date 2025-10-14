import { NextRequest, NextResponse } from 'next/server';
import { getUserCredits } from '@/lib/user-db';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 从Authorization header获取token
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[user-credits] No authorization header provided');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];

    // 为后端API创建独立的supabase客户端，确保使用最新的环境变量
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[user-credits] Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 验证token
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
      console.error('[user-credits] Token validation error:', error.message);
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }

    if (!user) {
      console.error('[user-credits] No user found for token');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 获取用户积分
    const userCredits = await getUserCredits(user.id);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        credits: userCredits?.credits || 0
      }
    });

  } catch (error) {
    console.error('Error fetching user credits:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
