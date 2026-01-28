export type SubscriptionTier = "starter" | "hobby";

const normalizeTierSource = (value?: string | null): string => (value || "").trim().toLowerCase();

/**
 * Normalize tier codes coming from DB / legacy values.
 * - New codes: starter, hobby
 * - Legacy codes: basic -> starter, premium -> hobby
 */
export function normalizeTierCode(value: unknown): SubscriptionTier | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();

  if (normalized === "starter") return "starter";
  if (normalized === "hobby") return "hobby";

  if (normalized === "basic") return "starter";
  if (normalized === "premium") return "hobby";

  return null;
}

export function getTierFromPlanId(planId?: string | null): SubscriptionTier | null {
  const normalized = normalizeTierSource(planId);
  if (!normalized) return null;
  if (normalized.includes("hobby") || normalized.includes("premium")) return "hobby";
  if (normalized.includes("starter") || normalized.includes("basic")) return "starter";
  return null;
}

export function getTierFromPlan(plan: { code?: string | null; tier_code?: string | null }): SubscriptionTier | null {
  const tierCode = normalizeTierCode(plan.tier_code);
  if (tierCode) return tierCode;
  return getTierFromPlanId(plan.code);
}
