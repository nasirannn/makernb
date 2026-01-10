import { LibrarySection } from "@/components/layout/sections/library";

export const metadata = {
  title: "My Music Library | MakeRNB - Your AI R&B Creations",
  description: "Access your personal collection of AI-generated R&B music. Organize, manage, and download your created tracks. View your music history and favorite R&B creations in one place.",
  alternates: {
    canonical: 'https://makernb.com/library',
  },
  openGraph: {
    url: 'https://makernb.com/library',
    title: "My Music Library | MakeRNB - Your AI R&B Creations",
    description: "Access your personal collection of AI-generated R&B music. Organize, manage, and download your created tracks. View your music history and favorite R&B creations in one place.",
  },
};

export default function LibraryPage() {
  return (
    <>
      <h1 className="sr-only">Library</h1>
      <LibrarySection />
    </>
  );
}
