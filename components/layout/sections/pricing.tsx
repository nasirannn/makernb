"use client";

import { useState } from "react";
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

  const currentPlans = billingPeriod === 'monthly' ? monthlyPlans : yearlyPlans;

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
    <section id="pricing" className="py-12 sm:py-16 bg-[#0b0b10]">
      <div className="container max-w-6xl">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl text-center font-bold mb-4 text-white">
          <span className="block">Choose the Plan</span>
          <span className="block">That Fits You Best</span>
        </h2>
        
        {/* Billing Period Toggle */}
        <div className="mt-8 flex justify-center">
          <div className="rounded-full border border-white/10 p-1 bg-transparent">
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => setBillingPeriod('yearly')}
                className={`py-2 px-5 text-sm font-semibold transition-all duration-200 rounded-full ${
                  billingPeriod === 'yearly'
                    ? "bg-primary text-white"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>Yearly</span>
                  <span className="inline-flex items-center text-xs text-white/70">
                    Save 36%
                  </span>
                </div>
              </button>
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`py-2 px-5 text-sm font-semibold transition-all duration-200 rounded-full ${
                  billingPeriod === 'monthly'
                    ? "bg-primary text-white"
                    : "text-white/60 hover:text-white"
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
              className="relative transition-all duration-300 h-full flex flex-col bg-white text-black rounded-[28px] border border-black/10 shadow-[0_20px_60px_rgba(0,0,0,0.2)]"
            >
              <CardHeader className="text-center pb-4 pt-8">
                <div className="flex justify-center mb-6">
                  <Badge className={`rounded-full px-4 py-1 text-xs font-bold uppercase tracking-[0.2em] ${
                    plan.popular ? 'bg-primary text-white' : 'bg-black/10 text-black/70'
                  }`}>
                    {plan.name}
                  </Badge>
                </div>
                <CardDescription className="text-sm text-black/60 mb-6">
                  {plan.id === 'monthly' ? 'Perfect for Individual Creators' : 'Professional Music Creation Made Simple'}
                </CardDescription>
                
                <div className="mb-6">
                  <div className="text-5xl md:text-6xl font-black tracking-tight">
                    ${plan.price}
                  </div>
                  <div className="text-base text-black/60">per month</div>
                </div>
              </CardHeader>

              <CardContent className="pt-0 flex flex-col flex-grow">
                <Button 
                  className="w-full mb-6 rounded-full py-6 text-base font-semibold bg-primary text-white hover:bg-primary/90"
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
                    <li key={index} className="flex items-center gap-3 text-sm text-black/80">
                      <Check className="h-4 w-4 text-black flex-shrink-0" />
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
