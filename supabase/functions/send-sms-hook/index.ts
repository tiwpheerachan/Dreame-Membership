// ============================================================
// Supabase "Send SMS" Hook → ThaiBulkSMS
//
// Flow:
//   User: supabase.auth.signInWithOtp({ phone: '+66...' })
//   → Supabase Auth generates the OTP, POSTs to this hook
//   → We verify the webhook signature (HMAC over the body)
//   → We forward "<otp> คือรหัสยืนยัน Dreame Membership ของคุณ" to
//     ThaiBulkSMS /sms endpoint
//   → Return 200 to Supabase (anything else → user sees "could not send")
//
// Deploy:
//   supabase functions deploy send-sms-hook --no-verify-jwt
//
// Configure in Supabase Dashboard → Auth → Hooks → Send SMS Hook:
//   URL    = https://<project>.supabase.co/functions/v1/send-sms-hook
//   Secret = $SMS_HOOK_SECRET (must match env on this function)
// ============================================================

// deno-lint-ignore-file no-explicit-any
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

const TBS_API_KEY    = Deno.env.get('THAIBULKSMS_API_KEY') ?? ''
const TBS_API_SECRET = Deno.env.get('THAIBULKSMS_API_SECRET') ?? ''
// Default empty — trial accounts must NOT send a sender field or they
// hit ERROR_SENDER. Set to a registered sender name (e.g. "Dreame")
// only after ThaiBulkSMS approves it.
const TBS_SENDER     = Deno.env.get('THAIBULKSMS_SENDER') ?? ''
const TBS_FORCE      = Deno.env.get('THAIBULKSMS_FORCE') ?? 'standard'

// Supabase stores the secret as "v1,whsec_<base64>" (the v1 is for
// versioning + rotation). The standardwebhooks library wants just the
// base64 part (with or without the "whsec_" prefix), so we strip "v1,"
// before passing it down.
//
// Trying both env names because the Supabase secrets UI shows it as
// SEND_SMS_HOOK_SECRETS (plural) while local .env uses SMS_HOOK_SECRET.
const RAW_HOOK_SECRET = Deno.env.get('SEND_SMS_HOOK_SECRETS') ?? Deno.env.get('SMS_HOOK_SECRET') ?? ''
const HOOK_SECRET = RAW_HOOK_SECRET.replace(/^v1,/, '')

interface SmsPayload {
  user: { id: string; phone: string }
  sms: { otp: string; sms_type: 'sms' | 'whatsapp'; otp_type?: string }
}

async function postToThaiBulkSMS(params: Record<string, string>): Promise<{ ok: boolean; status: number; text: string }> {
  const basicAuth = btoa(`${TBS_API_KEY}:${TBS_API_SECRET}`)
  const res = await fetch('https://api-v2.thaibulksms.com/sms', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams(params).toString(),
  })
  return { ok: res.ok, status: res.status, text: await res.text() }
}

// Heuristic: response looks like sender/route-related rejection?
function isSenderError(text: string): boolean {
  return /ERROR_SENDER|sender.*not.*allow|sender.*invalid|force|corporate/i.test(text)
}

async function sendViaThaiBulkSMS(phone: string, otp: string) {
  // ThaiBulkSMS expects msisdn without "+" but with country code (e.g. 66812345678)
  const msisdn = phone.startsWith('+') ? phone.slice(1) : phone
  // ใช้ message สั้น — sender name "DreameTH" จะแสดงให้ user เห็นอยู่แล้ว
  const message =
    `รหัสยืนยัน: ${otp} ` +
    `ห้ามแจ้งรหัสนี้กับผู้อื่น (หมดอายุใน 5 นาที)`

  const baseParams: Record<string, string> = { msisdn, message }

  // ── Attempt 1: ใช้ config ที่ admin ตั้ง (sender + force) ──
  const primaryParams: Record<string, string> = { ...baseParams, force: TBS_FORCE }
  if (TBS_SENDER && TBS_SENDER.trim() !== '') primaryParams.sender = TBS_SENDER

  let primary = await postToThaiBulkSMS(primaryParams)
  if (primary.ok) {
    console.log('[send-sms-hook] sent ok (primary) →', msisdn, primary.text)
    return primary.text
  }

  // ── Attempt 2: fallback ถ้า sender/route ผิดพลาด ──
  // เช่น corporate route ยังไม่เปิด หรือ sender "DreameTH" ยังไม่ propagate
  // → ลอง standard + ไม่มี sender (ใช้ shortcode default)
  if (isSenderError(primary.text) || primary.status === 400) {
    console.warn(
      '[send-sms-hook] primary failed, retry without sender →',
      primary.status, primary.text,
    )
    const fallbackParams: Record<string, string> = { ...baseParams, force: 'standard' }
    const fallback = await postToThaiBulkSMS(fallbackParams)
    if (fallback.ok) {
      console.log('[send-sms-hook] sent ok (fallback) →', msisdn, fallback.text)
      return fallback.text + ' [fallback: no sender]'
    }
    throw new Error(
      `ThaiBulkSMS ทั้ง primary และ fallback ล้มเหลว. ` +
      `Primary (${primary.status}): ${primary.text}. ` +
      `Fallback (${fallback.status}): ${fallback.text}`
    )
  }

  throw new Error(`ThaiBulkSMS ${primary.status}: ${primary.text}`)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 })
  }

  // Read body as raw text — needed for HMAC verification before parsing.
  const raw = await req.text()

  let payload: SmsPayload
  try {
    if (!HOOK_SECRET) {
      // Dev mode without secret — accept everything but log loudly.
      console.warn('[send-sms-hook] no HOOK_SECRET set; skipping signature check')
      payload = JSON.parse(raw)
    } else {
      const wh = new Webhook(HOOK_SECRET)
      const headers = Object.fromEntries(req.headers)
      payload = wh.verify(raw, headers) as SmsPayload
    }
  } catch (e) {
    console.error('[send-sms-hook] signature/parse failed:', (e as Error).message)
    return new Response(JSON.stringify({ error: 'invalid signature' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  const phone = payload?.user?.phone
  const otp   = payload?.sms?.otp
  if (!phone || !otp) {
    return new Response(JSON.stringify({ error: 'missing phone or otp' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  try {
    const result = await sendViaThaiBulkSMS(phone, otp)
    console.log('[send-sms-hook] sent ok →', phone, result)
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (e) {
    console.error('[send-sms-hook] provider failed:', (e as Error).message)
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
})
