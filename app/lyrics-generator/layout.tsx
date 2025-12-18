import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Lyrics Generator Free Online - MakeRNB",
  description: "Generate creative song lyrics instantly with AI. Create R&B, Soul, Hip-Hop lyrics from your ideas. Perfect for songwriters, musicians, and music creators. Free AI-powered lyric writing tool.",
  alternates: {
    canonical: 'https://makernb.com/lyrics-generator',
  },
  openGraph: {
    title: "AI Lyrics Generator Free Online - MakeRNB",
    description: "Generate creative song lyrics instantly with AI. Create R&B, Soul, Hip-Hop lyrics from your ideas. Perfect for songwriters, musicians, and music creators. Free AI-powered lyric writing tool.",
    url: "https://makernb.com/lyrics-generator",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Lyrics Generator Free Online - MakeRNB",
    description: "Generate creative song lyrics instantly with AI. Create R&B, Soul, Hip-Hop lyrics from your ideas. Perfect for songwriters, musicians, and music creators. Free AI-powered lyric writing tool.",
  },
};

export default function LyricsGeneratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

