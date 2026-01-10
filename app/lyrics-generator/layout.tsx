import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Lyrics Generator | MakeRNB",
  description: "Generate R&B lyrics with AI, customize themes, moods, and hooks, then copy, tweak, or refine your verses to fit your next track in seconds with guided prompts.",
  alternates: {
    canonical: "https://makernb.com/lyrics-generator",
  },
};

export default function LyricsGeneratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
