import { HeroSection } from "@/components/layout/sections/hero";
import { HowItWorksSection } from "@/components/layout/sections/how-it-works";
import { IntroductionSection } from "@/components/layout/sections/introduction";
import { ExploreSection } from "@/components/layout/sections/explore";
import { FooterSection } from "@/components/layout/sections/footer";
import { FeaturesSection } from "@/components/layout/sections/features";
import { FAQSection } from "@/components/layout/sections/faq";
import { HomeCanonical } from "./HomeCanonical";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MakeRNB | Free Online AI R&B Music Generator | Song Creator",
  description: "Create R&B with AI. Generate 90s old-school styles like New Jack Swing, Neo-Soul, Quiet Storm, Hip-Hop Soul and Contemporary R&B songs. Free credits daily.",
  openGraph: {
    type: "website",
    url: "https://makernb.com/",
    title: "MakeRNB | Free Online AI R&B Music Generator | Song Creator",
    description: "Create R&B with AI. Generate 90s old-school styles like New Jack Swing, Neo-Soul, Quiet Storm, Hip-Hop Soul and Contemporary R&B songs. Free credits daily.",
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
    title: "MakeRNB | Free Online AI R&B Music Generator | Song Creator",
    description: "Create R&B with AI. Generate 90s old-school styles like New Jack Swing, Neo-Soul, Quiet Storm, Hip-Hop Soul and Contemporary R&B songs. Free credits daily.",
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
      <ExploreSection />
      <FeaturesSection />
      <HowItWorksSection />
      <IntroductionSection />
      <FAQSection />
      <FooterSection />
    </>
  );
}
