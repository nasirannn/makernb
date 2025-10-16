import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    
    // 创建 Supabase 客户端验证用户
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user || user.id !== userId) {
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

    console.log('Creem API request:', {
      url: 'https://api.creem.io/v1/checkouts',
      productId,
      userId,
      userEmail,
      creditsAmount
    });

    const creemResponse = await fetch('https://test-api.creem.io/v1/checkouts', {
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
