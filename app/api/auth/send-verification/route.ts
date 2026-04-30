// ============================================================
// POST /api/auth/send-verification  { email }
//
// Generates a signup confirmation magic link via Supabase admin API,
// then delivers it via Resend (NOT Supabase's default mail service).
// Use this whenever the user needs another verification email — after
// signup, on login when they hit "email not confirmed", etc.
// ============================================================
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendEmail, verificationEmail } from '@/lib/email'

export async function POST(req: Request) {
  let email = ''
  try {
    const body = await req.json()
    email = String(body.email || '').trim().toLowerCase()
  } catch { /* fall through */ }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const service = createServiceClient()
  // Build the callback URL from the *request* host so dev links point at
  // localhost and prod links point at the deployed domain. Falling back to
  // env vars only if no host header is present (rare, e.g. internal calls).
  const proto = req.headers.get('x-forwarded-proto')
    || (req.url.startsWith('https://') ? 'https' : 'http')
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const baseUrl = host
    ? `${proto}://${host}`
    : (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '')

  // magiclink works for any existing user regardless of confirmation status.
  // When an unconfirmed user clicks the link, Supabase both signs them in
  // AND flips email_confirmed_at — so it doubles as a verification email.
  // (We don't have the user's password here, so 'signup' type isn't an option.)
  const { data, error } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  if (error || !data?.properties?.hashed_token) {
    console.error('[send-verification] generateLink:', error)
    // Don't leak whether the email exists.
    return NextResponse.json({ success: true })
  }

  const verType = (data.properties as { verification_type?: string }).verification_type || 'magiclink'
  const link = `${baseUrl}/auth/callback?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=${encodeURIComponent(verType)}`

  try {
    const tpl = verificationEmail(link)
    await sendEmail({ to: email, ...tpl })
  } catch (e) {
    console.error('[send-verification] Resend:', e)
    return NextResponse.json({ error: 'ส่งอีเมลไม่สำเร็จ' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
