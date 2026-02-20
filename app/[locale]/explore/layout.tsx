import type { Metadata } from "next";
import ExploreLayout, { metadata as baseMetadata } from "../../explore/layout";
import { applyLocaleMetadata, resolveRouteLocale } from "@/lib/i18n/metadata";

interface LocaleExploreLayoutProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: LocaleExploreLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  return applyLocaleMetadata(baseMetadata, resolveRouteLocale(locale), "/explore");
}

export default ExploreLayout;
