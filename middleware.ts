import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Normalize: strip trailing slash for all non-root paths
  if (pathname !== '/' && pathname.endsWith('/')) {
    const url = req.nextUrl.clone()
    // remove all trailing slashes to be safe
    url.pathname = pathname.replace(/\/+$/, '')
    return NextResponse.redirect(url, 308)
  }

  // Skip middleware for static files
  if (pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/)) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  // Allow access to /studio route but add auth status to headers
  if (pathname.startsWith('/studio')) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              req.cookies.set({ name, value, ...options })
            })
            response = NextResponse.next({
              request: {
                headers: req.headers,
              },
            })
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set({ name, value, ...options })
            })
          },
        },
      }
    )

    // Get session and refresh if needed
    const {
      data: { session },
    } = await supabase.auth.getSession()

    // Add auth status to response headers for the page to handle
    // Note: We allow access regardless of session status since studio page handles auth internally
    if (!session) {
      // Don't log this as it's expected behavior - studio page is accessible without auth
      response.headers.set('x-auth-required', 'true')
    } else {
      response.headers.set('x-auth-required', 'false')
    }
  }

  return response
}

export const config = {
  // Match all pages except for API routes, Next.js internals, and static files with extensions
  matcher: ['/((?!api|_next|.*\\..*).*)']
}
