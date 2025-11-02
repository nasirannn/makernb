import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Lyrics Generator Free Online - MakeRNB",
  description: "Create compelling lyrics with AI. Describe your vision and let our advanced technology craft the perfect words for your music.",
  alternates: {
    canonical: 'https://makernb.com/lyrics-generator',
  },
  openGraph: {
    title: "AI Lyrics Generator Free Online - MakeRNB",
    description: "Create compelling lyrics with AI. Describe your vision and let our advanced technology craft the perfect words for your music.",
    url: "https://makernb.com/lyrics-generator",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Lyrics Generator Free Online - MakeRNB",
    description: "Create compelling lyrics with AI. Describe your vision and let our advanced technology craft the perfect words for your music.",
  },
};

export default function LyricsGeneratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

