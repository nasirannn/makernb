/**
 * Pricing plan builders (config-driven).
 */

export type PricingTierCode = 'starter' | 'hobby';
export type PricingBillingPeriod = 'monthly' | 'yearly';

export interface PricingPlanApi {
  code: string;
  productId: string;
  billingPeriod: PricingBillingPeriod;
  credits: number;
  price: number;
  tierCode: PricingTierCode;
  name?: string | null;
}

export interface PricingPlan {
  id: string;
  code: string;
  name: string;
  rank: number;
  credits: number;
  price: number;
  periodPrice: number;
  billingPeriod: PricingBillingPeriod;
  tierCode: PricingTierCode;
  popular?: boolean;
  icon: 'star' | 'crown';
  features: string[];
  productId: string;
}

const tierMeta: Record<PricingTierCode, { name: string; rank: number; icon: 'star' | 'crown'; popular: boolean; download: string }> = {
  starter: {
    name: 'Starter',
    rank: 1,
    icon: 'star',
    popular: false,
    download: 'Download MP3, MP4 & Cover PNG',
  },
  hobby: {
    name: 'Hobby',
    rank: 2,
    icon: 'crown',
    popular: true,
    download: 'Download MP3, WAV, MP4 & Cover PNG',
  },
};

const normalizeTierCode = (tierCode: string): PricingTierCode => {
  if (tierCode === 'premium') return 'hobby';
  if (tierCode === 'basic') return 'starter';
  return tierCode === 'hobby' ? 'hobby' : 'starter';
};

const buildFeatureList = (tier: PricingTierCode, credits: number, billingPeriod: PricingBillingPeriod) => {
  const periodLabel = billingPeriod === 'yearly' ? 'year' : 'month';
  const approxSongs = Math.max(1, Math.round(credits / 7));
  const creditsLine = `${credits.toLocaleString('en-US')} credits/${periodLabel} (approx. ${approxSongs.toLocaleString('en-US')} songs)`;
  const downloadLine = tierMeta[tier].download;
  const enhanceStyleLine = 'Enhance Style';
  const advancedEditingLine =
    tier === 'hobby'
      ? 'Vocal Separation, Split Stem, Generate MIDI, Extend Music, Replace Section & Mashup'
      : 'Vocal Separation, Extend Music & Replace Section';

  return [
    creditsLine,
    'AI Music Generator',
    'AI Lyrics Generator',
    'AI Persona Generator',
    'AI Vocal Separation',
    downloadLine,
    'Public Visibility Control (Public / Private)',
    'Commercial License Included',
    enhanceStyleLine,
    advancedEditingLine,
    'Access to all models (V5, V4.5+, V4.5, V4)',
    'Email customer support',
  ];
};

export const buildPricingPlan = (plan: PricingPlanApi): PricingPlan => {
  const tierCode = normalizeTierCode(plan.tierCode);
  const meta = tierMeta[tierCode];
  const displayPrice = plan.billingPeriod === 'yearly' ? plan.price / 12 : plan.price;

  return {
    id: plan.code,
    code: plan.code,
    name: meta.name,
    rank: meta.rank,
    credits: plan.credits,
    price: displayPrice,
    periodPrice: plan.price,
    billingPeriod: plan.billingPeriod,
    tierCode,
    popular: meta.popular,
    icon: meta.icon,
    features: buildFeatureList(tierCode, plan.credits, plan.billingPeriod),
    productId: plan.productId,
  };
};
