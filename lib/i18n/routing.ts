import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type AppLocale } from "@/lib/i18n/config";

export const LOCALE_COOKIE_KEY = "makernb.locale";

const LOCALE_TO_PATH_SEGMENT: Record<AppLocale, string> = {
  en: "en",
  "zh-CN": "zh",
  ja: "ja",
};

const PATH_SEGMENT_TO_LOCALE: Record<string, AppLocale> = {
  en: "en",
  zh: "zh-CN",
  "zh-cn": "zh-CN",
  ja: "ja",
  "ja-jp": "ja",
};

const EXTERNAL_PROTOCOL_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;

function splitPathQueryHash(input: string): { path: string; query: string; hash: string } {
  const [pathAndQuery, hashPart = ""] = input.split("#", 2);
  const [pathPart, queryPart = ""] = pathAndQuery.split("?", 2);
  return {
    path: pathPart || "/",
    query: queryPart ? `?${queryPart}` : "",
    hash: hashPart ? `#${hashPart}` : "",
  };
}

function normalizePath(path: string): string {
  if (!path) return "/";
  if (path.startsWith("/")) return path;
  return `/${path}`;
}

export function isSupportedLocale(locale: string | null | undefined): locale is AppLocale {
  if (!locale) return false;
  return SUPPORTED_LOCALES.includes(locale as AppLocale);
}

export function normalizeLocale(locale: string | null | undefined): AppLocale {
  if (!locale) return DEFAULT_LOCALE;
  if (isSupportedLocale(locale)) return locale;

  const normalized = locale.toLowerCase();
  if (normalized in PATH_SEGMENT_TO_LOCALE) {
    return PATH_SEGMENT_TO_LOCALE[normalized];
  }
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  if (normalized === "zh" || normalized.startsWith("zh-")) return "zh-CN";
  if (normalized === "ja" || normalized.startsWith("ja-")) return "ja";
  return DEFAULT_LOCALE;
}

export function getLocalePathSegment(locale: AppLocale): string {
  return LOCALE_TO_PATH_SEGMENT[locale];
}

export function getSupportedLocalePathSegments(): string[] {
  return Object.values(LOCALE_TO_PATH_SEGMENT);
}

export function getNonDefaultLocalePathSegments(): string[] {
  return SUPPORTED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE).map(getLocalePathSegment);
}

export function resolveLocaleFromPathSegment(segment: string | null | undefined): AppLocale | null {
  if (!segment) return null;
  const normalized = segment.toLowerCase();
  return PATH_SEGMENT_TO_LOCALE[normalized] ?? null;
}

export function getLocaleFromPathname(pathname: string | null | undefined): AppLocale | null {
  if (!pathname) return null;
  const { path } = splitPathQueryHash(pathname);
  const firstSegment = normalizePath(path).split("/").filter(Boolean)[0] ?? null;
  return resolveLocaleFromPathSegment(firstSegment);
}

export function stripLocalePrefix(pathname: string | null | undefined): string {
  if (!pathname) return "/";
  const { path, query, hash } = splitPathQueryHash(pathname);
  const normalizedPath = normalizePath(path);
  const segments = normalizedPath.split("/").filter(Boolean);

  if (segments.length === 0) {
    return `${normalizedPath}${query}${hash}`;
  }

  if (!resolveLocaleFromPathSegment(segments[0])) {
    return `${normalizedPath}${query}${hash}`;
  }

  const strippedPath = segments.length > 1 ? `/${segments.slice(1).join("/")}` : "/";
  return `${strippedPath}${query}${hash}`;
}

export function withLocalePrefix(pathname: string, locale: AppLocale): string {
  if (!pathname) {
    return locale === DEFAULT_LOCALE ? "/" : `/${getLocalePathSegment(locale)}`;
  }
  if (pathname.startsWith("#")) return pathname;
  if (EXTERNAL_PROTOCOL_PATTERN.test(pathname) || pathname.startsWith("//")) {
    return pathname;
  }
  if (pathname.startsWith("?")) {
    return locale === DEFAULT_LOCALE
      ? `/${pathname}`
      : `/${getLocalePathSegment(locale)}${pathname}`;
  }

  const { query, hash } = splitPathQueryHash(pathname);
  const basePath = stripLocalePrefix(pathname);
  const cleanBasePath = normalizePath(splitPathQueryHash(basePath).path);
  const localizedPath =
    locale === DEFAULT_LOCALE
      ? cleanBasePath
      : cleanBasePath === "/"
        ? `/${getLocalePathSegment(locale)}`
        : `/${getLocalePathSegment(locale)}${cleanBasePath}`;

  return `${localizedPath}${query}${hash}`;
}

export function replaceLocaleInPathname(pathname: string | null | undefined, locale: AppLocale): string {
  const currentPath = pathname && pathname.length > 0 ? pathname : "/";
  return withLocalePrefix(currentPath, locale);
}
