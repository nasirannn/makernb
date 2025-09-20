import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'R&B Music Generator - Create AI R&B Songs - 90s R&B & Contemporary R&B',
  description: 'R&B Music Generator is a website dedicated to AI-generated R&B music, offering services such as 90s R&B creation, Contemporary R&B style generation, and AI music production, helping users effortlessly craft their own soulful rhythms.',
  keywords: ['AI Music Generator', '90s R&B'],
  openGraph: {
    title: 'R&B Music Generator - Create AI R&B Songs - 90s R&B & Contemporary R&B',
    description: 'R&B Music Generator is a website dedicated to AI-generated R&B music, offering services such as 90s R&B creation, Contemporary R&B style generation, and AI music production, helping users effortlessly craft their own soulful rhythms.',
    type: 'website',
    locale: 'en_US',
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
