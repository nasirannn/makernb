import { HeroSection } from "@/components/layout/sections/hero";
import { IntroductionSection } from "@/components/layout/sections/introduction";
import { ExploreSection } from "@/components/layout/sections/explore";
import { TutorialSection } from "@/components/layout/sections/tutorial";
import { FooterSection } from "@/components/layout/sections/footer";
import { FeaturesSection } from "@/components/layout/sections/features";
import { FAQSection } from "@/components/layout/sections/faq";

export const metadata = {
  metadataBase: new URL('https://only-90s-rnb.com'),
  title: "R&B Music Generator | Create Contemporary & 90s R&B AI Songs",
  description: "Generate authentic 90s Black R&B music with AI. Choose from New Jack Swing, Hip-Hop Soul, Contemporary R&B and more classic genres.",
  openGraph: {
    type: "website",
    url: "https://only-90s-rnb.com",
    title: "R&B Music Generator | Create Contemporary & 90s R&B AI Songs",
    description: "Generate authentic 90s Black R&B music with AI. Choose from New Jack Swing, Hip-Hop Soul, Contemporary R&B and more classic genres.",
    images: [
      {
        url: "/hero-image-dark.jpeg",
        width: 1200,
        height: 630,
        alt: "R&B Music Generator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "https://only-90s-rnb.com",
    title: "R&B Music Generator | Create Contemporary & 90s R&B AI Songs",
    description: "Generate authentic 90s Black R&B music with AI. Choose from New Jack Swing, Hip-Hop Soul, Contemporary R&B and more classic genres.",
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
