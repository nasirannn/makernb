import { NextResponse } from "next/server";
import { getPricingPlans } from "@/lib/pricing-plans";

export const revalidate = 300;

export async function GET() {
  try {
    const { plans } = await getPricingPlans();
    const response = NextResponse.json({ plans });
    response.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return response;
  } catch (error) {
    console.error("Failed to load pricing plans:", error);
    return NextResponse.json({ error: "Failed to load pricing plans" }, { status: 500 });
  }
}
