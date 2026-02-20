import type { Metadata } from "next";
import BlogPostPage, {
  generateMetadata as generateBlogPostMetadata,
  generateStaticParams as generateBlogPostStaticParams,
} from "../../../blog/[slug]/page";
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
  const blogParams = await generateBlogPostStaticParams();
  return blogParams.flatMap((entry) =>
    localeSegments.map((locale) => ({ locale, slug: entry.slug }))
  );
}

export async function generateMetadata({ params }: LocaleBlogPostPageProps): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  const locale = resolveRouteLocale(localeParam);
  const baseMetadata = await generateBlogPostMetadata({ params: Promise.resolve({ slug }) });

  return applyLocaleMetadata(baseMetadata, locale, `/blog/${slug}`);
}

export default BlogPostPage;
