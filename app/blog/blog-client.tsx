"use client";

import React from 'react';
import Link from 'next/link';
import { Calendar, Clock } from 'lucide-react';
import type { BlogPost } from '@/lib/mdx';
import { FooterSection } from '@/components/layout/sections/footer';

interface BlogClientProps {
  allPosts: BlogPost[];
}

export default function BlogClient({ allPosts }: BlogClientProps) {

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Main Content */}
      <main className="container mx-auto px-4 pt-32 pb-12">
        {/* Page Header */}
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">
            MUSIC & CREATIVITY RESOURCES
          </p>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight">
            ALL About R&B Music
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
            Discover remarkable R&B songs, albums, and artists from the unforgettable golden era.
          </p>
        </div>

        {/* Blog Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {allPosts.map((post) => (
            <Link 
              key={post.slug}
              href={`/blog/${post.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:bg-white/10 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10 block"
            >
              {/* Image with Title Overlay */}
              <div className="relative h-48 overflow-hidden">
                <div 
                  className="w-full h-full bg-cover bg-center group-hover:scale-105 transition-transform duration-500"
                  style={{ backgroundImage: `url(${post.image})` }}
                ></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                
                {/* Title Overlay */}
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors duration-200 line-clamp-2 drop-shadow-lg">
                    {post.title}
                  </h3>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <p className="text-white/70 text-sm leading-relaxed mb-4 line-clamp-3">
                  {post.excerpt}
                </p>

                {/* Meta Info */}
                <div className="flex items-center justify-between text-xs text-white/50 mb-4">
                  <span className="px-2 py-1 bg-purple-600/20 text-purple-300 text-xs font-medium rounded-full border border-purple-500/30">
                    {post.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    <span>{post.date}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <Clock className="w-3 h-3" />
                    <span>{post.readTime}</span>
                  </div>
                  
                  <div className="text-xs text-purple-300 hover:text-purple-200 transition-colors duration-200 flex items-center gap-1">
                    <span>Read More</span>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>


      </main>

      {/* Footer */}
      <FooterSection />
    </div>
  );
}
