import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'

type EmailOtpType = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  // Two link formats land here:
  //   1) ?code=...               — PKCE flow from supabase.auth.signInWithOAuth etc.
  //   2) ?token_hash=...&type=…  — what our send-verification / send-reset routes
  //                                build from auth.admin.generateLink() output.
  // We accept both so existing OAuth + new email flows both work.
  const code = requestUrl.searchParams.get('code')
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  // Redirect on the same origin the user actually hit. Using a static env
  // var here means localhost users would get bounced to production after
  // verifying, dropping their freshly-set session cookies.
  const proto = request.headers.get('x-forwarded-proto') || requestUrl.protocol.replace(':', '')
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || requestUrl.host
  const baseUrl = `${proto}://${host}`

  if (!code && !tokenHash) {
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

  let session: Awaited<ReturnType<typeof supabase.auth.exchangeCodeForSession>>['data']['session'] | null = null
  let user: Awaited<ReturnType<typeof supabase.auth.exchangeCodeForSession>>['data']['user'] | null = null
  let authError: { message: string } | null = null

  if (tokenHash) {
    const otpType: EmailOtpType =
      type === 'recovery'     ? 'recovery'     :
      type === 'signup'       ? 'signup'       :
      type === 'invite'       ? 'invite'       :
      type === 'email_change' ? 'email_change' :
      type === 'email'        ? 'email'        :
      'magiclink'
    const { data, error } = await supabase.auth.verifyOtp({ type: otpType, token_hash: tokenHash })
    session = data.session
    user = data.user
    authError = error
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    session = data.session
    user = data.user
    authError = error
  }

  if (authError || !session || !user) {
    console.error('[auth/callback]', authError)
    return NextResponse.redirect(new URL('/login?error=expired', baseUrl))
  }

  // Recovery → go to "set new password" screen instead of home
  if (type === 'recovery') {
    const response = NextResponse.redirect(new URL('/auth/reset-password', baseUrl))
    for (const { name, value, options } of sessionCookies) {
      response.cookies.set({ name, value, ...(options as Record<string, string>) })
    }
    return response
  }

  // Signup / magiclink → ensure profile row exists, then push to /terms or /home
  let { data: profile } = await supabase
    .from('users')
    .select('id, full_name, terms_accepted_at')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    await supabase.from('users').insert({
      id: user.id,
      email: user.email ?? null,
      full_name: (user.user_metadata as Record<string, unknown> | null)?.full_name ?? null,
    })
    profile = {
      id: user.id,
      full_name: ((user.user_metadata as Record<string, unknown> | null)?.full_name as string | null) ?? null,
      terms_accepted_at: null,
    }
  }

  const redirectUrl = profile.terms_accepted_at ? '/home' : '/terms'
  const response = NextResponse.redirect(new URL(redirectUrl, baseUrl))
  for (const { name, value, options } of sessionCookies) {
    response.cookies.set({ name, value, ...(options as Record<string, string>) })
  }
  return response
}
