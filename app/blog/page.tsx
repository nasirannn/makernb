import React from 'react';
import { getAllPosts } from '@/lib/mdx';
import BlogClient from '@/app/blog/blog-client';
import type { Metadata } from 'next';

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

export default function BlogPage() {
  const allPosts = getAllPosts();

  return <BlogClient allPosts={allPosts} />;
}
