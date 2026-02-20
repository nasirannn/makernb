import type { Metadata } from "next";
import PrivacyPage, { metadata as baseMetadata } from "../../privacy/page";
import { applyLocaleMetadata, resolveRouteLocale } from "@/lib/i18n/metadata";

interface LocalePrivacyPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: LocalePrivacyPageProps): Promise<Metadata> {
  const { locale } = await params;
  return applyLocaleMetadata(baseMetadata, resolveRouteLocale(locale), "/privacy");
}

export default PrivacyPage;
