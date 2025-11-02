import { StudioSection } from "@/components/layout/sections/studio";
import { FooterSection } from "@/components/layout/sections/footer";

export const metadata = {
  title: "MakeRNB - Create AI R&B Songs - Classic & Contemporary R&B",
  description: "MakeRNB lets you instantly create and download professional R&B songs with AI. Explore Neo-Soul, Quiet Storm & more — free, online, and easy to use.",
  alternates: {
    canonical: 'https://makernb.com/studio',
  },
  openGraph: {
    url: 'https://makernb.com/studio',
  },
};

export default function StudioPage() {
  return (
    <>
      <StudioSection />
    </>
  );
}
