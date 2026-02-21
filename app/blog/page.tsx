import React from 'react';
import { getAllPosts } from '@/lib/mdx';
import BlogClient from '@/app/blog/blog-client';
import type { Metadata } from 'next';
import { DEFAULT_LOCALE, type AppLocale } from '@/lib/i18n/config';

export const metadata: Metadata = {
  title: "R&B Music Blog | History, Culture & Tips | MakeRNB",
  description: "Explore the rich history and evolution of R&B music. Learn about legendary artists, production techniques, and the cultural impact of Soul, Neo-Soul, and Contemporary R&B.",
  alternates: {
    canonical: 'https://makernb.com/blog',
  },
  openGraph: {
    url: 'https://makernb.com/blog',
    title: "R&B Music Blog | History, Culture & Tips | MakeRNB",
    description: "Explore the rich history and evolution of R&B music. Learn about legendary artists, production techniques, and the cultural impact of Soul, Neo-Soul, and Contemporary R&B.",
  },
};

export function BlogPageContent({ locale }: { locale: AppLocale }) {
  const allPosts = getAllPosts(locale);
  return <BlogClient allPosts={allPosts} />;
}

export default function BlogPage() {
  return <BlogPageContent locale={DEFAULT_LOCALE} />;
}
