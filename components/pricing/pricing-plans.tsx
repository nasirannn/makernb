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
import { formatLocalizedNumber } from "@/lib/locale-format";
import type { PricingPlan } from "@/lib/pricing-config";
import { useI18n } from "@/lib/i18n/provider";

type PricingVariant = "section" | "modal";

interface PricingPlansProps {
  variant?: PricingVariant;
  onNavigate?: () => void;
  initialPlans?: PricingPlan[];
}

const variantConfig: Record<PricingVariant, { grid: string; freeCard: string; toggle: string; toggleInner: string }> = {
  section: {
    grid: "mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3",
    freeCard: "md:col-span-2 lg:col-span-1",
    toggle: "mt-8 flex justify-center",
    toggleInner: "",
  },
  modal: {
    grid: "mt-6 grid gap-6 md:grid-cols-3",
    freeCard: "",
    toggle: "mt-4 flex justify-center",
    toggleInner: "border border-foreground/10",
  },
};

export const PricingPlans = ({ variant = "section", onNavigate, initialPlans }: PricingPlansProps) => {
  const { t, locale } = useI18n();
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
  const { grid, freeCard, toggle, toggleInner } = variantConfig[variant];
  const freeDescription =
    variant === "modal"
      ? t("pricing.startCreatingNoSubscription")
      : t("pricing.creatingWithDailyCredits");

  const yearlySavingsPercent = useMemo(() => {
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
    return Math.round(averageSavings);
  }, [allPlans]);

  const freeCtaLabel =
    variant === "modal"
      ? user
        ? t("pricing.continueFree")
        : t("pricing.startFree")
      : user
        ? t("pricing.continue")
        : t("pricing.startFree");

  const yearlySavingsBadge = useMemo(() => {
    if (!yearlySavingsPercent) return t("pricing.bestValue");
    return t("pricing.percentOff", { percent: yearlySavingsPercent });
  }, [t, yearlySavingsPercent]);

  const commercialLicenseText = t("pricing.feature.commercialLicenseIncluded");
  const accessAllModelsText = t("pricing.feature.accessAllModels");

  const getPlanFeatures = (plan: PricingPlan) => {
    const periodLabel = plan.billingPeriod === "yearly" ? t("pricing.year") : t("pricing.month");
    const approxSongs = Math.max(1, Math.round(plan.credits / 7));
    const creditsLine = t("pricing.creditsPerPeriodApproxSongs", {
      credits: formatLocalizedNumber(plan.credits, undefined, locale),
      period: periodLabel,
      songs: formatLocalizedNumber(approxSongs, undefined, locale),
    });
    const downloadLine =
      plan.tierCode === "hobby"
        ? t("pricing.feature.downloadHobby")
        : t("pricing.feature.downloadStarter");
    const advancedEditingLine =
      plan.tierCode === "hobby"
        ? t("pricing.feature.advancedEditingHobby")
        : t("pricing.feature.advancedEditingStarter");

    return [
      creditsLine,
      t("pricing.feature.aiMusicGenerator"),
      t("pricing.feature.aiLyricsGenerator"),
      t("pricing.feature.aiPersonaGenerator"),
      t("pricing.feature.aiVocalSeparation"),
      downloadLine,
      t("pricing.feature.publicVisibilityControl"),
      commercialLicenseText,
      t("pricing.feature.enhanceStyle"),
      advancedEditingLine,
      accessAllModelsText,
      t("pricing.feature.emailSupport"),
    ];
  };

  return (
    <>
      <div className={toggle}>
        <div className={cn("relative w-full", variant === "modal" ? "max-w-[19rem]" : "max-w-[22rem]")}>
          {yearlySavingsPercent && (
            <span className="pointer-events-none absolute -top-2 right-2.5 z-10 inline-flex items-center rounded-md bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400 px-2 py-0.5 text-xs font-semibold tracking-wide text-slate-950 shadow-[0_6px_14px_rgba(56,189,248,0.32)]">
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
                "relative z-[1] h-[44px] rounded-[1.15rem] px-3.5 text-sm font-semibold transition-colors duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                billingPeriod === "monthly"
                  ? "bg-background text-foreground shadow-[0_7px_16px_rgba(0,0,0,0.22)]"
                  : "text-foreground/70 hover:text-foreground"
              )}
            >
              {t("pricing.billMonthly")}
            </button>

            <button
              onClick={() => setBillingPeriod("yearly")}
              className={cn(
                "relative z-[1] h-[44px] rounded-[1.15rem] px-3.5 text-sm font-semibold transition-colors duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                billingPeriod === "yearly"
                  ? "bg-background text-foreground shadow-[0_7px_16px_rgba(0,0,0,0.22)]"
                  : "text-foreground/70 hover:text-foreground"
              )}
            >
              {t("pricing.billYearly")}
            </button>
          </div>
        </div>
      </div>

      <div className={grid}>
        <div className={cn("relative overflow-hidden rounded-3xl p-6 md:p-7 app-card-muted", freeCard)}>
          <div className="relative flex h-full flex-col">
            <div className="min-w-0">
              <div className="text-xl font-semibold tracking-tight">{t("pricing.free")}</div>
              <div className="mt-4 text-6xl md:text-7xl font-black tracking-tight text-foreground">
                {t("pricing.free")}
              </div>
              <div className="mt-2 text-sm text-muted-foreground/70">
                {freeDescription}
              </div>
            </div>

            <div className="mt-6 flex-1">
              <ul className="space-y-5">
                {FREE_FEATURES.map((feature) => (
                  <li
                    key={feature.key}
                    className="flex items-start gap-3 text-sm text-foreground/90"
                  >
                    {feature.enabled ? (
                      <Check className="mt-1 h-5 w-5 flex-shrink-0 text-foreground/80" />
                    ) : (
                      <X className="mt-1 h-5 w-5 flex-shrink-0 text-rose-500 dark:text-rose-400" />
                    )}
                    <span className="leading-relaxed">{t(`pricing.freeFeatures.${feature.key}`)}</span>
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
            if (isCurrentPlan) return t("pricing.manageSubscription");
            if (hasSubscription && activePlan && activePlan.rank === plan.rank) {
              return t("pricing.switchPlan");
            }
            if (!hasSubscription || activePlanRank === null) return t("pricing.subscribe");
            if (plan.rank > activePlanRank) return t("pricing.upgrade");
            if (plan.rank < activePlanRank) return t("pricing.downgrade");
            return t("pricing.subscribe");
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
                    "absolute -right-1 -top-1 rounded-bl-[28px] rounded-tr-[28px] px-5 py-2 text-xs font-semibold",
                    isHobby
                      ? "bg-cyan-300 text-slate-950 shadow-[0_12px_30px_rgba(56,189,248,0.42)]"
                      : "bg-primary text-primary-foreground shadow-[0_12px_32px_hsl(var(--primary)/0.35)]"
                  )}
                >
                  {t("pricing.mostPopular")}
                </div>
              )}

              <div className="relative flex flex-col h-full">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className={cn("text-xl font-semibold tracking-tight", isHobby ? "text-white" : "")}>
                      {t(`pricing.planNames.${plan.tierCode}`) || plan.name}
                    </div>
                    {isCurrentPlan && (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                          isHobby
                            ? "bg-white/10 text-white/80 ring-1 ring-white/10"
                            : "bg-foreground/10 text-foreground/70"
                        )}
                      >
                        {t("pricing.currentPlan")}
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
                      {t("pricing.month")}
                    </div>
                  </div>

                  <div className={cn("mt-2 text-sm", isHobby ? "text-slate-200/80" : "text-muted-foreground/70")}>
                    {billingPeriod === "yearly" ? (
                      <>
                        {t("pricing.billedYearly", {
                          amount: `$${formatUsdAmount(plan.price * 12)}`,
                        })}{" "}
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
                                {t("common.cancel")}
                              </button>{" "}
                              {t("pricing.cancelAnytime")}
                            </>
                          )
                        ) : (
                          t("pricing.cancelAnytime")
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
                                {t("common.cancel")}
                              </button>{" "}
                              {t("pricing.cancelAnytime")}
                            </>
                          )
                        ) : (
                          <>
                            {t("pricing.billedMonthly", {
                              amount: `$${formatUsdAmount(plan.price)}`,
                            })}{" "}
                            {t("pricing.cancelAnytime")}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex-1">
                  {(() => {
                    const orderedFeatures = getPlanFeatures(plan);

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
                            {feature === commercialLicenseText ? (
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
                                      feature === accessAllModelsText ||
                                      feature === commercialLicenseText) &&
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
                      ? t("pricing.redirecting")
                      : isSwitchPlan
                        ? t("pricing.switching")
                        : t("pricing.redirectingToPayment")
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
