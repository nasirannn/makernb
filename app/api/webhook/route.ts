import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { addUserCredits } from '@/lib/user-db';
import { createOrUpdateUserSubscription, cancelUserSubscription } from '@/lib/subscription-credits';

export const dynamic = 'force-dynamic';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getUserIdByEmail(email: string): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;

  const { query } = await import('@/lib/db-query-builder');
  const result = await query<{ id: string }>(
    'SELECT id FROM auth.users WHERE email = $1 LIMIT 1',
    [normalizedEmail]
  );
  return result.rows[0]?.id ?? null;
}

// Creem webhook handler at /api/webhook per docs
export async function POST(request: NextRequest) {
  try {
    // Read raw body first for signature verification
    const rawBody = await request.text();

    // Optional but recommended: verify signature if secret is configured
    const signature = request.headers.get('x-creem-signature') || request.headers.get('creem-signature');
    const webhookSecret = process.env.CREEM_WEBHOOK_SECRET;

    if (webhookSecret) {
      if (!signature) {
        return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
      }
      const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
      if (expected !== signature) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
      }
    }

    const event = JSON.parse(rawBody || '{}');
    console.log('Received webhook event:', event.eventType, event);

    // 处理订阅支付事件（推荐用于激活访问）
    if (event?.eventType === 'subscription.paid') {
      console.log('Processing subscription.paid event:', JSON.stringify(event, null, 2));
      
      const subscription = event.object;
      const product = subscription.product;
      const customer = subscription.customer;
      
      console.log('Subscription metadata:', subscription.metadata);
      console.log('Customer:', customer);
      
      // 从 metadata 获取积分数量，如果没有则根据产品计算
      let creditsAmount = 0;
      if (subscription.metadata?.creditsAmount) {
        creditsAmount = subscription.metadata.creditsAmount;
      } else {
        // 根据产品 ID 计算积分（备用方案）
        const productId = product.id;
        if (productId === process.env.NEXT_PUBLIC_MONTHLY_BASIC) creditsAmount = 1000;
        else if (productId === process.env.NEXT_PUBLIC_MONTHLY_PREMIUM) creditsAmount = 2500;
        else if (productId === process.env.NEXT_PUBLIC_YEARLY_BASIC) creditsAmount = 12000;
        else if (productId === process.env.NEXT_PUBLIC_YEARLY_PREMIUM) creditsAmount = 30000;
      }

      // 从 metadata 获取用户 ID
      let userId = subscription.metadata?.userId;
      
      console.log('subscription.paid - subscription.metadata:', subscription.metadata);
      console.log('subscription.paid - userId from metadata:', userId);
      console.log('subscription.paid - customer:', customer);
      
      // 如果 metadata.userId 不是 UUID，尝试将其当作 email 查找
      if (userId && !uuidRegex.test(userId)) {
        if (userId.includes('@')) {
          const resolved = await getUserIdByEmail(userId);
          if (resolved) {
            userId = resolved;
          } else {
            console.error('userId looked like email but no user found:', userId);
            return NextResponse.json({ error: 'User not found for email' }, { status: 400 });
          }
        } else {
          console.error('Invalid userId format (not UUID):', userId);
          console.error('This might be a subscription ID instead of user ID');
          return NextResponse.json({ error: 'Invalid userId format' }, { status: 400 });
        }
      }

      // 如果 metadata 中没有 userId，尝试通过 customer.email 查找
      if (!userId && customer?.email) {
        const resolved = await getUserIdByEmail(customer.email);
        if (resolved) {
          userId = resolved;
        } else {
          console.error('Missing userId in metadata and no user found for customer email:', customer.email);
          return NextResponse.json({ error: 'Missing userId in metadata' }, { status: 400 });
        }
      }
      
      if (!userId || !uuidRegex.test(userId)) {
        console.error('Missing userId in subscription.metadata and no customer email:', event);
        return NextResponse.json({ error: 'Missing userId in metadata' }, { status: 400 });
      }
      
      console.log('Final userId being passed to addUserCredits:', userId);

      try {
        // 检查是否已经处理过这个订阅
        const { query } = await import('@/lib/db-query-builder');
        const existingTransaction = await query(
          'SELECT id FROM credit_transactions WHERE reference_id = $1 AND transaction_type = $2',
          [subscription.id, 'subscription']
        );
        
        if (existingTransaction.rows.length > 0) {
          console.log(`Subscription ${subscription.id} already processed, skipping`);
          return NextResponse.json({ received: true, message: 'Already processed' });
        }

        // 创建或更新订阅记录
        // 处理日期值，确保它们是有效的
        const now = new Date();
        const currentPeriodStart = subscription.current_period_start 
          ? new Date(subscription.current_period_start).toISOString()
          : now.toISOString();
        
        const currentPeriodEnd = subscription.current_period_end 
          ? new Date(subscription.current_period_end).toISOString()
          : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 默认1年后
        
        console.log('Subscription dates:', {
          currentPeriodStart,
          currentPeriodEnd,
          originalStart: subscription.current_period_start,
          originalEnd: subscription.current_period_end
        });

        const subscriptionRecord = await createOrUpdateUserSubscription(userId, {
          subscriptionId: subscription.id,
          productId: product.id,
          status: 'active',
          currentPeriodStart,
          currentPeriodEnd
        });

        console.log(`Created/updated subscription record for user ${userId}:`, subscriptionRecord.id);

        // 发放首次积分
        const billingPeriod = product.billing_period === 'every-month' ? 'monthly' : 'yearly';
        const success = await addUserCredits(
          userId,
          creditsAmount,
          `Initial subscription credits - ${billingPeriod}`,
          subscription.id,
          'subscription',
          { billingPeriod, creditsAmount }
        );

        if (!success) {
          return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 });
        }

        console.log(`Successfully added ${creditsAmount} credits to user ${userId} for ${billingPeriod} subscription`);
      } catch (e) {
        console.error('Database error when adding subscription credits:', e);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      return NextResponse.json({ received: true, message: 'Subscription credits added successfully' });
    }


    // 处理订阅取消
    if (event?.type === 'subscription.canceled') {
      const data = event.data || {};
      const meta = (data.metadata || {}) as { userId?: string };
      
      console.log(`Subscription canceled for user ${meta.userId}:`, data);
      
      if (meta.userId && data.id) {
        try {
          // 取消用户订阅
          const success = await cancelUserSubscription(meta.userId, data.id);
          if (success) {
            console.log(`Successfully canceled subscription ${data.id} for user ${meta.userId}`);
          } else {
            console.log(`No subscription found to cancel for user ${meta.userId}`);
          }
        } catch (error) {
          console.error('Error canceling subscription:', error);
        }
      }
      
      return NextResponse.json({ received: true, message: 'Subscription canceled' });
    }

    // 处理 checkout.completed（仅用于同步，不发放积分）
    if (event?.type === 'checkout.completed') {
      const data = event.data || {};
      console.log('Checkout completed for synchronization:', data.id);
      
      // 根据 Creem 文档，checkout.completed 仅用于同步
      // 积分发放应该使用 subscription.paid 事件
      return NextResponse.json({ received: true, message: 'Checkout completed - sync only' });
    }

    // 处理支付失败
    if (event?.type === 'checkout.failed') {
      console.log('Payment failed:', event.data);
      return NextResponse.json({ received: true });
    }

    // 处理退款
    if (event?.type === 'checkout.refunded') {
      const data = event.data || {};
      const meta = (data.metadata || {}) as { userId?: string; creditsAmount?: number };
      
      console.log('Payment refunded:', data);
      
      if (meta.userId && meta.creditsAmount) {
        try {
          // 扣除用户积分（退款）
          const success = await addUserCredits(
            meta.userId,
            -meta.creditsAmount, // 负数表示扣除
            `Refund - ${meta.creditsAmount} credits deducted`,
            data.id,
            'refund'
          );

          if (!success) {
            console.error(`Failed to deduct credits for refund for user ${meta.userId}`);
            return NextResponse.json({ error: 'Failed to process refund' }, { status: 500 });
          }

          console.log(`Successfully deducted ${meta.creditsAmount} credits from user ${meta.userId} due to refund`);
        } catch (e) {
          console.error('Database error when processing refund:', e);
          return NextResponse.json({ error: 'Database error during refund' }, { status: 500 });
        }
      }
      
      return NextResponse.json({ received: true, message: 'Refund processed successfully' });
    }

    // Unknown or unhandled event types
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

