import { HeroSection } from "@/components/layout/sections/hero";
import { IntroductionSection } from "@/components/layout/sections/introduction";
import { ExploreSection } from "@/components/layout/sections/explore";
import { FooterSection } from "@/components/layout/sections/footer";
import { FeaturesSection } from "@/components/layout/sections/features";
import { PricingSection } from "@/components/layout/sections/pricing";
import { FAQSection } from "@/components/layout/sections/faq";
import { CTASection } from "@/components/layout/sections/cta";
import { HomeCanonical } from "./HomeCanonical";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MakeRNB | Free Online AI R&B Music Generator",
  description: "Create professional R&B music instantly with AI. Generate Neo-Soul, Quiet Storm, Contemporary R&B & Hip-Hop Soul tracks. Free credits daily. Sign up to start creating.",
  openGraph: {
    type: "website",
    url: "https://makernb.com/",
    title: "MakeRNB | Free Online AI R&B Music Generator",
    description: "Create professional R&B music instantly with AI. Generate Neo-Soul, Quiet Storm, Contemporary R&B & Hip-Hop Soul tracks. Free credits daily. Sign up to start creating.",
    images: [
      {
        url: "/hero-image-dark.jpeg",
        width: 1200,
        height: 630,
        alt: "MakeRNB",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "https://makernb.com/",
    title: "MakeRNB | Free Online AI R&B Music Generator",
    description: "Create professional R&B music instantly with AI. Generate Neo-Soul, Quiet Storm, Contemporary R&B & Hip-Hop Soul tracks. Free credits daily. Sign up to start creating.",
    images: [
      "/hero-image-dark.jpeg",
    ],
  },
};

export default function Home() {
  return (
    <>
      {/* Client component to inject canonical link with trailing slash */}
      <HomeCanonical />
      
      <HeroSection />
      <IntroductionSection />
      <ExploreSection />
      <FeaturesSection />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <FooterSection />
    </>
  );
}
