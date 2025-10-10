import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://makernb.com'),
  title: 'MakeRNB - Create AI R&B Songs - Classic & Contemporary R&B',
  description: 'MakeRNB is a website dedicated to AI-generated R&B music, offering services such as classic R&B creation, Contemporary R&B style generation, and AI music production, helping users effortlessly craft their own soulful rhythms.',
  keywords: ['AI Music Generator', 'R&B Music', 'Classic R&B'],
  alternates: {
    canonical: 'https://makernb.com/blog',
  },
  openGraph: {
    title: 'MakeRNB - Create AI R&B Songs - Classic & Contemporary R&B',
    description: 'MakeRNB is a website dedicated to AI-generated R&B music, offering services such as classic R&B creation, Contemporary R&B style generation, and AI music production, helping users effortlessly craft their own soulful rhythms.',
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
