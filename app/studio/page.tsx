import { StudioSection } from "@/components/layout/sections/studio";
import { FooterSection } from "@/components/layout/sections/footer";

export const metadata = {
  title: "Music Production Studio | AI R&B Creator | MakeRNB",
  description: "Professional AI music production studio. Create, edit, and produce R&B tracks with advanced tools. Generate music, write lyrics, separate vocals, and manage your complete music library in one place.",
  alternates: {
    canonical: 'https://makernb.com/studio',
  },
  openGraph: {
    url: 'https://makernb.com/studio',
    title: "Music Production Studio | AI R&B Creator | MakeRNB",
    description: "Professional AI music production studio. Create, edit, and produce R&B tracks with advanced tools. Generate music, write lyrics, separate vocals, and manage your complete music library in one place.",
  },
};

export default function StudioPage() {
  return (
    <>
      <StudioSection />
    </>
  );
}
