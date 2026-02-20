import type { Metadata } from "next";
import HomePage, { metadata as baseMetadata } from "../page";
import { applyLocaleMetadata, resolveRouteLocale } from "@/lib/i18n/metadata";

interface LocalePageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: LocalePageProps): Promise<Metadata> {
  const { locale } = await params;
  return applyLocaleMetadata(baseMetadata, resolveRouteLocale(locale), "/");
}

export default HomePage;
