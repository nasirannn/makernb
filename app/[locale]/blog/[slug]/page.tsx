import type { Metadata } from "next";
import {
  BlogPostPageContent,
  getLocalizedBlogPostMetadata,
  getLocalizedBlogPostStaticParams,
} from "@/lib/blog-post-page";
import { applyLocaleMetadata, resolveRouteLocale } from "@/lib/i18n/metadata";
import { getNonDefaultLocalePathSegments } from "@/lib/i18n/routing";

interface LocaleBlogPostPageProps {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}

export async function generateStaticParams() {
  const localeSegments = getNonDefaultLocalePathSegments();
  return localeSegments.flatMap((localeSegment) => {
    const locale = resolveRouteLocale(localeSegment);
    const blogParams = getLocalizedBlogPostStaticParams(locale);
    return blogParams.map((entry) => ({ locale: localeSegment, slug: entry.slug }));
  });
}

export async function generateMetadata({ params }: LocaleBlogPostPageProps): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  const locale = resolveRouteLocale(localeParam);
  const baseMetadata = await getLocalizedBlogPostMetadata(slug, locale);

  return applyLocaleMetadata(baseMetadata, locale, `/blog/${slug}`);
}

export default async function LocaleBlogPostPage({ params }: LocaleBlogPostPageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = resolveRouteLocale(localeParam);

  return <BlogPostPageContent slug={slug} locale={locale} />;
}
