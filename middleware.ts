import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
  const path = request.nextUrl.pathname

  // ─── User routes ───────────────────────────────────────────
  const isUserRoute = path === '/home' || path.startsWith('/purchases') ||
    path.startsWith('/points') || path.startsWith('/coupons') ||
    path.startsWith('/profile')

  if (isUserRoute) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    // ตรวจ terms — ยกเว้นหน้า /terms เอง
    if (path !== '/terms') {
      const { data: user } = await supabase
        .from('users')
        .select('terms_accepted_at')
        .eq('id', session.user.id)
        .single()
      if (user && !user.terms_accepted_at) {
        return NextResponse.redirect(new URL('/terms', request.url))
      }
    }
  }

  // ─── Admin routes ──────────────────────────────────────────
  if (path.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // ─── ถ้า login แล้วพยายามเข้า /login → redirect ไป /home ──
  if (path === '/login' && session) {
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
    '/admin/:path*',
    '/login',
    '/terms',
  ],
}