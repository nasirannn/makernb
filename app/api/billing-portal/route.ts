import { NextRequest, NextResponse } from 'next/server';
import { creemUrl } from '@/lib/creem';
import { query } from '@/lib/db-query-builder';
import { getUserInfoFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const userInfo = await getUserInfoFromRequest(request);
    if (!userInfo) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const apiKey = process.env.CREEM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Billing portal is not configured' }, { status: 500 });
    }

    const subscriptionResult = await query<{ customer_id: string | null }>(
      `SELECT customer_id
       FROM user_subscriptions
       WHERE user_id = $1::uuid
       AND status = 'active'
       AND customer_id IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [userInfo.userId]
    );

    let customerId = subscriptionResult.rows[0]?.customer_id || null;

    if (!customerId && userInfo.email) {
      const customerResponse = await fetch(
        creemUrl(`/v1/customers?email=${encodeURIComponent(userInfo.email)}`),
        {
          method: 'GET',
          headers: {
            'x-api-key': apiKey,
          },
        }
      );

      if (customerResponse.ok) {
        const customerData = await customerResponse.json();
        customerId =
          customerData?.id ||
          customerData?.customer?.id ||
          customerData?.data?.[0]?.id ||
          customerData?.customers?.[0]?.id ||
          null;
      }

      if (customerId) {
        await query(
          `UPDATE user_subscriptions
           SET customer_id = $1
           WHERE user_id = $2::uuid
           AND status = 'active'
           AND customer_id IS NULL`,
          [customerId, userInfo.userId]
        );
      }
    }

    if (!customerId) {
      const fallbackUrl = process.env.CREEM_BILLING_PORTAL_URL;
      if (fallbackUrl) {
        const url = fallbackUrl.includes('{{email}}')
          ? fallbackUrl.replace('{{email}}', encodeURIComponent(userInfo.email || ''))
          : fallbackUrl;
        return NextResponse.json({ url });
      }

      return NextResponse.json({ error: 'Customer portal is unavailable' }, { status: 404 });
    }

    const portalResponse = await fetch(creemUrl('/v1/customers/billing'), {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ customer_id: customerId }),
    });

    if (!portalResponse.ok) {
      const errorText = await portalResponse.text();
      console.error('[BILLING-PORTAL] Creem error:', portalResponse.status, errorText);
      return NextResponse.json({ error: 'Failed to open billing portal' }, { status: 500 });
    }

    const portalData = await portalResponse.json();
    const url = portalData?.customer_portal_link || portalData?.customerPortalLink || portalData?.url;

    if (!url) {
      return NextResponse.json({ error: 'Failed to open billing portal' }, { status: 500 });
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error('[BILLING-PORTAL] Error:', error);
    return NextResponse.json({ error: 'Failed to open billing portal' }, { status: 500 });
  }
}
