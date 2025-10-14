import { LibrarySection } from "@/components/layout/sections/library";

export const metadata = {
  metadataBase: new URL('https://makernb.com'),
  title: "MakeRNB - Library - Classic & Contemporary R&B",
  description: "MakeRNB lets you instantly create and download professional R&B songs with AI. Explore Neo-Soul, Quiet Storm & more — free, online, and easy to use.",
  alternates: {
    canonical: 'https://makernb.com/library/',
  },
  openGraph: {
    url: 'https://makernb.com/library/',
  },
};

export default function LibraryPage() {
  return (
    <>
      <LibrarySection />
    </>
  );
}
