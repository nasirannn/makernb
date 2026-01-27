import type { Metadata } from "next";
import { PricingSection } from "@/components/layout/sections/pricing";
import { FooterSection } from "@/components/layout/sections/footer";

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

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 via-background to-background">
      <PricingSection />
      <FooterSection />
    </div>
  );
}
