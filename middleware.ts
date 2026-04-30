import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ─── Performance notes ────────────────────────────────────────────
// This runs on every navigation under the matcher. We want it to be FAST,
// because every millisecond here delays the click → render of the next page.
//
//   • supabase.auth.getSession()  reads the cookie locally — instant.
//   • supabase.auth.getUser()     re-validates the JWT against Supabase auth
//                                 servers — adds 200-800ms over the network.
//
// We use getSession() here. The session is only used for redirect decisions
// (show login vs the app shell). Actual data access is RLS-protected and
// will reject tampered/expired tokens at the data layer.
//
// We also avoid hitting the DB inside middleware — the terms-accepted check
// happens once at the auth callback / /home page and doesn't need to gate
// every navigation.
// ──────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: Record<string, unknown>) {
          request.cookies.set({ name, value, ...(options as Record<string, string>) })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...(options as Record<string, string>) })
        },
        remove(name: string, options: Record<string, unknown>) {
          request.cookies.set({ name, value: '', ...(options as Record<string, string>) })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...(options as Record<string, string>) })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const isLoggedIn = !!session?.user
  const path = request.nextUrl.pathname

  // ─── User routes ───────────────────────────────────────────
  const isUserRoute = path === '/home' || path.startsWith('/purchases') ||
    path.startsWith('/points') || path.startsWith('/coupons') ||
    path.startsWith('/profile') || path.startsWith('/promotions') ||
    path.startsWith('/notifications')

  if (isUserRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ─── Admin routes — auth-gate here, role check in app/(admin)/layout.tsx
  if (path.startsWith('/admin') && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ─── If logged in, /login → /home
  if (path === '/login' && isLoggedIn) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/home',
    '/purchases/:path*',
    '/points',
    '/coupons',
    '/profile',
    '/promotions',
    '/notifications',
    '/admin/:path*',
    '/login',
    '/terms',
  ],
}
