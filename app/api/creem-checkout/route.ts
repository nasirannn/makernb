import { NextRequest, NextResponse } from 'next/server';
import { creemUrl } from '@/lib/creem';
import { getUserInfoFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { productId, userId, userEmail, creditsAmount } = await request.json();

    // 验证必需参数
    if (!productId || !userId || !userEmail || !creditsAmount) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // 验证用户身份
    const userInfo = await getUserInfoFromRequest(request);
    if (!userInfo || userInfo.userId !== userId) {
      return NextResponse.json(
        { error: 'Invalid user' },
        { status: 401 }
      );
    }

    // 检查环境变量
    if (!process.env.CREEM_API_KEY) {
      console.error('CREEM_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (!process.env.NEXT_PUBLIC_BASE_URL) {
      console.error('NEXT_PUBLIC_BASE_URL is not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // 创建 Creem 支付会话
    const requestBody = {
      product_id: productId,
      request_id: `${userId}_${Date.now()}_${creditsAmount}`,
      metadata: {
        userId: userId,
        creditsAmount: creditsAmount,
        userEmail: userEmail
      },
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment/success`,
      customer: {
        email: userEmail
      }
    };

    const creemResponse = await fetch(creemUrl('/v1/checkouts'), {
      method: 'POST',
      headers: {
        'x-api-key': process.env.CREEM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!creemResponse.ok) {
      const errorData = await creemResponse.text();
      console.error('Creem API error:', {
        status: creemResponse.status,
        statusText: creemResponse.statusText,
        error: errorData,
        requestBody
      });
      return NextResponse.json(
        { error: `Failed to create checkout session: ${creemResponse.status} ${creemResponse.statusText}` },
        { status: 500 }
      );
    }

    const creemData = await creemResponse.json();

    return NextResponse.json({
      checkout_url: creemData.checkout_url,
      success: true
    });

  } catch (error) {
    console.error('Checkout creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
