// End-to-end auth-flow probe — creates a throwaway user via the
// admin API, asks Supabase to mint signup / recovery links, then exercises
// our /auth/callback against those tokens to make sure verifyOtp wires
// everything (email confirmation + session cookies) correctly.
//
//   npx tsx scripts/test-auth-flow.ts
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Load .env.local manually so we don't pull in dotenv as a dep
try {
  const env = readFileSync('.env.local', 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
} catch { /* ignore */ }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const APP          = process.env.TEST_APP_URL || 'http://localhost:3000'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const stamp = Date.now()
const email = `qa-${stamp}@shd-technology.co.th`
const password = `Qa-${stamp}-Pass`

async function main() {
  console.log(`\n=== Test user: ${email} ===\n`)

  // 1) Create user (mirrors what /api/auth/signup does)
  const { error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: false,
    user_metadata: { full_name: 'QA Bot' },
  })
  if (createErr) { console.error('createUser failed:', createErr); process.exit(1) }
  console.log('✓ createUser')

  // 2) Generate signup link
  const sign = await admin.auth.admin.generateLink({ type: 'signup', email, password })
  if (sign.error || !sign.data?.properties?.hashed_token) {
    console.error('generateLink(signup) failed:', sign.error)
    process.exit(1)
  }
  const signType = (sign.data.properties as { verification_type?: string }).verification_type
  console.log('✓ generateLink(signup):', { verification_type: signType })

  // 3) Hit our /auth/callback with that token
  const url = `${APP}/auth/callback?token_hash=${encodeURIComponent(sign.data.properties.hashed_token)}&type=${encodeURIComponent(signType || 'signup')}`
  console.log('  → GET', url.slice(0, 80) + '…')
  const r1 = await fetch(url, { redirect: 'manual' })
  const loc1 = r1.headers.get('location') || ''
  console.log(`✓ callback responded ${r1.status} → ${loc1}`)
  if (loc1.includes('error=expired')) { console.error('FAIL: token rejected'); process.exit(1) }

  // 4) Confirm the user is now confirmed
  const { data: { users } } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 })
  const u = users?.find(x => x.email === email)
  if (!u) { console.error('FAIL: user vanished'); process.exit(1) }
  if (!u.email_confirmed_at) { console.error('FAIL: email_confirmed_at still null'); process.exit(1) }
  console.log('✓ email_confirmed_at:', u.email_confirmed_at)

  // 5) Generate recovery link
  const rec = await admin.auth.admin.generateLink({ type: 'recovery', email })
  if (rec.error || !rec.data?.properties?.hashed_token) {
    console.error('generateLink(recovery) failed:', rec.error)
    process.exit(1)
  }
  const recType = (rec.data.properties as { verification_type?: string }).verification_type
  console.log('✓ generateLink(recovery):', { verification_type: recType })

  const url2 = `${APP}/auth/callback?token_hash=${encodeURIComponent(rec.data.properties.hashed_token)}&type=${encodeURIComponent(recType || 'recovery')}`
  const r2 = await fetch(url2, { redirect: 'manual' })
  const loc2 = r2.headers.get('location') || ''
  console.log(`✓ callback responded ${r2.status} → ${loc2}`)
  if (loc2.includes('error=expired')) { console.error('FAIL: recovery token rejected'); process.exit(1) }
  if (!loc2.includes('/auth/reset-password')) {
    console.error('FAIL: recovery did not redirect to reset-password')
    process.exit(1)
  }

  // 6) Verify Set-Cookie headers came back so the browser would be authenticated
  const setCookies = r1.headers.getSetCookie?.() ?? []
  const sbCookies = setCookies.filter(c => /^sb-[^=]+=/.test(c))
  if (sbCookies.length === 0) {
    console.error('FAIL: callback did not set sb-* session cookies')
    console.error('  Set-Cookie headers:', setCookies)
    process.exit(1)
  }
  console.log(`✓ session cookies set (${sbCookies.length} sb-* cookies)`)

  // 7) Use those cookies to hit a protected endpoint — proves the session
  //    is actually live (not just cookies named correctly).
  const cookieHeader = sbCookies.map(c => c.split(';')[0]).join('; ')
  const meRes = await fetch(`${APP}/api/users/me`, { headers: { cookie: cookieHeader } })
  if (!meRes.ok) {
    console.error('FAIL: /api/users/me returned', meRes.status, await meRes.text())
    process.exit(1)
  }
  const meBody = await meRes.json().catch(() => null)
  console.log('✓ /api/users/me responded:', meBody ? Object.keys(meBody).slice(0, 4) : 'no body')

  // 8) Cleanup
  await admin.auth.admin.deleteUser(u.id)
  console.log('✓ cleanup\n')
  console.log('ALL GREEN — signup verification + recovery flow works end-to-end')
}

main().catch(e => { console.error(e); process.exit(1) })
