import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vocal Separation | MakeRNB",
  description: "Separate vocals and instrumentals from your tracks with AI. Upload audio or pick from Studio and download stems for remixing, covers, and edits in minutes.",
  alternates: {
    canonical: "https://makernb.com/vocal-separation",
  },
};

export default function VocalSeparationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
