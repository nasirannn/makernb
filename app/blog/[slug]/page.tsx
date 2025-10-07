import React from 'react';
import Image from 'next/image';
import { getPostBySlug, getAllPosts } from '@/lib/mdx';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { notFound } from 'next/navigation';
import { FooterSection } from '@/components/layout/sections/footer';

interface BlogPostPageProps {
  params: {
    slug: string;
  };
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export default function BlogPostPage({ params }: BlogPostPageProps) {
  const post = getPostBySlug(params.slug);
  
  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="pt-20 pb-8">
        <div className="container mx-auto px-4 w-full">
          <div className="max-w-3xl mx-auto text-center">
            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
              {post.title}
            </h1>
            
            {/* Author, Date & Category */}
            <div className="flex items-center justify-center gap-6 text-muted-foreground flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-purple-600 to-purple-600 flex items-center justify-center">
                  {post.author === 'Darius Coleman' ? (
                    <Image src="/avatars/Darius_Coleman.webp" alt={post.author} width={40} height={40} className="w-full h-full object-cover" />
                  ) : post.author === 'Keisha Thompson' ? (
                    <Image src="/avatars/Keisha_Thompson.webp" alt={post.author} width={40} height={40} className="w-full h-full object-cover" />
                  ) : post.author === 'Malik Washington' ? (
                    <Image src="/avatars/Malik_Washington.webp" alt={post.author} width={40} height={40} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-semibold text-sm">
                      {post.author.charAt(0)}
                    </span>
                  )}
                </div>
                <span className="font-medium">{post.author}</span>
              </div>
              <div className="w-1 h-1 bg-muted-foreground/50 rounded-full"></div>
              <span className="text-sm">
                {post.category}
              </span>
              <div className="w-1 h-1 bg-muted-foreground/50 rounded-full"></div>
              <span className="text-sm">{post.date}</span>
              <div className="w-1 h-1 bg-muted-foreground/50 rounded-full"></div>
              <span className="text-sm">{post.readTime}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Article Content */}
      <main className="container mx-auto px-4 pt-12 pb-8">
        <div className="max-w-3xl mx-auto">
          <article className="prose prose-lg max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-em:text-foreground prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-ul:text-muted-foreground prose-ol:text-muted-foreground prose-li:text-muted-foreground">
            <MDXRemote source={post.content} />
          </article>
        </div>
      </main>

      {/* Footer */}
      <FooterSection />
    </div>
  );
}