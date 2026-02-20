import { notFound } from "next/navigation";
import { getNonDefaultLocalePathSegments, resolveLocaleFromPathSegment } from "@/lib/i18n/routing";

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    locale: string;
  }>;
}

export function generateStaticParams() {
  return getNonDefaultLocalePathSegments().map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  if (!resolveLocaleFromPathSegment(locale)) {
    notFound();
  }

  return children;
}
