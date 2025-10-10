import { StudioSection } from "@/components/layout/sections/studio";
import { FooterSection } from "@/components/layout/sections/footer";

export const metadata = {
  metadataBase: new URL('https://makernb.com'),
  title: "MakeRNB - Create AI R&B Songs - Classic & Contemporary R&B",
  description: "MakeRNB is a website dedicated to AI-generated R&B music, offering services such as classic R&B creation, Contemporary R&B style generation, and AI music production, helping users effortlessly craft their own soulful rhythms.",
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
