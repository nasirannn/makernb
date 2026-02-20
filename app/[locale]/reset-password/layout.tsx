import type { Metadata } from "next";
import ResetPasswordLayout, { metadata as baseMetadata } from "../../reset-password/layout";
import { applyLocaleMetadata, resolveRouteLocale } from "@/lib/i18n/metadata";

interface LocaleResetPasswordLayoutProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: LocaleResetPasswordLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  return applyLocaleMetadata(baseMetadata, resolveRouteLocale(locale), "/reset-password");
}

export default ResetPasswordLayout;
