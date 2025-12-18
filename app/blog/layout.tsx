import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'R&B Music Blog | History, Culture & Tips | MakeRNB',
  description: 'Explore the rich history and evolution of R&B music. Learn about legendary artists, production techniques, and the cultural impact of Soul, Neo-Soul, and Contemporary R&B.',
  keywords: ['R&B Music History', 'Soul Music', 'Neo-Soul', 'Contemporary R&B', 'Music Production', 'R&B Artists'],
  alternates: {
    canonical: 'https://makernb.com/blog',
  },
  openGraph: {
    title: 'R&B Music Blog | History, Culture & Tips | MakeRNB',
    description: 'Explore the rich history and evolution of R&B music. Learn about legendary artists, production techniques, and the cultural impact of Soul, Neo-Soul, and Contemporary R&B.',
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
