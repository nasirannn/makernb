import type { Metadata } from "next";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type AppLocale } from "@/lib/i18n/config";
import { getLocalePathSegment, resolveLocaleFromPathSegment } from "@/lib/i18n/routing";

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://makernb.com";

const OPEN_GRAPH_LOCALE_MAP: Record<AppLocale, string> = {
  en: "en_US",
  "zh-CN": "zh_CN",
};

const HREFLANG_MAP: Record<AppLocale, string> = {
  en: "en",
  "zh-CN": "zh-CN",
};

function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function resolveRouteLocale(localeParam: string | null | undefined): AppLocale {
  return resolveLocaleFromPathSegment(localeParam) ?? DEFAULT_LOCALE;
}

export function buildLocalizedPath(path: string, locale: AppLocale): string {
  const normalizedPath = normalizePath(path);
  if (locale === DEFAULT_LOCALE) {
    return normalizedPath;
  }

  const localeSegment = getLocalePathSegment(locale);
  return normalizedPath === "/" ? `/${localeSegment}` : `/${localeSegment}${normalizedPath}`;
}

export function buildLocalizedAbsoluteUrl(path: string, locale: AppLocale): string {
  return `${SITE_URL}${buildLocalizedPath(path, locale)}`;
}

function buildLanguageAlternates(path: string) {
  return {
    ...Object.fromEntries(
      SUPPORTED_LOCALES.map((locale) => [HREFLANG_MAP[locale], buildLocalizedAbsoluteUrl(path, locale)])
    ),
    "x-default": buildLocalizedAbsoluteUrl(path, DEFAULT_LOCALE),
  };
}

export function applyLocaleMetadata(
  baseMetadata: Metadata | null | undefined,
  locale: AppLocale,
  path: string
): Metadata {
  const canonical = buildLocalizedAbsoluteUrl(path, locale);
  const languageAlternates = buildLanguageAlternates(path);

  return {
    ...(baseMetadata ?? {}),
    alternates: {
      ...(baseMetadata?.alternates ?? {}),
      canonical,
      languages: {
        ...(baseMetadata?.alternates?.languages ?? {}),
        ...languageAlternates,
      },
    },
    openGraph: {
      ...(baseMetadata?.openGraph ?? {}),
      url: canonical,
      locale: OPEN_GRAPH_LOCALE_MAP[locale],
    },
  };
}
