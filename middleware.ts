import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

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

  // Refresh session if needed
  await supabase.auth.getSession()

  // Protect /studio route
  if (req.nextUrl.pathname.startsWith('/studio')) {
    // Check for Supabase session cookies
    const authCookies = req.cookies.getAll().filter(cookie =>
      cookie.name.includes('sb-') && cookie.name.includes('auth-token')
    )

    // If no auth cookies, redirect to home
    if (authCookies.length === 0) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    // Try to get session
    const {
      data: { session },
    } = await supabase.auth.getSession()

    // If no session and no valid auth tokens, redirect to home
    if (!session && !authCookies.some(c => c.value && c.value.length > 10)) {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/studio(.*)']
}
