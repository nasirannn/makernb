"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/contexts/CreditsContext";
import { createClient } from "@supabase/supabase-js";
import { Check, Zap, Star, Crown } from "lucide-react";
import AuthModal from "@/components/ui/auth-modal";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface PricingPlan {
  id: string;
  name: string;
  credits: number;
  price: number;
  originalPrice?: number;
  popular?: boolean;
  icon: React.ReactNode;
  features: string[];
  productId: string;
}

const monthlyPlans: PricingPlan[] = [
  {
    id: "monthly-basic",
    name: "Basic",
    credits: 1000,
    price: 12.9,
    icon: <Star className="h-6 w-6" />,
    features: [
      "1,000 credits/month (approx. 143 songs)",
      "Create up to 2,500 lyrics with AI",
      "Email customer support",
      "Access to all R&B styles and genres"
    ],
    productId: process.env.NEXT_PUBLIC_MONTHLY_BASIC!
  },
  {
    id: "monthly-premium",
    name: "Premium",
    credits: 2500,
    price: 25.9,
    popular: true,
    icon: <Crown className="h-6 w-6" />,
    features: [
      "2,500 credits/month (approx. 357 songs)",
      "Create up to 6,250 lyrics with AI",
      "Email customer support",
      "Access to all R&B styles and genres",
      "Priority processing for faster generation"
    ],
    productId: process.env.NEXT_PUBLIC_MONTHLY_PREMIUM!
  }
];

const yearlyPlans: PricingPlan[] = [
  {
    id: "yearly-basic",
    name: "Basic",
    credits: 12000,
    price: 8.3,
    icon: <Star className="h-6 w-6" />,
    features: [
      "12,000 credits/year (approx. 1,714 songs)",
      "Create up to 30,000 lyrics with AI",
      "Email customer support",
      "Access to all R&B styles and genres"
    ],
    productId: process.env.NEXT_PUBLIC_YEARLY_BASIC!
  },
  {
    id: "yearly-premium",
    name: "Premium",
    credits: 30000,
    price: 16.6,
    popular: true,
    icon: <Crown className="h-6 w-6" />,
    features: [
      "30,000 credits/year (approx. 4,286 songs)",
      "Create up to 75,000 lyrics with AI",
      "Email customer support",
      "Access to all R&B styles and genres",
      "Priority processing for faster generation"
    ],
    productId: process.env.NEXT_PUBLIC_YEARLY_PREMIUM!
  }
];

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
    <section id="pricing" className="container max-w-6xl py-12 sm:py-16">
      <div className="text-center mb-12">
        <h2 className="text-lg text-primary text-center mb-2 tracking-wider">
          Pricing Plans
        </h2>
        <h2 className="text-3xl md:text-4xl text-center font-bold mb-4">
          Choose Your Credits Package
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Get more credits to create unlimited R&B tracks. All packages include commercial use rights and high-quality downloads.
        </p>
        
        {/* Billing Period Toggle */}
        <div className="mt-8 flex justify-center">
          <div className="bg-muted/30 rounded-lg p-1">
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => setBillingPeriod('yearly')}
                className={`py-2 px-4 text-sm font-medium transition-all duration-200 rounded-md ${
                  billingPeriod === 'yearly'
                    ? "bg-primary/20 border-transparent text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>Yearly</span>
                  <span className="relative inline-block rounded-full border border-zinc-700 bg-zinc-900/20 px-2 py-0.5 text-xs text-zinc-50 animate-border-marquee">
                    <span className="text-foreground/90 font-medium">Save 36% ⚡</span>
                    <span className="absolute bottom-0 left-1 right-1 h-[1px] bg-gradient-to-r from-zinc-500/0 via-zinc-300 to-zinc-500/0"></span>
                  </span>
                </div>
              </button>
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`py-2 px-4 text-sm font-medium transition-all duration-200 rounded-md ${
                  billingPeriod === 'monthly'
                    ? "bg-primary/20 border-transparent text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                Monthly
              </button>
            </div>
          </div>
        </div>
        
      </div>

      <div className="flex justify-center">
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 grid-rows-1">
          {currentPlans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`relative transition-all duration-300 hover:shadow-lg h-full flex flex-col ${
                plan.popular 
                  ? 'border-primary shadow-lg' 
                  : 'hover:border-primary/50'
              }`}
            >
              <CardHeader className="text-left pb-4">
                <div className="flex items-center justify-between mb-2">
                  <CardTitle className="text-3xl font-bold">{plan.name}</CardTitle>
                  {plan.popular && (
                    <Badge className="relative inline-block rounded-full border border-zinc-700 bg-zinc-900/20 px-3 py-1 text-xs text-zinc-50 animate-border-marquee">
                      <span className="text-foreground/90 font-medium">Most Popular</span>
                      <span className="absolute bottom-0 left-2 right-2 h-[1px] bg-gradient-to-r from-zinc-500/0 via-zinc-300 to-zinc-500/0"></span>
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-sm text-muted-foreground mb-6">
                  {plan.id === 'monthly' ? 'Perfect for Individual Creators' : 'Professional Music Creation Made Simple'}
                </CardDescription>
                
                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold">${plan.price}</span>
                    <span className="text-lg text-muted-foreground">/month</span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0 flex flex-col flex-grow">
                <Button 
                  className="w-full mb-4" 
                  variant={plan.popular ? "default" : "outline"}
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
                    <li key={index} className="flex items-center gap-3 text-sm">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
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
    </section>
  );
};
