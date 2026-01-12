"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/contexts/CreditsContext";
import { supabase } from "@/lib/supabase";
import { Check } from "lucide-react";
import AuthModal from "@/components/ui/auth-modal";
import { monthlyPlans, yearlyPlans, type PricingPlan } from "@/lib/pricing-config";

export const PricingSection = () => {
  const { user } = useAuth();
  const { credits } = useCredits();
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
    <section id="pricing" className="py-12 sm:py-16">
      <div className="container max-w-6xl">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl text-center font-bold mb-4">
          <span className="block">Choose the Plan</span>
          <span className="block">That Fits You Best</span>
        </h2>
        
        {/* Billing Period Toggle */}
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
                onClick={() => setBillingPeriod('yearly')}
                ref={yearlyRef}
                className={`px-5 py-2 text-sm font-semibold transition-colors duration-200 rounded-full ${
                  billingPeriod === 'yearly'
                    ? "text-primary-foreground"
                    : "text-foreground/60 hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>Yearly</span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold transition-colors duration-200 ${
                      billingPeriod === 'yearly'
                        ? "bg-black/15 text-primary-foreground"
                        : "bg-black/5 text-foreground/70"
                    }`}
                  >
                    Save 36%
                  </span>
                </div>
              </button>
              <button
                onClick={() => setBillingPeriod('monthly')}
                ref={monthlyRef}
                className={`px-5 py-2 text-sm font-semibold transition-colors duration-200 rounded-full ${
                  billingPeriod === 'monthly'
                    ? "text-primary-foreground"
                    : "text-foreground/60 hover:text-foreground"
                }`}
              >
                Monthly
              </button>
            </div>
          </div>
        </div>
        
      </div>

      <div className="flex justify-center">
        <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6 grid-rows-1">
          {currentPlans.map((plan) => (
            <Card 
              key={plan.id} 
              className="app-card relative transition-all duration-300 h-full flex flex-col rounded-[28px]"
            >
              <CardHeader className="text-center pb-4 pt-8">
                <div className="flex justify-center mb-6">
                  <Badge className={`rounded-full px-4 py-1 text-xs font-bold uppercase tracking-[0.2em] ${
                    plan.popular ? 'bg-primary text-primary-foreground' : 'bg-black/5 text-foreground/70 border border-black/10'
                  }`}>
                    {plan.name}
                  </Badge>
                </div>
                <CardDescription className="text-sm text-muted-foreground mb-6">
                  {billingPeriod === 'monthly'
                    ? 'Perfect for Individual Creators'
                    : 'Professional Music Creation Made Simple'}
                </CardDescription>
                
                <div className="mb-6">
                  <div className="text-5xl md:text-6xl font-black tracking-tight">
                    <span className="text-base align-bottom mr-0.5">$</span>
                    {plan.price}
                    <span className="text-base text-muted-foreground ml-1">/mo</span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0 flex flex-col flex-grow">
                <Button 
                  className="w-full mb-6 rounded-full py-6 text-base font-semibold"
                  variant="default"
                  onClick={() => handlePurchase(plan)}
                  disabled={loading === plan.id}
                >
                  {loading === plan.id ? (
                    "Redirecting to payment..."
                  ) : (
                    "Subscribe"
                  )}
                </Button>
                

                <ul className="space-y-3 flex-grow">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3 text-sm text-foreground/80">
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 登录弹窗 */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
      </div>
    </section>
  );
};
