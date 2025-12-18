import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Vocal Remover Free Online - MakeRNB",
  description: "Separate vocals from instrumentals instantly with AI-powered vocal remover. Extract acapella, karaoke tracks, and isolated instruments from any song. High-quality audio separation in seconds.",
  alternates: {
    canonical: 'https://makernb.com/vocal-remover',
  },
  openGraph: {
    title: "AI Vocal Remover Free Online - MakeRNB",
    description: "Separate vocals from instrumentals instantly with AI-powered vocal remover. Extract acapella, karaoke tracks, and isolated instruments from any song. High-quality audio separation in seconds.",
    url: "https://makernb.com/vocal-remover",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Vocal Remover Free Online - MakeRNB",
    description: "Separate vocals from instrumentals instantly with AI-powered vocal remover. Extract acapella, karaoke tracks, and isolated instruments from any song. High-quality audio separation in seconds.",
  },
};

export default function VocalRemoverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

