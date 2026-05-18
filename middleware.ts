import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ─── Auth check: getUser, not getSession ──────────────────────────
// getSession() อ่านจาก cookie ตรงๆ — ถ้า JWT หมดอายุ/invalid
// แต่ cookie ยังมี → คืนค่า user เป็น truthy
// getUser() validate กับ Supabase auth server — refresh token อัตโนมัติ
// ถ้า refresh ไม่ได้ → คืน null
//
// เคยใช้ getSession() เพื่อ perf (~200-800ms ต่างกัน) แต่เกิด redirect loop:
//   • middleware (getSession) คิดว่า login → ปล่อยผ่าน /home
//   • /home (getUser) คิดว่าไม่ login → redirect /login
//   • middleware ดู /login (getSession) คิดว่า login → redirect /home → loop
// correctness > speed
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

  const { data: { user } } = await supabase.auth.getUser()
  const isLoggedIn = !!user
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
