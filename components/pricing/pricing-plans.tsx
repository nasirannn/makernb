"use client";

import Link from "next/link";
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
    grid: "grid gap-6 md:grid-cols-3",
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

  const freeCtaLabel =
    variant === "modal"
      ? user
        ? "Continue Free"
        : "Start Free"
      : user
        ? "Continue"
        : "Start Free";

  return (
    <>
      <div className={toggle}>
        <div
          className={cn(
            "inline-flex items-center rounded-full bg-background/80 shadow-[0_1px_2px_rgba(0,0,0,0.08)] backdrop-blur-sm p-1 gap-1",
            toggleInner
          )}
        >
          <button
            onClick={() => setBillingPeriod("yearly")}
            className={cn(
              "px-5 py-2 text-sm font-semibold transition-colors duration-200 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              billingPeriod === "yearly"
                ? "bg-primary text-primary-foreground shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
                : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
            )}
          >
            <div className="flex items-center gap-2">
              <span>Yearly</span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold transition-colors duration-200",
                  billingPeriod === "yearly"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-foreground/5 text-foreground/70 dark:bg-white/10 dark:text-foreground/75"
                )}
              >
                Save 36%
              </span>
            </div>
          </button>
          <button
            onClick={() => setBillingPeriod("monthly")}
            className={cn(
              "px-5 py-2 text-sm font-semibold transition-colors duration-200 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              billingPeriod === "monthly"
                ? "bg-primary text-primary-foreground shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
                : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
            )}
          >
            Monthly
          </button>
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
                    className={cn(
                      "flex items-start gap-3 text-sm",
                      feature.enabled ? "text-foreground/90" : "text-muted-foreground/75"
                    )}
                  >
                    {feature.enabled ? (
                      <Check className="mt-1 h-5 w-5 flex-shrink-0 text-foreground/80" />
                    ) : (
                      <X className="mt-1 h-5 w-5 flex-shrink-0 text-muted-foreground/60" />
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
              <Link href="/studio" onClick={onNavigate}>
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
          const showPopular = Boolean(plan.popular);
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
                "relative overflow-hidden rounded-3xl p-6 md:p-7 border-2 border-transparent",
                plan.popular ? "app-card" : "app-card-muted",
                isHobby && "border-primary/50",
                "transition-transform duration-200 hover:-translate-y-1"
              )}
            >
              {showPopular && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-70 bg-[radial-gradient(820px_420px_at_20%_10%,hsl(var(--primary)/0.22),transparent_60%)]"
                />
              )}
              {showPopular && (
                <div className="absolute -right-1 -top-1 rounded-bl-[28px] rounded-tr-[28px] bg-primary px-5 py-2 text-[11px] font-semibold text-primary-foreground shadow-[0_12px_32px_hsl(var(--primary)/0.35)]">
                  Most Popular
                </div>
              )}

              <div className="relative flex flex-col h-full">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-xl font-semibold tracking-tight">{plan.name}</div>
                    {isCurrentPlan && (
                      <span className="inline-flex items-center rounded-full bg-foreground/10 px-2.5 py-1 text-[11px] font-semibold text-foreground/70">
                        Current plan
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-end gap-3">
                    <div className="text-6xl md:text-7xl font-black tracking-tight tabular-nums text-foreground">
                      <span className="mr-1">$</span>
                      {formatUsdAmount(plan.price)}
                    </div>
                    <div className="pb-2 text-sm md:text-base font-medium tracking-tight text-muted-foreground/70">
                      month
                    </div>
                  </div>

                  <div className="mt-2 text-sm text-muted-foreground/70">
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
                            className="flex items-start gap-3 text-sm text-foreground/90"
                          >
                            <Check
                              className={cn(
                                "mt-1 h-5 w-5 flex-shrink-0",
                                isHobby ? "text-emerald-500" : "text-foreground/80"
                              )}
                            />
                            {feature === "Commercial License Included" ? (
                              <Link
                                href="/license"
                                onClick={onNavigate}
                                className="leading-relaxed underline underline-offset-4 decoration-foreground/20 transition-colors hover:decoration-foreground/50"
                              >
                                {feature}
                              </Link>
                            ) : (
                              <span className="leading-relaxed">{feature}</span>
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
                    plan.popular
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
