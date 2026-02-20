import type { Metadata } from "next";
import LyricsGeneratorLayout, { metadata as baseMetadata } from "../../lyrics-generator/layout";
import { applyLocaleMetadata, resolveRouteLocale } from "@/lib/i18n/metadata";

interface LocaleLyricsGeneratorLayoutProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: LocaleLyricsGeneratorLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  return applyLocaleMetadata(baseMetadata, resolveRouteLocale(locale), "/lyrics-generator");
}

export default LyricsGeneratorLayout;
