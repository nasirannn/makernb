import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { creemUrl } from '@/lib/creem';
import { query } from '@/lib/db-query-builder';
import { getSubscriptionPlanByProductIdAnyMode } from '@/lib/subscription-credits';
import { getTierFromPlan } from '@/lib/subscription-tier';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.CREEM_API_KEY) {
      console.error('CREEM_API_KEY is not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { productId } = await request.json();
    if (!productId || typeof productId !== 'string') {
      return NextResponse.json({ error: 'Missing product id' }, { status: 400 });
    }

    const targetPlan = await getSubscriptionPlanByProductIdAnyMode(productId);
    if (!targetPlan) {
      return NextResponse.json({ error: 'Invalid target plan' }, { status: 400 });
    }

    const subscriptionResult = await query<{
      subscription_id: string;
      product_id: string;
    }>(
      `SELECT subscription_id, product_id
       FROM user_subscriptions
       WHERE user_id = $1::uuid AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    const subscriptionRecord = subscriptionResult.rows[0];
    if (!subscriptionRecord?.subscription_id) {
      return NextResponse.json({ error: 'Active subscription not found' }, { status: 404 });
    }

    if (subscriptionRecord.product_id === productId) {
      return NextResponse.json({ success: true, alreadyActive: true });
    }

    const currentPlan = await getSubscriptionPlanByProductIdAnyMode(subscriptionRecord.product_id);
    if (!currentPlan) {
      return NextResponse.json({ error: 'Current plan not found' }, { status: 400 });
    }

    const currentTier = getTierFromPlan(currentPlan);
    const targetTier = getTierFromPlan(targetPlan);
    if (!currentTier || !targetTier) {
      return NextResponse.json({ error: 'Unable to resolve subscription tier' }, { status: 400 });
    }
    if (currentTier !== targetTier) {
      return NextResponse.json({ error: 'Switch plan only supports same-tier changes' }, { status: 400 });
    }

    const upgradeResponse = await fetch(
      creemUrl(`/v1/subscriptions/${subscriptionRecord.subscription_id}/upgrade`),
      {
        method: 'POST',
        headers: {
          'x-api-key': process.env.CREEM_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: productId,
          update_behavior: 'proration-none',
        }),
      }
    );

    if (!upgradeResponse.ok) {
      const errorText = await upgradeResponse.text();
      console.error('[SWITCH-SUBSCRIPTION] Creem error:', upgradeResponse.status, errorText);
      return NextResponse.json(
        { error: 'Failed to switch subscription' },
        { status: 500 }
      );
    }

    const subscription = await upgradeResponse.json();
    return NextResponse.json({ success: true, subscription });
  } catch (error) {
    console.error('[SWITCH-SUBSCRIPTION] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
