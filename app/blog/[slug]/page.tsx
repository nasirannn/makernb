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
      {/* Hero Section with Background Image */}
      <section className="relative pt-20 pb-8 min-h-[60vh] flex items-center">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover"
          style={{ 
            backgroundImage: `url(${post.image})`,
            backgroundPosition: 'center 30%'
          }}
        >
          {/* Overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
        </div>
        
        {/* Content */}
        <div className="relative z-10 container mx-auto px-4 w-full">
          <div className="max-w-3xl mx-auto text-center">
            {/* Title */}
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-8 leading-tight drop-shadow-lg">
              {post.title}
            </h1>
            
            {/* Author, Date & Category */}
            <div className="flex items-center justify-center gap-6 text-white/90 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-purple-600 to-purple-600 flex items-center justify-center">
                  {post.author === 'Darius Coleman' ? (
                    <Image src="/avatars/Darius_Coleman.png" alt={post.author} width={40} height={40} className="w-full h-full object-cover" />
                  ) : post.author === 'Keisha Thompson' ? (
                    <Image src="/avatars/Keisha_Thompson.png" alt={post.author} width={40} height={40} className="w-full h-full object-cover" />
                  ) : post.author === 'Malik Washington' ? (
                    <Image src="/avatars/Malik_Washington.png" alt={post.author} width={40} height={40} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-semibold text-sm">
                      {post.author.charAt(0)}
                    </span>
                  )}
                </div>
                <span className="font-medium">{post.author}</span>
              </div>
              <div className="w-1 h-1 bg-white/50 rounded-full"></div>
              <span className="text-white/70 text-sm">
                {post.category}
              </span>
              <div className="w-1 h-1 bg-white/50 rounded-full"></div>
              <span className="text-white/70 text-sm">{post.date}</span>
              <div className="w-1 h-1 bg-white/50 rounded-full"></div>
              <span className="text-white/70 text-sm">{post.readTime}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Article Content */}
      <main className="container mx-auto px-4 pt-12 pb-8">
        <div className="max-w-3xl mx-auto">
          <article className="prose prose-invert prose-lg max-w-none prose-headings:text-white prose-p:text-white/80 prose-strong:text-white prose-em:text-white prose-a:text-purple-300 prose-a:no-underline hover:prose-a:underline prose-ul:text-white/80 prose-ol:text-white/80 prose-li:text-white/80">
            <MDXRemote source={post.content} />
          </article>
        </div>
      </main>

      {/* Footer */}
      <FooterSection />
    </div>
  );
}