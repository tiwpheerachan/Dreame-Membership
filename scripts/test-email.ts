// Direct probe of the Resend integration. Bypasses Supabase / our API
// routes so we can isolate whether the failure is in Resend itself.
//   npx tsx scripts/test-email.ts [optional-recipient@example.com]
import { Resend } from 'resend'
import { readFileSync } from 'fs'

try {
  const env = readFileSync('.env.local', 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
} catch { /* ignore */ }

const KEY  = process.env.RESEND_API_KEY
const FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev'
const TO   = process.argv[2] || 'the.dataverse@shd-technology.co.th'

if (!KEY) { console.error('FAIL: RESEND_API_KEY not set in .env.local'); process.exit(1) }

console.log('Config:')
console.log('  KEY prefix:', KEY.slice(0, 8) + '…')
console.log('  FROM      :', FROM)
console.log('  TO        :', TO)
console.log()

const resend = new Resend(KEY)

;(async () => {
  console.log('1) Sending direct test email…')
  const r = await resend.emails.send({
    from: FROM,
    to: [TO],
    subject: 'Resend probe — Dreame Membership',
    html: `<p>Probe at ${new Date().toISOString()}</p>`,
    text: `Probe at ${new Date().toISOString()}`,
  })
  if (r.error) {
    console.error('FAIL — Resend rejected:', r.error)
    console.error('\nCommon causes:')
    console.error('  - "from" domain not verified at resend.com/domains')
    console.error('  - Test mode: can only send to your own resend account email')
    console.error('  - Invalid / revoked API key')
    process.exit(1)
  }
  console.log('   ✓ accepted, id:', r.data?.id)

  // 2) Check delivery log via Resend API
  console.log('\n2) Fetching email status from Resend API…')
  const statusRes = await fetch(`https://api.resend.com/emails/${r.data?.id}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  })
  const statusBody = await statusRes.json()
  console.log('  ', JSON.stringify(statusBody, null, 2))

  console.log('\nIf "last_event" is "delivered" → mail server accepted it.')
  console.log('If recipient still does not see it → check spam, then DNS records (DKIM/SPF) at resend.com/domains/<domain>')
})().catch(e => { console.error(e); process.exit(1) })
