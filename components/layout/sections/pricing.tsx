"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/contexts/CreditsContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { createBillingPortalLink, createCheckoutSession, scheduleCancellation, switchSubscription } from "@/lib/subscription-actions";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import AuthModal from "@/components/ui/auth-modal";
import { CancelSubscriptionDialog } from "@/components/ui/cancel-subscription-dialog";
import { type PricingPlan } from "@/lib/pricing-config";
import { usePricingPlans } from "@/hooks/use-pricing-plans";
import { FEATURE_CREDITS_CONFIG, MUSIC_GENERATION_CONFIG } from "@/lib/credits-config";
import { toast } from "sonner";

export const PricingSection = () => {
  const { user } = useAuth();
  useCredits();
  const { tierCode, hasSubscription, productId: activeProductId, cancelAtPeriodEnd, cancelAt, currentPeriodEnd, refreshSubscription } = useSubscription();
  const [loading, setLoading] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const { monthlyPlans, yearlyPlans } = usePricingPlans();
  const currentPlans = billingPeriod === 'monthly' ? monthlyPlans : yearlyPlans;
  const allPlans = [...monthlyPlans, ...yearlyPlans];
  const tierRankMap: Record<string, number> = {
    starter: 1,
    hobby: 2,
  };
  const activePlanRank =
    activeProductId
      ? allPlans.find((plan) => plan.productId === activeProductId)?.rank ?? null
      : tierCode
        ? tierRankMap[tierCode] ?? null
        : null;
  const freeFeatures = [
    { label: "AI Music Generator", enabled: true },
    { label: "AI Lyrics Generator", enabled: true },
    { label: "AI Vocal Remover", enabled: true },
    { label: "15 credits/day", enabled: true },
    { label: "Create up to 15 lyrics with AI / day", enabled: true },
    { label: "Access to all models (V5, V4.5-all, V4.5+, V4.5, V4)", enabled: true },
    { label: "Download MP3, WAV & Cover PNG", enabled: false },
    { label: "Vocal separation, Extend music & Replace section", enabled: false },
    { label: "Email customer support", enabled: false },
  ] as const;
  const freeApproxSongs = Math.max(1, Math.round(15 / 7));
  const creditsUsageRows = [
    {
      feature: "AI Music Generator (Simple Mode)",
      credits: MUSIC_GENERATION_CONFIG.simple.credits,
      note: "Model V4",
    },
    {
      feature: "AI Music Generator (Custom Mode)",
      credits: MUSIC_GENERATION_CONFIG.custom.credits,
      note: "Model V4.5",
    },
    {
      feature: FEATURE_CREDITS_CONFIG.generate_lyrics.name,
      credits: FEATURE_CREDITS_CONFIG.generate_lyrics.credits,
      note: "Per request",
    },
    {
      feature: FEATURE_CREDITS_CONFIG.convert_to_wav.name,
      credits: FEATURE_CREDITS_CONFIG.convert_to_wav.credits,
      note: "Per export",
    },
    {
      feature: "Vocal Separation (Local file)",
      credits: FEATURE_CREDITS_CONFIG.separate_vocals_from_music_local.credits,
      note: "Per track",
    },
    {
      feature: "Vocal Separation (Studio track)",
      credits: FEATURE_CREDITS_CONFIG.separate_vocals_from_music_studio.credits,
      note: "Per track",
    },
    {
      feature: FEATURE_CREDITS_CONFIG.upload_cover_music.name,
      credits: FEATURE_CREDITS_CONFIG.upload_cover_music.credits,
      note: "Upload audio",
    },
    {
      feature: FEATURE_CREDITS_CONFIG.upload_extend_music.name,
      credits: FEATURE_CREDITS_CONFIG.upload_extend_music.credits,
      note: "Upload audio",
    },
    {
      feature: FEATURE_CREDITS_CONFIG.extend_music.name,
      credits: FEATURE_CREDITS_CONFIG.extend_music.credits,
      note: "Per extend",
    },
    {
      feature: FEATURE_CREDITS_CONFIG.replace_section.name,
      credits: FEATURE_CREDITS_CONFIG.replace_section.credits,
      note: "Per edit",
    },
  ] as const;
  const faqItems = [
    {
      question: "Can I try MakeRNB for free?",
      answer:
        "Yes. The free plan includes daily credits so you can explore core features before upgrading.",
    },
    {
      question: "How do credits work?",
      answer:
        "Every action uses credits. The table below shows the credits required for each feature.",
    },
    {
      question: "Can I cancel anytime?",
      answer:
        "Yes. You can schedule cancellation from the Pricing page or the Customer Portal.",
    },
    {
      question: "What is the Customer Portal?",
      answer:
        "The Customer Portal is a self-service page hosted by Creem where you can manage billing details, invoices, and subscription status. If you are already subscribed, click the “Manage Subscription” button on your current plan card or use the subscription badge in the avatar menu to open the portal.",
    },
    {
      question: "What is the difference between canceling here and in the Customer Portal?",
      answer:
        "Canceling from the Pricing page schedules cancellation at the end of the current billing period. Canceling in the Customer Portal ends the subscription immediately and stops future charges.",
    },
    {
      question: "Where can I manage billing details?",
      answer:
        "Use the Customer Portal to update your payment method and view invoices.",
    },
    {
      question: "Do you offer refunds?",
      answer:
        "Refund terms are listed on the Refunds page. Contact support if you need help.",
    },
  ] as const;

  const formatUsdAmount = (amount: number) => {
    const rounded = Math.round(amount * 100) / 100;
    return rounded.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };
  const formatDisplayDate = (dateValue: string) => {
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
  const scheduledCancellationCopy = cancelAt
    ? `Scheduled to cancel on ${formatDisplayDate(cancelAt) ?? cancelAt}`
    : "Cancellation scheduled.";
  const nextChargeCopy = currentPeriodEnd
    ? `Next charge on ${formatDisplayDate(currentPeriodEnd) ?? currentPeriodEnd}.`
    : "Next charge scheduled.";

  const handlePurchase = async (plan: PricingPlan) => {
    if (!user) {
      // 弹出登录弹窗
      setIsAuthModalOpen(true);
      return;
    }

    setLoading(plan.id);
    
    try {
      // 获取 session token
      if (!user.email) {
        throw new Error("Missing user email");
      }
      const checkoutUrl = await createCheckoutSession({
        productId: plan.productId,
        userId: user.id,
        userEmail: user.email,
        creditsAmount: plan.credits
      });

      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Purchase error:', error);
      setLoading(null); // 只有出错时才清除 loading
      // 这里可以显示错误提示
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
      console.error('Manage subscription error:', error);
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
      console.error('Switch subscription error:', error);
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
      console.error('Schedule cancellation error:', error);
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

  return (
    <section id="pricing" className="py-24 sm:py-32">
      <div className="container max-w-7xl">
        <div className="text-center">
          <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
            Choose the Plan That Fits You Best
          </h2>
          <p className="mt-4 mx-auto max-w-2xl text-base md:text-lg text-muted-foreground">
            Upgrade for more credits, faster iteration, and higher-quality exports. Cancel anytime.
          </p>

          <div className="mt-8 flex justify-center">
            <div className="inline-flex items-center rounded-full bg-background/80 shadow-[0_1px_2px_rgba(0,0,0,0.08)] backdrop-blur-sm p-1 gap-1">
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
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Free (default) */}
          <div className="relative overflow-hidden rounded-3xl p-6 md:p-7 app-card-muted md:col-span-2 lg:col-span-1">
            <div className="relative flex h-full flex-col">
              <div className="min-w-0">
                <div className="text-xl font-semibold tracking-tight">Free</div>
                <div className="mt-4 text-6xl md:text-7xl font-black tracking-tight text-foreground">
                  Free
                </div>
                <div className="mt-2 text-sm text-muted-foreground/70">
                  Creating with daily credits.
                </div>
              </div>

              <div className="mt-6 flex-1">
                <ul className="space-y-5">
                  {freeFeatures.map((feature) => (
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
                <Link href="/studio">{user ? "Continue" : "Start Free"}</Link>
              </Button>
            </div>
          </div>

          {currentPlans.map((plan) => {
            const isHobby = plan.tierCode === "hobby";
            const planTier = plan.tierCode;
            const isCurrentPlan = hasSubscription && (
              activeProductId ? activeProductId === plan.productId : tierCode === planTier
            );
            const showPopular = Boolean(plan.popular);
            const activePlan = activeProductId
              ? allPlans.find((active) => active.productId === activeProductId)
              : null;
            const isSwitchPlan =
              Boolean(hasSubscription && activePlan && activePlan.rank === plan.rank) &&
              !isCurrentPlan;
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
                    <div className="flex items-start gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-xl font-semibold tracking-tight">{plan.name}</div>
                        {isCurrentPlan && (
                          <span className="inline-flex items-center rounded-full bg-foreground/10 px-2.5 py-1 text-[11px] font-semibold text-foreground/70">
                            Current plan
                          </span>
                        )}
                      </div>
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

        <div className="mt-16 space-y-12">
          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-8">
              <h3 className="text-lg text-primary text-center mb-2 tracking-wider">
                Frequently Asked Questions
              </h3>
              <h4 className="text-3xl md:text-4xl text-center font-bold mb-4">
                Everything You Need to Know
              </h4>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Get answers to common questions about plans, billing, and credits.
              </p>
            </div>
            <Accordion type="single" collapsible className="space-y-2">
              {faqItems.map((item) => (
                <AccordionItem
                  key={item.question}
                  value={item.question}
                  className="border-b border-border px-4 py-1"
                >
                  <AccordionTrigger className="text-left text-lg font-semibold py-4 hover:no-underline [&[data-state=open]]:text-primary">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-base text-muted-foreground pb-4 leading-relaxed">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-8">
              <h3 className="text-lg text-primary text-center mb-2 tracking-wider">
                Credits
              </h3>
              <h4 className="text-3xl md:text-4xl text-center font-bold mb-4">
                Credits usage by feature
              </h4>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Each action consumes credits. Values reflect the current system configuration.
              </p>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200/70 dark:border-white/10">
              <table className="min-w-full text-sm">
                <thead className="bg-foreground/5">
                  <tr className="border-b border-slate-200/60 dark:border-white/10 text-left text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    <th className="py-3 px-4 font-semibold">Feature</th>
                    <th className="py-3 px-4 font-semibold">Credits</th>
                    <th className="py-3 px-4 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {creditsUsageRows.map((row) => (
                    <tr key={row.feature} className="border-b border-slate-200/60 dark:border-white/10 last:border-0">
                      <td className="py-4 px-4 font-medium text-foreground/90">{row.feature}</td>
                      <td className="py-4 px-4 font-semibold text-foreground">{row.credits}</td>
                      <td className="py-4 px-4 text-muted-foreground">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
        <CancelSubscriptionDialog
          open={isCancelDialogOpen}
          onOpenChange={setIsCancelDialogOpen}
          onConfirm={handleCancelConfirm}
          loading={cancelLoading}
        />
      </div>
    </section>
  );
};
