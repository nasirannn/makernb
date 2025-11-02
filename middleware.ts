import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to handle URL trailing slash normalization
 * - API routes: Remove trailing slash (except /api/)
 * - Home page (/): Add trailing slash if missing
 * - All other routes: Remove trailing slash
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle API routes: normalize to version without trailing slash
  if (pathname.startsWith('/api/')) {
    if (pathname.endsWith('/') && pathname !== '/api/') {
      const url = request.nextUrl.clone();
      url.pathname = pathname.slice(0, -1);
      console.log(`[MIDDLEWARE] Normalizing API route: ${pathname} -> ${url.pathname}`);
      return NextResponse.redirect(url, 308);
    }
    return NextResponse.next();
  }

  // Handle home page: ensure it has trailing slash
  if (pathname === '/') {
    // Home page should always have trailing slash
    return NextResponse.next();
  }

  // Handle all other routes: remove trailing slash if present
  if (pathname.endsWith('/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(0, -1);
    console.log(`[MIDDLEWARE] Removing trailing slash: ${pathname} -> ${url.pathname}`);
    return NextResponse.redirect(url, 308);
  }

  // Let the request pass through normally
  return NextResponse.next();
}

export const config = {
  // Match all routes except static files and Next.js internals
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};

