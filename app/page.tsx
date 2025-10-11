import { HeroSection } from "@/components/layout/sections/hero";
import { IntroductionSection } from "@/components/layout/sections/introduction";
import { ExploreSection } from "@/components/layout/sections/explore";
import { TutorialSection } from "@/components/layout/sections/tutorial";
import { FooterSection } from "@/components/layout/sections/footer";
import { FeaturesSection } from "@/components/layout/sections/features";
import { FAQSection } from "@/components/layout/sections/faq";

export const metadata = {
  metadataBase: new URL('https://makernb.com'),
  title: "MakeRNB | Create Classic & Contemporary R&B AI Songs",
  description: "Generate classic and contemporary R&B music with AI. Choose from New Jack Swing, Hip-Hop Soul, Neo-Soul, Quiet Storm and more r&b genres.",
  alternates: {
    canonical: 'https://makernb.com',
  },
  openGraph: {
    type: "website",
    url: "https://makernb.com",
    title: "MakeRNB | Create Classic & Contemporary R&B AI Songs",
    description: "Generate classic and contemporary R&B music with AI. Choose from New Jack Swing, Hip-Hop Soul, Neo-Soul, Quiet Storm and more r&b genres.",
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
    site: "https://makernb.com",
    title: "MakeRNB | Create Classic & Contemporary R&B AI Songs",
    description: "Generate classic and contemporary R&B music with AI. Choose from New Jack Swing, Hip-Hop Soul, Neo-Soul, Quiet Storm and more r&bgenres.",
    images: [
      "/hero-image-dark.jpeg",
    ],
  },
};

export default function Home() {
  return (
    <>
      <HeroSection />
      <IntroductionSection />
      <ExploreSection />
      <TutorialSection />
      <FeaturesSection />
      <FAQSection />
      <FooterSection />
    </>
  );
}
