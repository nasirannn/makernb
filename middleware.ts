import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  LOCALE_COOKIE_KEY,
  getLocalePathSegment,
  normalizeLocale,
  stripLocalePrefix,
  resolveLocaleFromPathSegment,
  withLocalePrefix,
} from "@/lib/i18n/routing";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";

const PERMANENT_REDIRECT_STATUS = 308;
const STATIC_FILE_PATTERN = /\.[^/]+$/;
const LEGACY_PATH_REDIRECTS: Record<string, string> = {
  "/studio": "/music-generator",
  "/vocal-remover": "/vocal-separation",
  "/vocal-removal": "/vocal-separation",
};

function resolvePreferredLocale(request: NextRequest) {
  const localeFromCookie = request.cookies.get(LOCALE_COOKIE_KEY)?.value;
  if (localeFromCookie) {
    return normalizeLocale(localeFromCookie);
  }

  // Keep default language deterministic: no cookie means English.
  return DEFAULT_LOCALE;
}

function attachLocaleCookie(response: NextResponse, locale: string) {
  response.cookies.set({
    name: LOCALE_COOKIE_KEY,
    value: locale,
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

function withNoIndexHeader(response: NextResponse) {
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function resolveLegacyRedirectPath(pathname: string): string | null {
  const directRedirectTarget = LEGACY_PATH_REDIRECTS[pathname];
  if (directRedirectTarget) {
    return directRedirectTarget;
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    return null;
  }

  const localePathSegment = segments[0];
  const localeFromPath = resolveLocaleFromPathSegment(localePathSegment);
  if (!localeFromPath) {
    return null;
  }

  const localeStrippedPath = `/${segments.slice(1).join("/")}`;
  const redirectedLocaleStrippedPath = LEGACY_PATH_REDIRECTS[localeStrippedPath];
  if (!redirectedLocaleStrippedPath) {
    return null;
  }

  return `/${localePathSegment}${redirectedLocaleStrippedPath}`;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Keep callback and API routes path-stable; only normalize trailing slash.
  const isApiRoute = pathname === "/api" || pathname.startsWith("/api/");
  const isAuthRoute = pathname === "/auth" || pathname.startsWith("/auth/");
  if (isApiRoute || isAuthRoute) {
    if (pathname.endsWith("/") && pathname !== "/" && pathname !== "/api/" && pathname !== "/auth/") {
      const url = request.nextUrl.clone();
      url.pathname = pathname.slice(0, -1);
      return NextResponse.redirect(url, PERMANENT_REDIRECT_STATUS);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/_next/") || pathname === "/favicon.ico" || STATIC_FILE_PATTERN.test(pathname)) {
    return NextResponse.next();
  }

  // Normalize trailing slash before locale handling.
  if (pathname.endsWith("/") && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(0, -1);
    return NextResponse.redirect(url, PERMANENT_REDIRECT_STATUS);
  }

  const legacyRedirectPath = resolveLegacyRedirectPath(pathname);
  if (legacyRedirectPath) {
    const url = request.nextUrl.clone();
    url.pathname = legacyRedirectPath;
    return NextResponse.redirect(url, PERMANENT_REDIRECT_STATUS);
  }

  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? null;
  const localeFromPath = resolveLocaleFromPathSegment(firstSegment);

  if (localeFromPath) {
    // Default locale should not appear in the URL path.
    if (localeFromPath === DEFAULT_LOCALE) {
      const url = request.nextUrl.clone();
      url.pathname = stripLocalePrefix(pathname).split("?")[0] || "/";
      return withNoIndexHeader(
        attachLocaleCookie(
          NextResponse.redirect(url, PERMANENT_REDIRECT_STATUS),
          localeFromPath
        )
      );
    }

    const canonicalSegment = getLocalePathSegment(localeFromPath);
    if (firstSegment !== canonicalSegment) {
      const url = request.nextUrl.clone();
      const remainingPath = pathname.split("/").filter(Boolean).slice(1).join("/");
      url.pathname = remainingPath ? `/${canonicalSegment}/${remainingPath}` : `/${canonicalSegment}`;
      return withNoIndexHeader(
        attachLocaleCookie(
          NextResponse.redirect(url, PERMANENT_REDIRECT_STATUS),
          localeFromPath
        )
      );
    }

    return attachLocaleCookie(NextResponse.next(), localeFromPath);
  }

  const preferredLocale = resolvePreferredLocale(request);
  if (preferredLocale === DEFAULT_LOCALE) {
    return attachLocaleCookie(NextResponse.next(), preferredLocale);
  }

  const targetPath = withLocalePrefix(`${pathname}${search}`, preferredLocale);
  if (targetPath === `${pathname}${search}`) {
    return attachLocaleCookie(NextResponse.next(), preferredLocale);
  }
  const targetUrl = new URL(targetPath, request.url);

  return withNoIndexHeader(
    attachLocaleCookie(
      NextResponse.redirect(targetUrl, PERMANENT_REDIRECT_STATUS),
      preferredLocale
    )
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
