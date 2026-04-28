import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const type = requestUrl.searchParams.get('type')
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=expired', baseUrl))
  }

  const cookieStore = cookies()
  const sessionCookies: { name: string; value: string; options: Record<string, unknown> }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: Record<string, unknown>) {
          sessionCookies.push({ name, value, options })
        },
        remove(name: string, options: Record<string, unknown>) {
          sessionCookies.push({ name, value: '', options })
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session || !data.user) {
    return NextResponse.redirect(new URL('/login?error=expired', baseUrl))
  }

  // กรณี reset password → ไปหน้าตั้งรหัสใหม่
  if (type === 'recovery') {
    const response = NextResponse.redirect(new URL('/auth/reset-password', baseUrl))
    for (const { name, value, options } of sessionCookies) {
      response.cookies.set({ name, value, ...(options as Record<string, string>) })
    }
    return response
  }

  // กรณีปกติ → ตรวจสอบ user profile (DB trigger should have created it).
  // We still defensively insert here for older accounts predating the trigger,
  // and to avoid redirect loops if the trigger ever fails.
  let { data: profile } = await supabase
    .from('users')
    .select('id, full_name, terms_accepted_at')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!profile) {
    await supabase.from('users').insert({
      id: data.user.id,
      email: data.user.email ?? null,
      full_name: data.user.user_metadata?.full_name ?? null,
    })
    profile = { id: data.user.id, full_name: data.user.user_metadata?.full_name ?? null, terms_accepted_at: null }
  }

  const redirectUrl = profile.terms_accepted_at ? '/home' : '/terms'

  const response = NextResponse.redirect(new URL(redirectUrl, baseUrl))
  for (const { name, value, options } of sessionCookies) {
    response.cookies.set({ name, value, ...(options as Record<string, string>) })
  }
  return response
}