import type { Metadata } from "next";
import RefundPage, { metadata as baseMetadata } from "../../refund/page";
import { applyLocaleMetadata, resolveRouteLocale } from "@/lib/i18n/metadata";

interface LocaleRefundPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: LocaleRefundPageProps): Promise<Metadata> {
  const { locale } = await params;
  return applyLocaleMetadata(baseMetadata, resolveRouteLocale(locale), "/refund");
}

export default RefundPage;
