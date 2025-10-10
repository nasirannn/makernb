import { LibrarySection } from "@/components/layout/sections/library";

export const metadata = {
  metadataBase: new URL('https://makernb.com'),
  title: "MakeRNB - Library - Classic & Contemporary R&B",
  description: "Browse and manage your AI-generated R&B music collection. Play, download, and organize your classic and contemporary R&B tracks.",
  alternates: {
    canonical: 'https://makernb.com/library',
  },
  openGraph: {
    url: 'https://makernb.com/library',
  },
};

export default function LibraryPage() {
  return (
    <>
      <LibrarySection />
    </>
  );
}
