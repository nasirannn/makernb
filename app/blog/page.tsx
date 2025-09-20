import React from 'react';
import { getAllPosts } from '@/lib/mdx';
import BlogClient from '@/app/blog/blog-client';

export default function BlogPage() {
  const allPosts = getAllPosts();

  return <BlogClient allPosts={allPosts} />;
}
