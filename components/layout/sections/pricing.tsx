"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/contexts/CreditsContext";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import AuthModal from "@/components/ui/auth-modal";
import { monthlyPlans, yearlyPlans, type PricingPlan } from "@/lib/pricing-config";

export const PricingSection = () => {
  const { user } = useAuth();
  useCredits();
  const [loading, setLoading] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const toggleRef = useRef<HTMLDivElement>(null);
  const yearlyRef = useRef<HTMLButtonElement>(null);
  const monthlyRef = useRef<HTMLButtonElement>(null);
  const [sliderStyle, setSliderStyle] = useState({ width: 0, x: 0 });

	  const currentPlans = billingPeriod === 'monthly' ? monthlyPlans : yearlyPlans;
		  const freeFeatures = [
		    { label: "AI Music Generator", enabled: true },
		    { label: "AI Lyrics Generator", enabled: true },
		    { label: "AI Vocal Remover", enabled: true },
	    { label: "Create up to 15 lyrics with AI / day", enabled: true },
		    { label: "Access to all models (V5, V4.5-all, V4.5+, V4.5, V4)", enabled: true },
		    { label: "Download MP3 & Cover PNG", enabled: false },
	    { label: "Vocal separation, Extend music & Replace section", enabled: false },
		    { label: "Email customer support", enabled: false },
		  ] as const;
  const freeApproxSongs = Math.max(1, Math.round(15 / 7));

  const formatUsdAmount = (amount: number) => {
    const rounded = Math.round(amount * 100) / 100;
    return rounded.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  const updateSlider = useCallback(() => {
    const container = toggleRef.current;
    const target = billingPeriod === 'yearly' ? yearlyRef.current : monthlyRef.current;
    if (!container || !target) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    setSliderStyle({
      width: targetRect.width,
      x: targetRect.left - containerRect.left,
    });
  }, [billingPeriod]);

  useLayoutEffect(() => {
    updateSlider();
  }, [updateSlider]);

  useEffect(() => {
    const handleResize = () => updateSlider();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateSlider]);

  const handlePurchase = async (plan: PricingPlan) => {
    if (!user) {
      // 弹出登录弹窗
      setIsAuthModalOpen(true);
      return;
    }

    setLoading(plan.id);
    
    try {
      // 获取 session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        throw new Error('Authentication failed');
      }

      const response = await fetch('/api/creem-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          productId: plan.productId,
          userId: user.id,
          userEmail: user.email,
          creditsAmount: plan.credits
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { checkout_url } = await response.json();
      
      // 显示跳转提示
      setLoading(plan.id);
      
      // 立即跳转
      window.location.href = checkout_url;
    } catch (error) {
      console.error('Purchase error:', error);
      setLoading(null); // 只有出错时才清除 loading
      // 这里可以显示错误提示
    }
  };

  return (
    <section id="pricing" className="py-24 sm:py-32">
      <div className="container max-w-6xl">
        <div className="text-center">
          <div className="text-lg text-primary tracking-wider">Pricing</div>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
            Choose the Plan That Fits You Best
          </h2>
          <p className="mt-4 mx-auto max-w-2xl text-base md:text-lg text-muted-foreground">
            Upgrade for more credits, faster iteration, and higher-quality exports. Cancel anytime.
          </p>

          <div className="mt-8 flex justify-center">
            <div ref={toggleRef} className="app-card-muted app-hairline relative inline-flex rounded-full p-1">
              <div
                className="absolute top-1 bottom-1 rounded-full bg-primary shadow-[0_10px_26px_rgba(0,0,0,0.18)] transition-[transform,width] duration-300 ease-out"
                style={{
                  width: sliderStyle.width,
                  transform: `translateX(${sliderStyle.x}px)`,
                }}
              />
              <div className="relative z-10 inline-flex items-center gap-1">
                <button
                  onClick={() => setBillingPeriod("yearly")}
                  ref={yearlyRef}
                  className={cn(
                    "px-5 py-2 text-sm font-semibold transition-colors duration-200 rounded-full",
                    billingPeriod === "yearly" ? "text-primary-foreground" : "text-foreground/60 hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span>Yearly</span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold transition-colors duration-200",
                        billingPeriod === "yearly"
                          ? "bg-black/15 text-primary-foreground"
                          : "bg-black/5 text-foreground/70 dark:bg-white/10 dark:text-foreground/75"
                      )}
                    >
                      Save 36%
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => setBillingPeriod("monthly")}
                  ref={monthlyRef}
                  className={cn(
                    "px-5 py-2 text-sm font-semibold transition-colors duration-200 rounded-full",
                    billingPeriod === "monthly" ? "text-primary-foreground" : "text-foreground/60 hover:text-foreground"
                  )}
                >
                  Monthly
                </button>
              </div>
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

              <div className="mt-6">
                <div className="inline-flex items-center rounded-full bg-foreground/5 px-3 py-1.5 text-xs font-semibold text-foreground/70 dark:bg-white/10 dark:text-foreground/80">
                  {`15 credits/day (approx. ${freeApproxSongs} songs)`}
                </div>
              </div>

              <Button
                asChild
                className="mt-4 w-full rounded-full py-6 text-base font-semibold bg-foreground text-background hover:bg-foreground/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
              >
                <Link href="/studio">{user ? "Continue Free" : "Start Free"}</Link>
              </Button>

              <ul className="mt-6 space-y-5">
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
          </div>

          {currentPlans.map((plan) => {
            const isHobby = plan.name === "Hobby";

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative overflow-hidden rounded-3xl p-6 md:p-7",
                  plan.popular ? "app-card" : "app-card-muted",
                  "transition-transform duration-200 hover:-translate-y-1"
                )}
              >
              {plan.popular && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-70 bg-[radial-gradient(820px_420px_at_20%_10%,hsl(var(--primary)/0.22),transparent_60%)]"
                />
              )}

              <div className="relative flex flex-col h-full">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-xl font-semibold tracking-tight">{plan.name}</div>
                    {plan.popular && (
                      <span className="inline-flex items-center rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                        Popular
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-end gap-3">
                    <div className="text-6xl md:text-7xl font-black tracking-tight tabular-nums text-foreground">
                      <span className="text-2xl md:text-3xl align-top mr-1">$</span>
                      {formatUsdAmount(plan.price)}
                    </div>
                    <div className="pb-2 text-lg font-medium tracking-tight text-muted-foreground/70">
                      month
                    </div>
                  </div>

                  <div className="mt-2 text-sm text-muted-foreground/70">
                    {billingPeriod === "yearly"
                      ? `$${formatUsdAmount(plan.price * 12)} billed yearly. Cancel anytime.`
                      : "Billed monthly. Cancel anytime."}
                  </div>
                </div>

                <div className="mt-5">
                  <div className="inline-flex items-center rounded-full bg-foreground/5 px-3 py-1.5 text-xs font-semibold text-foreground/70 dark:bg-white/10 dark:text-foreground/80">
                    {plan.features[0] ??
                      (billingPeriod === "yearly"
                        ? `${plan.credits.toLocaleString()} credits/year`
                        : `${plan.credits.toLocaleString()} credits/month`)}
                  </div>
                </div>

                <Button
                  className={cn(
                    "mt-6 w-full rounded-full py-6 text-base font-semibold",
                    plan.popular
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-foreground text-background hover:bg-foreground/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
                  )}
                  variant="default"
                  onClick={() => handlePurchase(plan)}
                  disabled={loading === plan.id}
                >
                  {loading === plan.id ? "Redirecting to payment..." : "Subscribe"}
                </Button>

                <ul className="mt-6 space-y-5">
                  {plan.features.slice(1).map((feature, index) => (
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
              </div>
              </div>
            );
          })}
        </div>

        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      </div>
    </section>
  );
};
