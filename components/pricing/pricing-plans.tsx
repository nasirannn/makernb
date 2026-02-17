"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import AuthModal from "@/components/ui/auth-modal";
import { CancelSubscriptionDialog } from "@/components/ui/cancel-subscription-dialog";
import { FREE_FEATURES } from "@/components/pricing/pricing-constants";
import { usePricingState } from "@/hooks/use-pricing-state";
import type { PricingPlan } from "@/lib/pricing-config";

type PricingVariant = "section" | "modal";

interface PricingPlansProps {
  variant?: PricingVariant;
  onNavigate?: () => void;
  initialPlans?: PricingPlan[];
}

const variantConfig: Record<PricingVariant, { grid: string; freeCard: string; toggle: string; toggleInner: string; freeDescription: string }> = {
  section: {
    grid: "mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3",
    freeCard: "md:col-span-2 lg:col-span-1",
    toggle: "mt-8 flex justify-center",
    toggleInner: "",
    freeDescription: "Creating with daily credits.",
  },
  modal: {
    grid: "mt-6 grid gap-6 md:grid-cols-3",
    freeCard: "",
    toggle: "mt-4 flex justify-center",
    toggleInner: "border border-foreground/10",
    freeDescription: "Start creating with daily credits. No subscription needed.",
  },
};

export const PricingPlans = ({ variant = "section", onNavigate, initialPlans }: PricingPlansProps) => {
  const {
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
  } = usePricingState({ initialPlans });
  const { grid, freeCard, toggle, toggleInner, freeDescription } = variantConfig[variant];

  const yearlySavingsLabel = useMemo(() => {
    const tiers = Array.from(new Set(allPlans.map((plan) => plan.tierCode)));
    const savings = tiers
      .map((tier) => {
        const monthlyPlan = allPlans.find((plan) => plan.tierCode === tier && plan.billingPeriod === "monthly");
        const yearlyPlan = allPlans.find((plan) => plan.tierCode === tier && plan.billingPeriod === "yearly");

        if (!monthlyPlan || !yearlyPlan || monthlyPlan.price <= 0) {
          return null;
        }

        const percentage = (1 - yearlyPlan.price / monthlyPlan.price) * 100;
        return Number.isFinite(percentage) && percentage > 0 ? percentage : null;
      })
      .filter((value): value is number => value !== null);

    if (savings.length === 0) {
      return null;
    }

    const averageSavings = savings.reduce((total, value) => total + value, 0) / savings.length;
    return `Save ${Math.round(averageSavings)}%`;
  }, [allPlans]);

  const freeCtaLabel =
    variant === "modal"
      ? user
        ? "Continue Free"
        : "Start Free"
      : user
        ? "Continue"
        : "Start Free";

  const yearlySavingsBadge = useMemo(() => {
    if (!yearlySavingsLabel) return "Best Value";
    const match = yearlySavingsLabel.match(/(\d+)/);
    if (!match) return yearlySavingsLabel;
    return `${match[1]}% OFF`;
  }, [yearlySavingsLabel]);

  return (
    <>
      <div className={toggle}>
        <div className={cn("relative w-full", variant === "modal" ? "max-w-[19rem]" : "max-w-[22rem]")}>
          {yearlySavingsLabel && (
            <span className="pointer-events-none absolute -top-2 right-2.5 z-10 inline-flex items-center rounded-md bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-950 shadow-[0_6px_14px_rgba(56,189,248,0.32)]">
              {yearlySavingsBadge}
            </span>
          )}

          <div
            className={cn(
              "relative grid grid-cols-2 items-center rounded-[1.45rem] p-[3px] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] shadow-[0_10px_24px_rgba(0,0,0,0.22)] backdrop-blur-md",
              "dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.015))]",
              toggleInner
            )}
          >
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={cn(
                "relative z-[1] h-[44px] rounded-[1.15rem] px-3.5 text-[0.88rem] md:text-[0.95rem] font-semibold transition-colors duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                billingPeriod === "monthly"
                  ? "bg-background text-foreground shadow-[0_7px_16px_rgba(0,0,0,0.22)]"
                  : "text-foreground/70 hover:text-foreground"
              )}
            >
              Bill Monthly
            </button>

            <button
              onClick={() => setBillingPeriod("yearly")}
              className={cn(
                "relative z-[1] h-[44px] rounded-[1.15rem] px-3.5 text-[0.88rem] md:text-[0.95rem] font-semibold transition-colors duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                billingPeriod === "yearly"
                  ? "bg-background text-foreground shadow-[0_7px_16px_rgba(0,0,0,0.22)]"
                  : "text-foreground/70 hover:text-foreground"
              )}
            >
              Bill Yearly
            </button>
          </div>
        </div>
      </div>

      <div className={grid}>
        <div className={cn("relative overflow-hidden rounded-3xl p-6 md:p-7 app-card-muted", freeCard)}>
          <div className="relative flex h-full flex-col">
            <div className="min-w-0">
              <div className="text-xl font-semibold tracking-tight">Free</div>
              <div className="mt-4 text-6xl md:text-7xl font-black tracking-tight text-foreground">
                Free
              </div>
              <div className="mt-2 text-sm text-muted-foreground/70">
                {freeDescription}
              </div>
            </div>

            <div className="mt-6 flex-1">
              <ul className="space-y-5">
                {FREE_FEATURES.map((feature) => (
                  <li
                    key={feature.label}
                    className="flex items-start gap-3 text-sm text-foreground/90"
                  >
                    {feature.enabled ? (
                      <Check className="mt-1 h-5 w-5 flex-shrink-0 text-foreground/80" />
                    ) : (
                      <X className="mt-1 h-5 w-5 flex-shrink-0 text-rose-500 dark:text-rose-400" />
                    )}
                    <span className="leading-relaxed">{feature.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Button
              asChild
              className="mt-6 w-full rounded-full py-6 text-base font-semibold bg-foreground text-background hover:bg-foreground/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
            >
              <Link href="/music-generator" onClick={onNavigate}>
                {freeCtaLabel}
              </Link>
            </Button>
          </div>
        </div>

        {currentPlans.map((plan) => {
          const isHobby = plan.tierCode === "hobby";
          const planTier = plan.tierCode;
          const isCurrentPlan =
            hasSubscription &&
            (activeProductId ? activeProductId === plan.productId : tierCode === planTier);
          const showPopular = Boolean(plan.popular) && !isHobby;
          const activePlan = activeProductId
            ? allPlans.find((active) => active.productId === activeProductId)
            : null;
          const isSwitchPlan =
            Boolean(hasSubscription && activePlan && activePlan.rank === plan.rank) && !isCurrentPlan;
          const actionLabel = (() => {
            if (isCurrentPlan) return "Manage Subscription";
            if (hasSubscription && activePlan && activePlan.rank === plan.rank) {
              return "Switch Plan";
            }
            if (!hasSubscription || activePlanRank === null) return "Subscribe";
            if (plan.rank > activePlanRank) return "Upgrade";
            if (plan.rank < activePlanRank) return "Downgrade";
            return "Subscribe";
          })();

          return (
            <div
              key={plan.id}
              className={cn(
                "relative overflow-hidden rounded-3xl p-6 md:p-7 border",
                isHobby
                  ? "border-cyan-300/35 bg-[linear-gradient(165deg,#0c1529_0%,#0a1020_45%,#071022_100%)] shadow-[0_26px_70px_rgba(8,18,38,0.62)]"
                  : "border-transparent",
                !isHobby && (plan.popular ? "app-card" : "app-card-muted"),
                "transition-transform duration-200 hover:-translate-y-1"
              )}
            >
              {isHobby && (
                <>
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-80 bg-[radial-gradient(700px_280px_at_10%_-6%,rgba(56,189,248,0.34),transparent_62%)]"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-70 bg-[radial-gradient(540px_240px_at_92%_0%,rgba(99,102,241,0.28),transparent_62%)]"
                  />
                </>
              )}
              {showPopular && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-70 bg-[radial-gradient(820px_420px_at_20%_10%,hsl(var(--primary)/0.22),transparent_60%)]"
                />
              )}
              {showPopular && (
                <div
                  className={cn(
                    "absolute -right-1 -top-1 rounded-bl-[28px] rounded-tr-[28px] px-5 py-2 text-[11px] font-semibold",
                    isHobby
                      ? "bg-cyan-300 text-slate-950 shadow-[0_12px_30px_rgba(56,189,248,0.42)]"
                      : "bg-primary text-primary-foreground shadow-[0_12px_32px_hsl(var(--primary)/0.35)]"
                  )}
                >
                  Most Popular
                </div>
              )}

              <div className="relative flex flex-col h-full">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className={cn("text-xl font-semibold tracking-tight", isHobby ? "text-white" : "")}>
                      {plan.name}
                    </div>
                    {isCurrentPlan && (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
                          isHobby
                            ? "bg-white/10 text-white/80 ring-1 ring-white/10"
                            : "bg-foreground/10 text-foreground/70"
                        )}
                      >
                        Current plan
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-end gap-3">
                    <div className={cn("text-6xl md:text-7xl font-black tracking-tight tabular-nums", isHobby ? "text-white" : "text-foreground")}>
                      <span className="mr-1">$</span>
                      {formatUsdAmount(plan.price)}
                    </div>
                    <div
                      className={cn(
                        "pb-2 text-sm md:text-base font-medium tracking-tight",
                        isHobby ? "text-cyan-100/90" : "text-muted-foreground/70"
                      )}
                    >
                      month
                    </div>
                  </div>

                  <div className={cn("mt-2 text-sm", isHobby ? "text-slate-200/80" : "text-muted-foreground/70")}>
                    {billingPeriod === "yearly" ? (
                      <>
                        {"$"}
                        {formatUsdAmount(plan.price * 12)} billed yearly.{" "}
                        {isCurrentPlan ? (
                          cancelAtPeriodEnd ? (
                            <span>{scheduledCancellationCopy}</span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setIsCancelDialogOpen(true)}
                                className="inline-flex items-center font-semibold text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
                              >
                                Cancel
                              </button>{" "}
                              anytime.
                            </>
                          )
                        ) : (
                          "Cancel anytime."
                        )}
                      </>
                    ) : (
                      <>
                        {isCurrentPlan ? (
                          cancelAtPeriodEnd ? (
                            <span>{scheduledCancellationCopy}</span>
                          ) : (
                            <>
                              <span>{nextChargeCopy} </span>
                              <button
                                type="button"
                                onClick={() => setIsCancelDialogOpen(true)}
                                className="inline-flex items-center font-semibold text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
                              >
                                Cancel
                              </button>{" "}
                              anytime.
                            </>
                          )
                        ) : (
                          <>
                            {"$"}
                            {formatUsdAmount(plan.price)} billed monthly. Cancel anytime.
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex-1">
                  {(() => {
                    const creditsFeature =
                      plan.features[0] ??
                      (billingPeriod === "yearly"
                        ? `${plan.credits.toLocaleString()} credits/year`
                        : `${plan.credits.toLocaleString()} credits/month`);
                    const baseFeatures = plan.features.slice(1);
                    const lyricIndex = baseFeatures.findIndex((feature) =>
                      feature.toLowerCase().includes("create up to")
                    );
                    const orderedFeatures = [...baseFeatures];
                    if (creditsFeature) {
                      if (lyricIndex >= 0) {
                        orderedFeatures.splice(lyricIndex, 0, creditsFeature);
                      } else {
                        orderedFeatures.unshift(creditsFeature);
                      }
                    }

                    return (
                      <ul className="space-y-5">
                        {orderedFeatures.map((feature, index) => (
                          <li
                            key={index}
                            className={cn(
                              "flex items-start gap-3 text-sm",
                              isHobby ? "text-slate-100/90" : "text-foreground/90"
                            )}
                          >
                            <Check
                              className={cn(
                                "mt-1 h-5 w-5 flex-shrink-0",
                                isHobby ? "text-cyan-300" : "text-foreground/80"
                              )}
                            />
                            {feature === "Commercial License Included" ? (
                              <Link
                                href="/license"
                                onClick={onNavigate}
                                className={cn(
                                  "leading-relaxed underline underline-offset-4 transition-colors",
                                  isHobby
                                    ? "decoration-cyan-300/45 hover:decoration-cyan-200/80"
                                    : "decoration-foreground/20 hover:decoration-foreground/50"
                                )}
                              >
                                {feature}
                              </Link>
                            ) : (
                              <span
                                className={cn(
                                  "leading-relaxed",
                                  isHobby &&
                                    (index <= 2 ||
                                      feature.includes("Access to all models") ||
                                      feature.includes("Commercial License")) &&
                                    "font-semibold text-cyan-100"
                                )}
                              >
                                {feature}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </div>

                <Button
                  className={cn(
                    "mt-6 w-full rounded-full py-6 text-base font-semibold",
                    isHobby
                      ? "bg-gradient-to-r from-cyan-300 via-sky-300 to-indigo-300 text-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.2)_inset,0_14px_36px_rgba(56,189,248,0.38)] hover:from-cyan-200 hover:via-sky-200 hover:to-indigo-200"
                      : plan.popular
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-foreground text-background hover:bg-foreground/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
                  )}
                  variant="default"
                  onClick={() => {
                    if (isCurrentPlan) {
                      handleManageSubscription(plan.id);
                      return;
                    }

                    if (isSwitchPlan) {
                      handleSwitchPlan(plan);
                      return;
                    }

                    handlePurchase(plan);
                  }}
                  disabled={loading === plan.id}
                >
                  {loading === plan.id
                    ? isCurrentPlan
                      ? "Redirecting..."
                      : isSwitchPlan
                        ? "Switching..."
                        : "Redirecting to payment..."
                    : actionLabel}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
      <CancelSubscriptionDialog
        open={isCancelDialogOpen}
        onOpenChange={setIsCancelDialogOpen}
        onConfirm={handleCancelConfirm}
        loading={cancelLoading}
      />
    </>
  );
};
