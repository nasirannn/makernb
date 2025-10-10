"use client";

import React from 'react';
import Link from 'next/link';
import type { BlogPost } from '@/lib/mdx';
import { FooterSection } from '@/components/layout/sections/footer';

interface BlogClientProps {
  allPosts: BlogPost[];
}

export default function BlogClient({ allPosts }: BlogClientProps) {

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <main className="container mx-auto px-4 pt-32 pb-12">
        {/* Page Header */}
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">
            MUSIC KNOWLEDGE & HISTORY
          </p>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight">
            MakeRNB Music Blog
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
            Discover remarkable R&B songs, albums, and artists from the golden era
          </p>
        </div>

        {/* Blog Posts Grid */}
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {allPosts.map((post) => (
            <Link 
              key={post.slug}
              href={`/blog/${post.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-background/80 backdrop-blur-sm overflow-hidden hover:bg-background/90 transition-all duration-300"
            >
              {/* Image */}
              <div className="aspect-video overflow-hidden">
                <div 
                  className="w-full h-full bg-cover bg-center group-hover:scale-105 transition-transform duration-500"
                  style={{ backgroundImage: `url(${post.image})` }}
                ></div>
              </div>

              {/* Content */}
              <div className="px-0 py-6">
                {/* Title */}
                <h3 className="text-lg font-bold text-foreground mb-2 line-clamp-2 group-hover:text-foreground/80 group-hover:underline transition-all duration-200">
                  {post.title}
                </h3>

                {/* Excerpt */}
                <p className="text-sm text-muted-foreground mb-3 line-clamp-1">
                  {post.excerpt}
                </p>

                {/* Author and Date */}
                <div className="flex items-center justify-between text-sm text-muted-foreground pb-3 border-b border-gray-200/30">
                  <span>{post.author}</span>
                  <span>
                    {new Date(post.date).toLocaleDateString('en-US', {
                      month: 'numeric',
                      day: 'numeric',
                      year: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            </Link>
          ))}
          </div>

          {/* No More Data Indicator */}
          <div className="text-center mt-8 py-4">
            <span className="text-sm text-muted-foreground font-medium">
              All content loaded
            </span>
          </div>
        </div>


      </main>

      {/* Footer */}
      <FooterSection />
    </div>
  );
}
