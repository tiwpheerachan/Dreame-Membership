// ============================================================
// POST /api/auth/signup  { email, password, full_name }
//
// Creates the auth user via admin API with email_confirm:false (so they
// can't log in until they verify), then sends our own verification email
// via Resend. This bypasses Supabase's auto-mailer entirely — no duplicate
// emails, no rate-limit, full template control.
// ============================================================
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendEmail, verificationEmail } from '@/lib/email'

export async function POST(req: Request) {
  let email = '', password = '', fullName = ''
  try {
    const body = await req.json()
    email    = String(body.email || '').trim().toLowerCase()
    password = String(body.password || '')
    fullName = String(body.full_name || '').trim()
  } catch { /* fall through to validation */ }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'อีเมลไม่ถูกต้อง' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' }, { status: 400 })
  }

  const service = createServiceClient()

  // Create the auth user without email confirmation. They'll be confirmed
  // when they click the verification magic link (which calls verifyOtp).
  const { error: createErr } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: fullName ? { full_name: fullName } : {},
  })

  if (createErr) {
    const msg = createErr.message || ''
    if (/already (registered|been registered|exists)|user.*already|email.*already/i.test(msg)) {
      return NextResponse.json({ error: 'อีเมลนี้มีบัญชีอยู่แล้ว — กรุณาเข้าสู่ระบบ', code: 'already_registered' }, { status: 409 })
    }
    console.error('[signup] createUser:', createErr)
    return NextResponse.json({ error: msg || 'สมัครไม่สำเร็จ' }, { status: 400 })
  }

  // Build callback URL from the request host — dev links → localhost,
  // prod links → deployed domain.
  const proto = req.headers.get('x-forwarded-proto')
    || (req.url.startsWith('https://') ? 'https' : 'http')
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const baseUrl = host
    ? `${proto}://${host}`
    : (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '')

  // For users created with email_confirm:false, use 'signup' type so the
  // resulting verifyOtp call also flips email_confirmed_at to NOW. (magiclink
  // signs in but doesn't always update confirmation status.)
  const { data: linkData, error: linkErr } = await service.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
  })

  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error('[signup] generateLink:', linkErr)
    // User was created but we couldn't send the email — surface that so the
    // UI can prompt them to use "Resend verification" from the verify-sent screen.
    return NextResponse.json({
      success: true,
      email_sent: false,
      error: 'สร้างบัญชีสำเร็จ แต่ส่งอีเมลยืนยันไม่สำเร็จ — โปรดกด "ส่งอีเมลยืนยันใหม่"',
    })
  }

  // Use the verification_type Supabase actually generated — keeps the URL
  // type and the callback's verifyOtp() type in sync no matter which path
  // Supabase took internally.
  const verType = (linkData.properties as { verification_type?: string }).verification_type || 'signup'
  const link = `${baseUrl}/auth/callback?token_hash=${encodeURIComponent(linkData.properties.hashed_token)}&type=${encodeURIComponent(verType)}`

  try {
    const tpl = verificationEmail(link)
    await sendEmail({ to: email, ...tpl })
  } catch (e) {
    console.error('[signup] Resend:', e)
    return NextResponse.json({
      success: true,
      email_sent: false,
      error: 'สร้างบัญชีสำเร็จ แต่ส่งอีเมลยืนยันไม่สำเร็จ — โปรดกด "ส่งอีเมลยืนยันใหม่"',
    })
  }

  return NextResponse.json({ success: true, email_sent: true })
}
