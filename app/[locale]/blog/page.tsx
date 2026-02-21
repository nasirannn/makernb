import type { Metadata } from "next";
import BlogClient from "@/app/blog/blog-client";
import { metadata as baseMetadata } from "../../blog/page";
import { applyLocaleMetadata, resolveRouteLocale } from "@/lib/i18n/metadata";
import { getAllPosts } from "@/lib/mdx";

interface LocaleBlogPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: LocaleBlogPageProps): Promise<Metadata> {
  const { locale } = await params;
  return applyLocaleMetadata(baseMetadata, resolveRouteLocale(locale), "/blog");
}

export default async function LocaleBlogPage({ params }: LocaleBlogPageProps) {
  const { locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  const allPosts = getAllPosts(locale);

  return <BlogClient allPosts={allPosts} />;
}
