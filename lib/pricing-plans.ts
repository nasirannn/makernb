import "server-only";

import type { PricingPlanApi } from "@/lib/pricing-config";

type PlanWithIds = Omit<PricingPlanApi, "name"> & { name: string; productIds: string[] };

const requireEnv = (key: string): string => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing ${key}. Set it to load pricing plans.`);
  }
  return value;
};

const parseEnvList = (value: string): string[] =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const monthlyStarterIds = parseEnvList(requireEnv("CREEM_PRODUCT_ID_MONTHLY_STARTER"));
const monthlyHobbyIds = parseEnvList(requireEnv("CREEM_PRODUCT_ID_MONTHLY_HOBBY"));
const yearlyStarterIds = parseEnvList(requireEnv("CREEM_PRODUCT_ID_YEARLY_STARTER"));
const yearlyHobbyIds = parseEnvList(requireEnv("CREEM_PRODUCT_ID_YEARLY_HOBBY"));

const PLANS_WITH_IDS: PlanWithIds[] = [
  {
    code: "monthly_starter",
    name: "Monthly Starter",
    productId: monthlyStarterIds[0],
    productIds: monthlyStarterIds,
    billingPeriod: "monthly",
    credits: 1000,
    price: 12.9,
    tierCode: "starter",
  },
  {
    code: "monthly_hobby",
    name: "Monthly Hobby",
    productId: monthlyHobbyIds[0],
    productIds: monthlyHobbyIds,
    billingPeriod: "monthly",
    credits: 2500,
    price: 25.9,
    tierCode: "hobby",
  },
  {
    code: "yearly_starter",
    name: "Yearly Starter",
    productId: yearlyStarterIds[0],
    productIds: yearlyStarterIds,
    billingPeriod: "yearly",
    credits: 12000,
    price: 99.9,
    tierCode: "starter",
  },
  {
    code: "yearly_hobby",
    name: "Yearly Hobby",
    productId: yearlyHobbyIds[0],
    productIds: yearlyHobbyIds,
    billingPeriod: "yearly",
    credits: 25000,
    price: 199.9,
    tierCode: "hobby",
  },
];

const toPricingApi = ({ productIds: _productIds, ...plan }: PlanWithIds): PricingPlanApi => plan;

export const getPlanByProductId = (productId: string): PlanWithIds | null =>
  PLANS_WITH_IDS.find((plan) => plan.productIds.includes(productId)) || null;

export const getPlanByCode = (code: string): PlanWithIds | null =>
  PLANS_WITH_IDS.find((plan) => plan.code === code) || null;

export const getPricingPlans = async (): Promise<{ plans: PricingPlanApi[] }> => ({
  plans: PLANS_WITH_IDS.map(toPricingApi),
});
