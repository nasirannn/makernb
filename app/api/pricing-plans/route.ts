import { NextResponse } from "next/server";
import { query } from "@/lib/db-query-builder";
import { getCreemApiBaseUrl } from "@/lib/creem";

export const dynamic = "force-dynamic";

type PricingMode = "test" | "prod" | "sandbox" | "local";

interface PricingPlanRow {
  code: string;
  name: string;
  product_id: string;
  billing_period: "monthly" | "yearly";
  credits_per_period: number | string;
  price: number | string;
  tier_code: string;
}

const resolvePricingMode = (): PricingMode => {
  const baseUrl = getCreemApiBaseUrl();

  if (/test-api\.creem\.io/i.test(baseUrl)) return "test";
  if (/sandbox/i.test(baseUrl)) return "sandbox";
  if (/localhost|127\.0\.0\.1/i.test(baseUrl)) return "local";
  return "prod";
};

export async function GET() {
  try {
    const mode = resolvePricingMode();
    const result = await query<PricingPlanRow>(
      `SELECT code, name, product_id, billing_period, credits_per_period, price, tier_code
       FROM subscription_plans
       WHERE is_active = TRUE AND mode = $1
       ORDER BY code`,
      [mode]
    );

    const plans = result.rows.map((row) => ({
      code: row.code,
      name: row.name,
      productId: row.product_id,
      billingPeriod: row.billing_period,
      credits: Number(row.credits_per_period),
      price: Number(row.price),
      tierCode: row.tier_code,
    }));

    return NextResponse.json({ mode, plans });
  } catch (error) {
    console.error("Failed to load pricing plans:", error);
    return NextResponse.json({ error: "Failed to load pricing plans" }, { status: 500 });
  }
}
