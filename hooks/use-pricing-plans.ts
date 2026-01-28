"use client";

import { useEffect, useMemo, useState } from "react";
import { buildPricingPlan, type PricingPlan, type PricingPlanApi } from "@/lib/pricing-config";

interface PricingPlansResponse {
  plans: PricingPlanApi[];
}

export const usePricingPlans = (initialPlans?: PricingPlan[]) => {
  const [plans, setPlans] = useState<PricingPlan[]>(() => initialPlans ?? []);
  const [isLoading, setIsLoading] = useState(!initialPlans?.length);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const hasInitialPlans = Boolean(initialPlans?.length);

    if (hasInitialPlans) {
      return () => {
        active = false;
      };
    }

    const fetchPlans = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/pricing-plans", {
          method: "GET",
          cache: "force-cache",
        });

        if (!response.ok) {
          throw new Error(`Failed to load pricing plans (${response.status})`);
        }

        const data = (await response.json()) as PricingPlansResponse;
        const mapped = data.plans.map(buildPricingPlan).sort((a, b) => a.rank - b.rank);

        if (active) {
          setPlans(mapped);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load pricing plans");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    fetchPlans();

    return () => {
      active = false;
    };
  }, [initialPlans]);

  const monthlyPlans = useMemo(
    () => plans.filter((plan) => plan.billingPeriod === "monthly"),
    [plans]
  );
  const yearlyPlans = useMemo(
    () => plans.filter((plan) => plan.billingPeriod === "yearly"),
    [plans]
  );

  return { plans, monthlyPlans, yearlyPlans, isLoading, error };
};
