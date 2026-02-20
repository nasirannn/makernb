import type { Metadata } from "next";
import TermsPage, { metadata as baseMetadata } from "../../terms/page";
import { applyLocaleMetadata, resolveRouteLocale } from "@/lib/i18n/metadata";

interface LocaleTermsPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: LocaleTermsPageProps): Promise<Metadata> {
  const { locale } = await params;
  return applyLocaleMetadata(baseMetadata, resolveRouteLocale(locale), "/terms");
}

export default TermsPage;
