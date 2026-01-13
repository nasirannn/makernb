import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { getUserTierId } from '@/lib/feature-permissions';
import { query } from '@/lib/db-query-builder';
import { normalizeTierCode } from '@/lib/subscription-tier';

// 强制动态渲染
export const dynamic = 'force-dynamic';

/**
 * 获取用户的订阅层级代码
 * 用于前端显示用户的订阅badge
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

    // 获取用户的订阅层级ID
    const tierId = await getUserTierId(userId);
    
    // 如果没有活跃订阅，返回 null
    if (!tierId) {
      return NextResponse.json({
        tierCode: null,
        userId
      });
    }

    // 通过 tier_id 查询 tier_code
    const result = await query(
      `SELECT code as tier_code
       FROM subscription_tiers
       WHERE id = $1::uuid`,
      [tierId]
    );

    if (result.rows.length > 0) {
      const tierCode = normalizeTierCode(result.rows[0].tier_code);
      return NextResponse.json({
        tierCode,
        userId
      });
    }

    // 如果找不到对应的tier，返回 null
    return NextResponse.json({
      tierCode: null,
      userId
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
