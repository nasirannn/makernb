import type { Metadata } from "next";

import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import {
  BlogPostPageContent,
  getLocalizedBlogPostMetadata,
  getLocalizedBlogPostStaticParams,
} from "@/lib/blog-post-page";

interface BlogPostPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  return getLocalizedBlogPostStaticParams(DEFAULT_LOCALE);
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  return getLocalizedBlogPostMetadata(slug, DEFAULT_LOCALE);
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  return <BlogPostPageContent slug={slug} locale={DEFAULT_LOCALE} />;
}
