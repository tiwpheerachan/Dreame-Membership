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
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || ''}/auth/callback?type=recovery`

  const { data, error } = await service.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  })

  if (error || !data?.properties?.action_link) {
    // User probably doesn't exist — keep the response generic.
    console.error('[send-reset] generateLink:', error)
    return NextResponse.json({ success: true })
  }

  try {
    const tpl = resetPasswordEmail(data.properties.action_link)
    await sendEmail({ to: email, ...tpl })
  } catch (e) {
    console.error('[send-reset] Resend:', e)
    return NextResponse.json({ error: 'ส่งอีเมลไม่สำเร็จ' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
