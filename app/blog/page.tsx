import React from 'react';
import { getAllPosts } from '@/lib/mdx';
import BlogClient from '@/app/blog/blog-client';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://makernb.com'),
  title: "MakeRNB Blog - R&B Music Knowledge & History",
  description: "Discover remarkable R&B songs, albums, and artists from the golden era. Learn about the history and culture of R&B music.",
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
