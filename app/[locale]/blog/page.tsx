import type { Metadata } from "next";
import BlogPage, { metadata as baseMetadata } from "../../blog/page";
import { applyLocaleMetadata, resolveRouteLocale } from "@/lib/i18n/metadata";

interface LocaleBlogPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: LocaleBlogPageProps): Promise<Metadata> {
  const { locale } = await params;
  return applyLocaleMetadata(baseMetadata, resolveRouteLocale(locale), "/blog");
}

export default BlogPage;
