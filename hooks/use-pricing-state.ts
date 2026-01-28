"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/contexts/CreditsContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { createBillingPortalLink, createCheckoutSession, scheduleCancellation, switchSubscription } from "@/lib/subscription-actions";
import { type PricingPlan } from "@/lib/pricing-config";
import { usePricingPlans } from "@/hooks/use-pricing-plans";
import { toast } from "sonner";

const tierRankMap: Record<string, number> = {
  starter: 1,
  hobby: 2,
};

const formatUsdAmount = (amount: number) => {
  const rounded = Math.round(amount * 100) / 100;
  return rounded.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const formatDisplayDate = (dateValue: string | null | undefined) => {
  if (!dateValue) return null;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

export const usePricingState = (options?: { initialPlans?: PricingPlan[] }) => {
  const { initialPlans } = options ?? {};
  const { user } = useAuth();
  useCredits();
  const { tierCode, hasSubscription, productId: activeProductId, cancelAtPeriodEnd, cancelAt, currentPeriodEnd, refreshSubscription } = useSubscription();
  const [loading, setLoading] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("yearly");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const { monthlyPlans, yearlyPlans } = usePricingPlans(initialPlans);

  const currentPlans = billingPeriod === "monthly" ? monthlyPlans : yearlyPlans;
  const allPlans = useMemo(() => [...monthlyPlans, ...yearlyPlans], [monthlyPlans, yearlyPlans]);
  const activePlanRank = useMemo(() => {
    if (activeProductId) {
      return allPlans.find((plan) => plan.productId === activeProductId)?.rank ?? null;
    }
    return tierCode ? tierRankMap[tierCode] ?? null : null;
  }, [activeProductId, allPlans, tierCode]);

  const scheduledCancellationCopy = cancelAt
    ? `Scheduled to cancel on ${formatDisplayDate(cancelAt) ?? cancelAt}`
    : "Cancellation scheduled.";
  const nextChargeCopy = currentPeriodEnd
    ? `Next charge on ${formatDisplayDate(currentPeriodEnd) ?? currentPeriodEnd}.`
    : "Next charge scheduled.";

  const handlePurchase = async (plan: PricingPlan) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    setLoading(plan.id);

    try {
      if (!user.email) {
        throw new Error("Missing user email");
      }
      const checkoutUrl = await createCheckoutSession({
        productId: plan.productId,
        userId: user.id,
        userEmail: user.email,
        creditsAmount: plan.credits,
      });

      window.location.href = checkoutUrl;
    } catch (error) {
      console.error("Purchase error:", error);
      setLoading(null);
    }
  };

  const handleManageSubscription = async (planId: string) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    setLoading(planId);

    try {
      const url = await createBillingPortalLink();
      window.location.href = url;
    } catch (error) {
      console.error("Manage subscription error:", error);
      setLoading(null);
    }
  };

  const handleSwitchPlan = async (plan: PricingPlan) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    setLoading(plan.id);

    try {
      await switchSubscription(plan.productId);
    } catch (error) {
      console.error("Switch subscription error:", error);
    } finally {
      setLoading(null);
    }
  };

  const handleScheduleCancellation = async (): Promise<boolean> => {
    if (!user) {
      setIsAuthModalOpen(true);
      return false;
    }

    if (!hasSubscription) {
      return false;
    }

    setCancelLoading(true);

    try {
      await scheduleCancellation();
      return true;
    } catch (error) {
      console.error("Schedule cancellation error:", error);
      return false;
    } finally {
      setCancelLoading(false);
    }
  };

  const handleCancelConfirm = async () => {
    const success = await handleScheduleCancellation();
    if (success) {
      setIsCancelDialogOpen(false);
      await refreshSubscription();
      toast.success("Cancellation scheduled", {
        description: "Your subscription will remain active until the end of the current billing period.",
      });
    }
  };

  return {
    user,
    billingPeriod,
    setBillingPeriod,
    currentPlans,
    allPlans,
    tierCode,
    hasSubscription,
    activeProductId,
    cancelAtPeriodEnd,
    scheduledCancellationCopy,
    nextChargeCopy,
    activePlanRank,
    loading,
    isAuthModalOpen,
    setIsAuthModalOpen,
    cancelLoading,
    isCancelDialogOpen,
    setIsCancelDialogOpen,
    handlePurchase,
    handleManageSubscription,
    handleSwitchPlan,
    handleCancelConfirm,
    formatUsdAmount,
  };
};
