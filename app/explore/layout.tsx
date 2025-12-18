import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Explore AI-Generated R&B Music | MakeRNB Community',
  description: 'Discover and listen to thousands of AI-generated R&B tracks from the MakeRNB community. Browse Neo-Soul, Hip-Hop Soul, Quiet Storm & Contemporary R&B music creations.',
  alternates: {
    canonical: 'https://makernb.com/explore',
  },
  openGraph: {
    title: 'Explore AI-Generated R&B Music | MakeRNB Community',
    description: 'Discover and listen to thousands of AI-generated R&B tracks from the MakeRNB community. Browse Neo-Soul, Hip-Hop Soul, Quiet Storm & Contemporary R&B music creations.',
    type: 'website',
    locale: 'en_US',
    url: 'https://makernb.com/explore',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Explore AI-Generated R&B Music | MakeRNB Community',
    description: 'Discover and listen to thousands of AI-generated R&B tracks from the MakeRNB community. Browse Neo-Soul, Hip-Hop Soul, Quiet Storm & Contemporary R&B music creations.',
  },
};

export default function ExploreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
