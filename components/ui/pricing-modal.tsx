"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/contexts/CreditsContext";
import { usePricingModal } from "@/contexts/PricingModalContext";
import { supabase } from "@/lib/supabase";
import { Check } from "lucide-react";
import AuthModal from "@/components/ui/auth-modal";
import { monthlyPlans, yearlyPlans, type PricingPlan } from "@/lib/pricing-config";

export function PricingModal() {
  const { isOpen, closeModal } = usePricingModal();
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
    <>
      <Dialog open={isOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full bg-[#0b0b10] border border-white/10 text-white">
          <DialogHeader className="pb-3">
            <DialogTitle className="text-center sr-only">Pricing Plans</DialogTitle>
            <div className="space-y-2">
              <div>
                <h2 className="text-xs text-primary text-center mb-2 tracking-[0.4em] uppercase">
                  Pricing Plans
                </h2>
                <h2 className="text-2xl md:text-3xl text-center font-bold mb-2 text-white">
                  Choose Your Credits Package
                </h2>
                <p className="text-base text-white/70 max-w-2xl mx-auto">
                  Get more credits to create unlimited R&B tracks. All packages include commercial use rights and high-quality downloads.
                </p>
              </div>
              
              {/* Billing Period Toggle */}
              <div className="mt-4 flex justify-center">
                  <div className="bg-white/5 rounded-full p-1 border border-white/10">
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={() => setBillingPeriod('yearly')}
                        className={`py-2 px-5 text-sm font-semibold transition-all duration-200 rounded-full ${
                          billingPeriod === 'yearly'
                            ? "bg-primary text-white shadow-sm"
                            : "text-white/70 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>Yearly</span>
                          <span className="inline-flex items-center text-xs text-white/80">
                            Save 36%
                          </span>
                        </div>
                      </button>
                      <button
                        onClick={() => setBillingPeriod('monthly')}
                        className={`py-2 px-5 text-sm font-semibold transition-all duration-200 rounded-full ${
                          billingPeriod === 'monthly'
                            ? "bg-primary text-white shadow-sm"
                            : "text-white/70 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        Monthly
                      </button>
                    </div>
                  </div>
                </div>
              </div>
          </DialogHeader>

          <div className="flex justify-center">
            <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-4 grid-rows-1">
              {currentPlans.map((plan) => (
                <Card 
                  key={plan.id} 
                  className="relative transition-all duration-300 h-full flex flex-col bg-white text-black rounded-[28px] border border-black/10 shadow-[0_20px_60px_rgba(0,0,0,0.2)]"
                >
                  <CardHeader className="text-center pb-3 pt-8">
                    <div className="flex justify-center mb-4">
                      <Badge className={`rounded-full px-4 py-1 text-xs font-bold uppercase tracking-[0.2em] ${
                        plan.popular ? 'bg-primary text-white' : 'bg-black/10 text-black/70'
                      }`}>
                        {plan.name}
                      </Badge>
                    </div>
                    <CardDescription className="text-sm text-black/60 mb-4">
                      {plan.id === 'monthly' ? 'Perfect for Individual Creators' : 'Professional Music Creation Made Simple'}
                    </CardDescription>
                    
                    <div className="mb-4">
                      <div className="text-5xl font-black tracking-tight">
                        ${plan.price}
                      </div>
                      <div className="text-base text-black/60">per month</div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0 flex flex-col flex-grow">
                    <Button 
                      className="w-full mb-4 rounded-full py-6 text-base font-semibold bg-primary text-white hover:bg-primary/90"
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
                    

                    <ul className="space-y-2 flex-grow">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2 text-sm text-black/80">
                          <Check className="h-3.5 w-3.5 text-black flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 登录弹窗 */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
    </>
  );
}
