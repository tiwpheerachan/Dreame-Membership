// ============================================================
// POST /api/auth/send-reset  { email }
//
// Generates a password-recovery magic link via Supabase admin API,
// then delivers it via Resend.
// Always returns success (even on no-such-user) to avoid email enumeration —
// the underlying error is logged server-side for debugging.
// ============================================================
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendEmail, resetPasswordEmail } from '@/lib/email'

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
  // Same host-derivation as send-verification — see comments there.
  const proto = req.headers.get('x-forwarded-proto')
    || (req.url.startsWith('https://') ? 'https' : 'http')
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const baseUrl = host
    ? `${proto}://${host}`
    : (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '')

  const { data, error } = await service.auth.admin.generateLink({
    type: 'recovery',
    email,
  })

  if (error || !data?.properties?.hashed_token) {
    // User probably doesn't exist — keep the response generic.
    console.error('[send-reset] generateLink:', error)
    return NextResponse.json({ success: true })
  }

  // Build our own callback URL with the hashed_token; we'll verify it
  // server-side in /auth/callback via verifyOtp instead of going through
  // Supabase's hosted verify endpoint.
  const verType = (data.properties as { verification_type?: string }).verification_type || 'recovery'
  const link = `${baseUrl}/auth/callback?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=${encodeURIComponent(verType)}`

  try {
    const tpl = resetPasswordEmail(link)
    await sendEmail({ to: email, ...tpl })
  } catch (e) {
    console.error('[send-reset] Resend:', e)
    return NextResponse.json({ error: 'ส่งอีเมลไม่สำเร็จ' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
