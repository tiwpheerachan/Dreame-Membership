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

  // generateLink({type:'signup'}) requires a password parameter for new users,
  // but for existing-but-unconfirmed users it just regenerates the link.
  // We try `magiclink` first (works for any existing user, confirms on click)
  // and fall back to `signup` if needed.
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || ''}/auth/callback`

  const { data, error } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo },
  })

  if (error || !data?.properties?.action_link) {
    console.error('[send-verification] generateLink:', error)
    // Don't leak whether the email exists.
    return NextResponse.json({ success: true })
  }

  try {
    const tpl = verificationEmail(data.properties.action_link)
    await sendEmail({ to: email, ...tpl })
  } catch (e) {
    console.error('[send-verification] Resend:', e)
    return NextResponse.json({ error: 'ส่งอีเมลไม่สำเร็จ' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
