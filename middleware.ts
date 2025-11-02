import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to handle URL trailing slash normalization
 * - API routes: Remove trailing slash (except /api/)
 * - All page routes: Remove trailing slash
 * Note: Home page canonical URL is handled in the client component
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle API routes: normalize to version without trailing slash
  if (pathname.startsWith('/api/')) {
    if (pathname.endsWith('/') && pathname !== '/api/') {
      const url = request.nextUrl.clone();
      url.pathname = pathname.slice(0, -1);
      return NextResponse.redirect(url, 307); // Use 307 temporary redirect
    }
    return NextResponse.next();
  }

  // Handle all page routes: remove trailing slash if present
  // Exception: home page (/) is allowed to keep or not keep trailing slash
  if (pathname.endsWith('/') && pathname !== '/') {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(0, -1);
    return NextResponse.redirect(url, 307); // Use 307 temporary redirect
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

