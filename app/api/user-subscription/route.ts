import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { query } from '@/lib/db-query-builder';
import { normalizeTierCode } from '@/lib/subscription-tier';

// 强制动态渲染
export const dynamic = 'force-dynamic';

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
      tier_id: string | null;
      plan_id: string | null;
      product_id: string | null;
      cancel_at_period_end: boolean | null;
      cancel_at: string | null;
      current_period_end: string | null;
    }>(
      `SELECT tier_id, plan_id, product_id, cancel_at_period_end, cancel_at, current_period_end
       FROM user_subscriptions
       WHERE user_id = $1::uuid
       AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    const activeSubscription = subscriptionResult.rows[0];

    if (!activeSubscription?.tier_id) {
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

    // 通过 tier_id 查询 tier_code
    const result = await query(
      `SELECT code as tier_code,
              name as tier_name
       FROM subscription_tiers
       WHERE id = $1::uuid`,
      [activeSubscription.tier_id]
    );

    if (result.rows.length > 0) {
      const tierCode = normalizeTierCode(result.rows[0].tier_code);
      const tierName = result.rows[0].tier_name || "Subscribed";
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
    }

    // 如果找不到对应的tier，返回 null
    return NextResponse.json({
      tierCode: null,
      tierName: "Subscribed",
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
