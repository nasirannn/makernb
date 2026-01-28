import type { Metadata } from "next";
import { PricingSection } from "@/components/layout/sections/pricing";
import { FooterSection } from "@/components/layout/sections/footer";
import { buildPricingPlan } from "@/lib/pricing-config";
import { getPricingPlans } from "@/lib/pricing-plans";

export const metadata: Metadata = {
  title: "Pricing - MakeRNB",
  description: "Compare MakeRNB plans and pick the best fit for your music workflow. Upgrade for more credits, faster generation, and higher-quality exports.",
  alternates: {
    canonical: "https://makernb.com/pricing",
  },
  openGraph: {
    url: "https://makernb.com/pricing",
    title: "Pricing - MakeRNB",
    description: "Compare MakeRNB plans and pick the best fit for your music workflow. Upgrade for more credits, faster generation, and higher-quality exports.",
  },
};

export default async function PricingPage() {
  const { plans } = await getPricingPlans();
  const initialPlans = plans.map(buildPricingPlan).sort((a, b) => a.rank - b.rank);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 via-background to-background">
      <PricingSection initialPlans={initialPlans} />
      <FooterSection />
    </div>
  );
}
