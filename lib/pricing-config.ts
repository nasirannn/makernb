/**
 * 套餐配置
 * 
 * 统一管理所有定价套餐的配置信息
 * 包括月付和年付套餐的价格、积分、功能等
 */

export interface PricingPlan {
  id: string;
  name: string;
  rank: number;
  credits: number;
  price: number;
  originalPrice?: number;
  popular?: boolean;
  icon: 'star' | 'crown';
  features: string[];
  productId: string;
}

/**
 * 月付套餐配置
 */
export const monthlyPlans: PricingPlan[] = [
  {
    id: "monthly-basic",
    name: "Starter",
    rank: 1,
    credits: 1000,
    price: 12.9,
    icon: 'star',
    features: [
      "1,000 credits/month (approx. 143 songs)",
      "AI Music Generator",
      "AI Lyrics Generator",
      "AI Vocal Remover",
      "Create up to 1,000 lyrics with AI",
      "Download MP3 & Cover PNG",
      "Commercial License Included",
      "Vocal separation, Extend music & Replace section",
      "Access to all models (V5, V4.5-all, V4.5+, V4.5, V4)",
      "Email customer support"
    ],
    productId: process.env.NEXT_PUBLIC_MONTHLY_BASIC!
  },
  {
    id: "monthly-premium",
    name: "Hobby",
    rank: 2,
    credits: 2500,
    price: 25.9,
    popular: true,
    icon: 'crown',
    features: [
      "2,500 credits/month (approx. 357 songs)",
      "AI Music Generator",
      "AI Lyrics Generator",
      "AI Vocal Remover",
      "Create up to 2,500 lyrics with AI",
      "Download MP3, WAV & Cover PNG",
      "Commercial License Included",
      "Vocal separation, Extend music & Replace section",
      "Access to all models (V5, V4.5-all, V4.5+, V4.5, V4)",
      "Email customer support",
    ],
    productId: process.env.NEXT_PUBLIC_MONTHLY_PREMIUM!
  }
];

/**
 * 年付套餐配置
 */
export const yearlyPlans: PricingPlan[] = [
  {
    id: "yearly-basic",
    name: "Starter",
    rank: 1,
    credits: 12000,
    price: 8.3,
    icon: 'star',
    features: [
      "12,000 credits/year (approx. 1,714 songs)",
      "AI Music Generator",
      "AI Lyrics Generator",
      "AI Vocal Remover",
      "Create up to 12,000 lyrics with AI",
      "Download MP3 & Cover PNG",
      "Commercial License Included",
      "Vocal separation, Extend music & Replace section",
      "Access to all models (V5, V4.5-all, V4.5+, V4.5, V4)",
      "Email customer support"
    ],
    productId: process.env.NEXT_PUBLIC_YEARLY_BASIC!
  },
  {
    id: "yearly-premium",
    name: "Hobby",
    rank: 2,
    credits: 30000,
    price: 16.6,
    popular: true,
    icon: 'crown',
    features: [
      "30,000 credits/year (approx. 4,286 songs)",
      "AI Music Generator",
      "AI Lyrics Generator",
      "AI Vocal Remover",
      "Create up to 30,000 lyrics with AI",
      "Download MP3, WAV & Cover PNG",
      "Commercial License Included",
      "Vocal separation, Extend music & Replace section",
      "Access to all models (V5, V4.5-all, V4.5+, V4.5, V4)",
      "Email customer support",
    ],
    productId: process.env.NEXT_PUBLIC_YEARLY_PREMIUM!
  }
];
