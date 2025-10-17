import { NextRequest, NextResponse } from 'next/server';
import { addUserCredits } from '@/lib/user-db';
import { createOrUpdateUserSubscription } from '@/lib/subscription-credits';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const webhookData = await request.json();
    
    console.log('Creem webhook received:', webhookData);

    // 验证 webhook 签名（可选，但推荐）
    const signature = request.headers.get('x-creem-signature');
    if (process.env.CREEM_WEBHOOK_SECRET && signature) {
      // 这里可以添加签名验证逻辑
      // const expectedSignature = crypto
      //   .createHmac('sha256', process.env.CREEM_WEBHOOK_SECRET)
      //   .update(JSON.stringify(webhookData))
      //   .digest('hex');
      
      // if (signature !== expectedSignature) {
      //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      // }
    }

    // 处理支付完成事件
    if (webhookData.type === 'checkout.completed') {
      const { request_id, metadata } = webhookData.data;
      
      if (!metadata || !metadata.userId || !metadata.creditsAmount) {
        console.error('Missing metadata in webhook:', webhookData);
        return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
      }

      const { userId, creditsAmount, userEmail } = metadata;

      try {
        // 使用现有的 addUserCredits 函数充值积分
        const success = await addUserCredits(
          userId,
          creditsAmount,
          `Credits purchase - ${creditsAmount} credits`,
          request_id,
          'creem_payment'
        );

        if (success) {
          console.log(`Successfully added ${creditsAmount} credits to user ${userId}`);
          
          // 检查是否是订阅支付（通过积分数量判断）
          const isSubscription = creditsAmount >= 1000; // 订阅通常积分更多
          
          if (isSubscription) {
            try {
              // 创建订阅记录
              const now = new Date();
              const subscriptionRecord = await createOrUpdateUserSubscription(userId, {
                subscriptionId: request_id,
                productId: metadata.productId || 'unknown',
                status: 'active',
                currentPeriodStart: now.toISOString(),
                currentPeriodEnd: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString() // 默认1年
              });
              
              console.log(`Created subscription record for user ${userId}:`, subscriptionRecord.id);
            } catch (subError) {
              console.error('Failed to create subscription record:', subError);
              // 不阻止积分添加，只是记录错误
            }
          }
          
          return NextResponse.json({ 
            received: true, 
            message: 'Credits added successfully' 
          });
        } else {
          console.error(`Failed to add credits for user ${userId}`);
          return NextResponse.json({ 
            error: 'Failed to add credits' 
          }, { status: 500 });
        }

      } catch (dbError) {
        console.error('Database error when adding credits:', dbError);
        return NextResponse.json({ 
          error: 'Database error' 
        }, { status: 500 });
      }
    }

    // 处理其他 webhook 事件类型
    if (webhookData.type === 'checkout.failed') {
      console.log('Payment failed:', webhookData.data);
      // 可以在这里处理支付失败的逻辑
    }

    if (webhookData.type === 'checkout.refunded') {
      console.log('Payment refunded:', webhookData.data);
      // 可以在这里处理退款的逻辑
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
