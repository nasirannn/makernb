import React from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { MDXRemote } from "next-mdx-remote/rsc";
import { notFound } from "next/navigation";

import { FooterSection } from "@/components/layout/sections/footer";
import { getAllPosts, getPostBySlug } from "@/lib/mdx";
import { type AppLocale } from "@/lib/i18n/config";
import { formatLocalizedDate } from "@/lib/locale-format";

interface LocalizedBlogPostContentProps {
  slug: string;
  locale: AppLocale;
}

function buildPostNotFoundMetadata(): Metadata {
  return {
    title: "Post Not Found | MakeRNB",
    description: "The requested blog post could not be found.",
  };
}

export function getLocalizedBlogPostStaticParams(locale: AppLocale) {
  const posts = getAllPosts(locale);
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function getLocalizedBlogPostMetadata(slug: string, locale: AppLocale): Promise<Metadata> {
  const post = getPostBySlug(slug, locale);

  if (!post) {
    return buildPostNotFoundMetadata();
  }

  // Ensure excerpt is within 150-160 characters for optimal SEO.
  const description = post.excerpt.length > 160
    ? `${post.excerpt.substring(0, 157)}...`
    : post.excerpt;

  return {
    title: `${post.title} | MakeRNB Blog`,
    description,
    alternates: {
      canonical: `https://makernb.com/blog/${slug}`,
    },
    openGraph: {
      title: post.title,
      description,
      type: "article",
      publishedTime: post.date,
      url: `https://makernb.com/blog/${slug}`,
      images: post.image
        ? [
            {
              url: post.image,
              width: 1200,
              height: 630,
              alt: post.title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: post.image ? [post.image] : undefined,
    },
  };
}

export async function BlogPostPageContent({ slug, locale }: LocalizedBlogPostContentProps) {
  const post = getPostBySlug(slug, locale);

  if (!post) {
    notFound();
  }

  const formattedDate = formatLocalizedDate(
    post.date,
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
    locale
  ) ?? post.date;

  return (
    <div className="min-h-screen bg-background">
      <section className="pt-32 md:pt-40 pb-12">
        <div className="container mx-auto px-4 w-full">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-8 leading-tight">
              {post.title}
            </h1>
            <div className="flex items-center justify-center gap-3 text-muted-foreground flex-wrap">
              <span className="text-sm">{post.category}</span>
              <div className="w-1 h-1 bg-muted-foreground/50 rounded-full" />
              <span className="text-sm">{formattedDate}</span>
              <div className="w-1 h-1 bg-muted-foreground/50 rounded-full" />
              <span className="text-sm">{post.readTime}</span>
            </div>
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 pt-12 pb-8">
        <div className="max-w-4xl mx-auto">
          {post.image ? (
            <div className="mb-10 overflow-hidden rounded-3xl border border-border/40 bg-muted/10">
              <Image
                src={post.image}
                alt={post.title}
                width={1600}
                height={900}
                className="h-auto w-full object-cover"
                priority
              />
            </div>
          ) : null}
        </div>
        <div className="max-w-3xl mx-auto">
          <article className="prose prose-lg max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-em:text-foreground prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-ul:text-muted-foreground prose-ol:text-muted-foreground prose-li:text-muted-foreground">
            <MDXRemote source={post.content} />
          </article>
        </div>
      </main>

      <FooterSection />
    </div>
  );
}
