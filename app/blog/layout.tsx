import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://makernb.com'),
  title: 'MakeRNB - Create AI R&B Songs - Classic & Contemporary R&B',
  description: 'MakeRNB lets you instantly create and download professional R&B songs with AI. Explore Neo-Soul, Quiet Storm & more — free, online, and easy to use.',
  keywords: ['AI Music Generator', 'R&B Music', 'Classic R&B'],
  alternates: {
    canonical: 'https://makernb.com/blog',
  },
  openGraph: {
    title: 'MakeRNB - Create AI R&B Songs - Classic & Contemporary R&B',
    description: 'MakeRNB lets you instantly create and download professional R&B songs with AI. Explore Neo-Soul, Quiet Storm & more — free, online, and easy to use.',
    type: 'website',
    locale: 'en_US',
    url: 'https://makernb.com/blog',
  },
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="blog-layout">
      {children}
    </div>
  );
}
