import type { Metadata } from "next";
import VocalSeparationLayout, { metadata as baseMetadata } from "../../vocal-separation/layout";
import { applyLocaleMetadata, resolveRouteLocale } from "@/lib/i18n/metadata";

interface LocaleVocalSeparationLayoutProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: LocaleVocalSeparationLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  return applyLocaleMetadata(baseMetadata, resolveRouteLocale(locale), "/vocal-separation");
}

export default VocalSeparationLayout;
