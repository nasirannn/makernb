"use client";

import React from 'react';
import Link from 'next/link';
import type { BlogPost } from '@/lib/mdx';
import { FooterSection } from '@/components/layout/sections/footer';
import { formatLocalizedDate } from '@/lib/locale-format';
import { useI18n } from '@/lib/i18n/provider';
import { withLocalePrefix } from '@/lib/i18n/routing';

interface BlogClientProps {
  allPosts: BlogPost[];
}

export default function BlogClient({ allPosts }: BlogClientProps) {
  const { t, locale } = useI18n();
  const withCurrentLocale = React.useCallback((path: string) => withLocalePrefix(path, locale), [locale]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 via-background to-background">
      {/* Main Content */}
      <main className="container mx-auto px-4 pt-32 pb-6 sm:pb-12">
        {/* Page Header */}
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            {t("blog.knowledgeHistory")}
          </p>
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-4 tracking-tight">
            {t("blog.title")}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t("blog.subtitle")}
          </p>
        </div>

        {/* Blog Posts Grid */}
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {allPosts.map((post) => (
            <Link 
              key={post.slug}
              href={withCurrentLocale(`/blog/${post.slug}`)}
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

                {/* Category and Date */}
                <div className="flex items-center justify-between text-sm text-muted-foreground pb-3 border-b border-gray-200/30">
                  <span>{post.category}</span>
                  <span>
                    {formatLocalizedDate(post.date, {
                      month: 'numeric',
                      day: 'numeric',
                      year: '2-digit'
                    }, locale) ?? ''}
                  </span>
                </div>
              </div>
            </Link>
          ))}
          </div>

          {/* No More Data Indicator */}
          <div className="text-center mt-4 sm:mt-8 py-4">
            <span className="text-sm text-muted-foreground font-medium">
              {t("blog.allContentLoaded")}
            </span>
          </div>
        </div>


      </main>

      {/* Footer */}
      <FooterSection />
    </div>
  );
}
