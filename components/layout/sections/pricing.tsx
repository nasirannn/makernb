"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/contexts/CreditsContext";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
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

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {currentPlans.map((plan) => (
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
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-xl font-semibold tracking-tight">{plan.name}</div>
                      {plan.popular && (
                        <span className="inline-flex items-center rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                          Most popular
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {billingPeriod === "monthly" ? "For solo creators" : "Best value for teams & power users"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-black tracking-tight tabular-nums">
                      <span className="text-sm align-top mr-0.5">$</span>
                      {plan.price}
                      <span className="text-sm text-muted-foreground ml-1">/mo</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {billingPeriod === "yearly" ? "Billed yearly" : "Billed monthly"}
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="inline-flex items-center rounded-full bg-foreground/5 px-3 py-1.5 text-xs font-semibold text-foreground/70 dark:bg-white/10 dark:text-foreground/80">
                    {billingPeriod === "yearly"
                      ? `${plan.credits.toLocaleString()} credits / year`
                      : `${plan.credits.toLocaleString()} credits / month`}
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

                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature, index) => (
	                    <li key={index} className="flex items-start gap-3 text-sm text-foreground/80">
	                      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-foreground/5 text-foreground dark:bg-white/10">
	                        <Check className="h-3.5 w-3.5 text-emerald-500" />
	                      </span>
	                      <span className="leading-relaxed">{feature}</span>
	                    </li>
	                  ))}
	                </ul>
              </div>
            </div>
          ))}
        </div>

        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      </div>
    </section>
  );
};
