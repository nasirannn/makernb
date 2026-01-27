import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { query } from '@/lib/db-query-builder';
import type { SubscriptionTier } from '@/lib/subscription-tier';

// 强制动态渲染
export const dynamic = 'force-dynamic';

const getTierFromPlanId = (planId?: string | null): SubscriptionTier | null => {
  if (!planId) return null;
  const normalized = planId.trim().toLowerCase();
  if (normalized.includes('hobby') || normalized.includes('premium')) return 'hobby';
  if (normalized.includes('starter') || normalized.includes('basic')) return 'starter';
  return null;
};

const getTierName = (tierCode: SubscriptionTier | null): string => {
  if (tierCode === 'starter') return 'Starter';
  if (tierCode === 'hobby') return 'Hobby';
  return 'Subscribed';
};

/**
 * 获取用户的订阅层级代码与名称
 * 用于前端显示用户的订阅 badge
 * 如果没有活跃订阅，返回 null
 */
export async function GET(request: NextRequest) {
  try {
    // 获取用户ID
    const userId = await getUserIdFromRequest(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const subscriptionResult = await query<{
      plan_id: string | null;
      product_id: string | null;
      cancel_at_period_end: boolean | null;
      cancel_at: string | null;
      current_period_end: string | null;
    }>(
      `SELECT plan_id, product_id, cancel_at_period_end, cancel_at, current_period_end
       FROM user_subscriptions
       WHERE user_id = $1::uuid
       AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    const activeSubscription = subscriptionResult.rows[0];

    if (!activeSubscription) {
      return NextResponse.json({
        tierCode: null,
        tierName: "Free",
        hasSubscription: false,
        userId,
        planId: null,
        productId: null,
        cancelAtPeriodEnd: false,
        cancelAt: null,
        currentPeriodEnd: null
      });
    }

    const tierCode = getTierFromPlanId(activeSubscription.plan_id);
    const tierName = getTierName(tierCode);
    return NextResponse.json({
      tierCode,
      tierName,
      hasSubscription: true,
      userId,
      planId: activeSubscription.plan_id,
      productId: activeSubscription.product_id,
      cancelAtPeriodEnd: Boolean(activeSubscription.cancel_at_period_end),
      cancelAt: activeSubscription.cancel_at,
      currentPeriodEnd: activeSubscription.current_period_end
    });

  } catch (error) {
    console.error('[USER-SUBSCRIPTION] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch user subscription',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
