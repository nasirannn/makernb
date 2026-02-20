import type { Metadata } from "next";
import PricingPage, { metadata as baseMetadata } from "../../pricing/page";
import { applyLocaleMetadata, resolveRouteLocale } from "@/lib/i18n/metadata";

interface LocalePricingPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: LocalePricingPageProps): Promise<Metadata> {
  const { locale } = await params;
  return applyLocaleMetadata(baseMetadata, resolveRouteLocale(locale), "/pricing");
}

export default PricingPage;
