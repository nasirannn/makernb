import type { Metadata } from "next";
import PaymentSuccessLayout, { metadata as baseMetadata } from "../../../payment/success/layout";
import { applyLocaleMetadata, resolveRouteLocale } from "@/lib/i18n/metadata";

interface LocalePaymentSuccessLayoutProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: LocalePaymentSuccessLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  return applyLocaleMetadata(baseMetadata, resolveRouteLocale(locale), "/payment/success");
}

export default PaymentSuccessLayout;
