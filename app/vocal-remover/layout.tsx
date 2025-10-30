import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Vocal Remover Free Online - MakeRNB",
  description: "Enjoy fast and seamless audio separation with our AI-powered vocal remover.",
  alternates: {
    canonical: 'https://makernb.com/vocal-remover',
  },
  openGraph: {
    title: "AI Vocal Remover Free Online - MakeRNB",
    description: "Enjoy fast and seamless audio separation with our AI-powered vocal remover.",
    url: "https://makernb.com/vocal-remover",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Vocal Remover Free Online - MakeRNB",
    description: "Enjoy fast and seamless audio separation with our AI-powered vocal remover.",
  },
};

export default function VocalRemoverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

