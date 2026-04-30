// ============================================================
// Email sender — Resend SDK
//
// All transactional emails go through Resend, not Supabase's default
// email service (which is heavily rate-limited and lands in spam).
//
// Required env:
//   RESEND_API_KEY  — from https://resend.com/api-keys
//   EMAIL_FROM      — verified sender, e.g. "Dreame <noreply@yourdomain.com>"
//
// The sender domain MUST be verified at https://resend.com/domains.
// Without DKIM/SPF, mailbox providers will reject or spam-folder the message.
// ============================================================
import { Resend } from 'resend'

let cached: Resend | null = null

function client(): Resend {
  if (cached) return cached
  const key = process.env.RESEND_API_KEY
  if (!key) {
    throw new Error('RESEND_API_KEY is not set — add it to .env.local')
  }
  cached = new Resend(key)
  return cached
}

const FROM = () => process.env.EMAIL_FROM || 'Dreame <onboarding@resend.dev>'

interface SendArgs {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail({ to, subject, html, text }: SendArgs) {
  const r = client()
  const from = FROM()
  // Log the resolved FROM each call so it's obvious when the env is stale
  // (e.g., after editing .env.local without a full restart).
  console.log(`[email] from=${from} to=${to}`)
  const result = await r.emails.send({ from, to: [to], subject, html, text })
  if (result.error) {
    // Surface Resend errors so the calling endpoint can return a real message.
    throw new Error(`Resend: ${result.error.message || JSON.stringify(result.error)}`)
  }
  return result.data
}

// ────────────────────────────────────────────────────────────────
// Templates
// ────────────────────────────────────────────────────────────────

const BRAND = {
  bg:   '#FAF7F2',
  text: '#1A1815',
  mute: '#6B6256',
  gold: '#A0782B',
  goldSoft: '#EADBB1',
  black: '#0E0E0E',
}

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${escape(title)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:'Helvetica Neue',Arial,sans-serif;color:${BRAND.text};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.bg};">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0"
             style="max-width:520px;background:#fff;border-radius:18px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(20,18,15,0.08);">
        <tr><td style="padding:36px 36px 24px;">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.18em;font-weight:700;
                    text-transform:uppercase;color:${BRAND.mute};">DREAME MEMBERSHIP</p>
          <h1 style="margin:0;font-size:22px;font-weight:800;letter-spacing:-0.01em;color:${BRAND.text};">
            ${escape(title)}
          </h1>
        </td></tr>
        <tr><td style="padding:0 36px 32px;font-size:14px;line-height:1.65;color:${BRAND.text};">
          ${bodyHtml}
        </td></tr>
        <tr><td style="background:${BRAND.black};padding:18px 36px;">
          <p style="margin:0;font-size:11px;color:rgba(234,219,177,0.65);
                    letter-spacing:0.06em;text-align:center;">
            © ${new Date().getFullYear()} Dreame Membership · This email was sent automatically.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"
                 style="margin:18px 0 8px;"><tr><td>
    <a href="${escape(href)}"
       style="display:inline-block;padding:13px 28px;background:${BRAND.black};
              color:${BRAND.goldSoft};text-decoration:none;font-weight:700;font-size:14px;
              border-radius:12px;letter-spacing:0.02em;">
      ${escape(label)}
    </a>
  </td></tr></table>`
}

export function verificationEmail(link: string) {
  return {
    subject: 'ยืนยันอีเมลของคุณ — Dreame Membership',
    html: shell('ยืนยันอีเมล', `
      <p style="margin:0 0 12px;">สวัสดี,</p>
      <p style="margin:0 0 12px;">
        ขอบคุณที่สมัครสมาชิก Dreame Membership — กดปุ่มด้านล่างเพื่อยืนยันอีเมลและเริ่มใช้งานบัญชีของคุณ
      </p>
      ${button(link, 'ยืนยันอีเมล')}
      <p style="margin:18px 0 6px;font-size:12px;color:${BRAND.mute};">
        หากปุ่มไม่ทำงาน คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:
      </p>
      <p style="margin:0;font-size:12px;color:${BRAND.gold};word-break:break-all;">
        ${escape(link)}
      </p>
      <p style="margin:24px 0 0;font-size:12px;color:${BRAND.mute};line-height:1.6;">
        ลิงก์นี้ใช้งานได้ครั้งเดียวและจะหมดอายุภายใน 24 ชั่วโมง<br>
        หากคุณไม่ได้สมัครสมาชิก โปรดเพิกเฉยอีเมลฉบับนี้
      </p>
    `),
    text: `ยืนยันอีเมล Dreame Membership\n\nคลิกลิงก์ด้านล่างเพื่อยืนยันอีเมลของคุณ:\n${link}\n\nลิงก์นี้จะหมดอายุภายใน 24 ชั่วโมง`,
  }
}

export function resetPasswordEmail(link: string) {
  return {
    subject: 'รีเซ็ตรหัสผ่าน — Dreame Membership',
    html: shell('รีเซ็ตรหัสผ่าน', `
      <p style="margin:0 0 12px;">สวัสดี,</p>
      <p style="margin:0 0 12px;">
        เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ — กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่
      </p>
      ${button(link, 'ตั้งรหัสผ่านใหม่')}
      <p style="margin:18px 0 6px;font-size:12px;color:${BRAND.mute};">
        หากปุ่มไม่ทำงาน คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:
      </p>
      <p style="margin:0;font-size:12px;color:${BRAND.gold};word-break:break-all;">
        ${escape(link)}
      </p>
      <p style="margin:24px 0 0;font-size:12px;color:${BRAND.mute};line-height:1.6;">
        ลิงก์นี้ใช้งานได้ครั้งเดียวและจะหมดอายุภายใน 1 ชั่วโมง<br>
        <strong>หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน</strong> โปรดเพิกเฉยอีเมลฉบับนี้และตรวจสอบความปลอดภัยบัญชี
      </p>
    `),
    text: `รีเซ็ตรหัสผ่าน Dreame Membership\n\nคลิกลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่:\n${link}\n\nลิงก์จะหมดอายุภายใน 1 ชั่วโมง\nหากคุณไม่ได้ขอรีเซ็ต โปรดเพิกเฉยอีเมลฉบับนี้`,
  }
}
