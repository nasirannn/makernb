import { NextRequest, NextResponse } from 'next/server';
import { getUserCredits } from '@/lib/user-db';
import { getUserInfoFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userInfo = await getUserInfoFromRequest(request);
    if (!userInfo) {
      console.error('[user-credits] Authentication failed');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 获取用户积分
    const userCredits = await getUserCredits(userInfo.userId);

    return NextResponse.json({
      user: {
        id: userInfo.userId,
        email: userInfo.email,
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
