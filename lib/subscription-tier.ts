export type SubscriptionTier = "starter" | "hobby";

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

