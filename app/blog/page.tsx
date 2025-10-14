import React from 'react';
import { getAllPosts } from '@/lib/mdx';
import BlogClient from '@/app/blog/blog-client';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://makernb.com'),
  title: "MakeRNB Blog - R&B Music Knowledge & History",
  description: "MakeRNB lets you instantly create and download professional R&B songs with AI. Explore Neo-Soul, Quiet Storm & more — free, online, and easy to use.",
  alternates: {
    canonical: 'https://makernb.com/blog',
  },
  openGraph: {
    url: 'https://makernb.com/blog',
  },
};

export default function BlogPage() {
  const allPosts = getAllPosts();

  return <BlogClient allPosts={allPosts} />;
}
