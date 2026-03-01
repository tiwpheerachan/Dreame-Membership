import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/home'

  if (!code) {
    // ไม่มี code → ลิงก์ผิดพลาดหรือหมดอายุ
    return NextResponse.redirect(new URL('/login?error=expired', requestUrl.origin))
  }

  const cookieStore = cookies()

  // สร้าง response ก่อนแล้วค่อย set cookies ลงไป
  const response = NextResponse.redirect(new URL(next, requestUrl.origin))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          // Set บน response เพื่อให้ browser รับ session cookie ได้
          response.cookies.set({ name, value, ...(options as Record<string, string>) })
        },
        remove(name: string, options: Record<string, unknown>) {
          response.cookies.set({ name, value: '', ...(options as Record<string, string>) })
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    // Code ใช้ไปแล้ว หรือหมดอายุ
    return NextResponse.redirect(new URL('/login?error=expired', requestUrl.origin))
  }

  // ดึงข้อมูล user profile
  const { data: user } = await supabase
    .from('users')
    .select('id, full_name, terms_accepted_at')
    .eq('id', data.session.user.id)
    .single()

  if (!user || !user.full_name) {
    // User ใหม่ → ไปกรอกชื่อก่อน
    return NextResponse.redirect(new URL('/login?new=1', requestUrl.origin))
  }

  if (!user.terms_accepted_at) {
    // User เก่าที่ยังไม่เคย accept terms
    // ต้อง redirect พร้อม session cookie
    const termsResponse = NextResponse.redirect(new URL('/terms', requestUrl.origin))
    // Copy cookies จาก response ไปยัง termsResponse
    response.cookies.getAll().forEach(cookie => {
      termsResponse.cookies.set(cookie)
    })
    return termsResponse
  }

  // User ปกติ → เข้าหน้าหลัก (session cookie ถูก set ใน response แล้ว)
  return response
}