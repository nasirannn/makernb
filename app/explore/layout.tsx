import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore AI R&B Music | MakeRNB",
  description: "Discover trending AI-generated R&B tracks, play full songs, and explore genres, vibes, and artist prompts from the MakeRNB community to inspire your next track.",
  alternates: {
    canonical: "https://makernb.com/explore",
  },
};

export default function ExploreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
