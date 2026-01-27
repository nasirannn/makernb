import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { creemUrl } from '@/lib/creem';
import { scheduleSubscriptionCancellation } from '@/lib/subscription-credits';
import { query } from '@/lib/db-query-builder';

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

    const subscriptionResult = await query<{
      subscription_id: string;
      cancel_at_period_end: boolean | null;
      cancel_at: string | null;
    }>(
      `SELECT subscription_id, cancel_at_period_end, cancel_at
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

    if (subscriptionRecord.cancel_at_period_end) {
      return NextResponse.json({
        success: true,
        alreadyScheduled: true,
        cancelAt: subscriptionRecord.cancel_at,
      });
    }

    const cancelResponse = await fetch(
      creemUrl(`/v1/subscriptions/${subscriptionRecord.subscription_id}/cancel`),
      {
        method: 'POST',
        headers: {
          'x-api-key': process.env.CREEM_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'scheduled',
          onExecute: 'cancel',
        }),
      }
    );

    if (!cancelResponse.ok) {
      const errorText = await cancelResponse.text();
      console.error('[CANCEL-SUBSCRIPTION] Creem error:', cancelResponse.status, errorText);
      return NextResponse.json(
        { error: 'Failed to schedule cancellation' },
        { status: 500 }
      );
    }

    const subscription = await cancelResponse.json();
    const cancelAt = subscription?.current_period_end_date
      ? new Date(subscription.current_period_end_date).toISOString()
      : subscriptionRecord.cancel_at;

    const scheduled = await scheduleSubscriptionCancellation(
      userId,
      subscriptionRecord.subscription_id,
      cancelAt || null
    );

    if (!scheduled) {
      return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      cancelAt: scheduled.cancel_at || cancelAt || null,
    });
  } catch (error) {
    console.error('[CANCEL-SUBSCRIPTION] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
