// ============================================================
// นำเข้าสิทธิรับน้ำยาฟรีจากไฟล์ CSV (POS export) → ตาราง refill_privileges
//
// ต้องรัน migration 0039 ก่อน (ตารางต้องมีอยู่)
// รอบ 4 รอบจะถูกสร้างอัตโนมัติด้วย trigger gen_refill_rounds
//
// ใช้งาน:
//   node scripts/import-refill-privileges.mjs "/path/to/Member - รับน้ำยาฟรี.csv"
//   node scripts/import-refill-privileges.mjs --dry "/path/..."   (ดูผลก่อน ไม่เขียน)
//
// อ่าน SUPABASE creds จาก .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
// idempotent: กันซ้ำด้วย transaction_id (unique)
// ============================================================
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const args = process.argv.slice(2)
const DRY = args.includes('--dry')
const csvPath = args.find(a => !a.startsWith('--')) || `${process.env.HOME}/Downloads/Member - รับน้ำยาฟรี.csv`

// ── env ──
const env = {}
for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!SB_URL || !SB_KEY) { console.error('FATAL: missing Supabase env'); process.exit(1) }

const sb = (path, opts = {}) => fetch(`${SB_URL}/rest/v1/${path}`, {
  ...opts,
  headers: {
    apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json',
    Prefer: 'return=representation', ...(opts.headers || {}),
  },
})

// ── helpers ──
function last9(raw) {
  if (!raw) return null
  const d = String(raw).replace(/\D/g, '')
  return d.length >= 9 ? d.slice(-9) : null
}

// "29-06-2026 21:10" | "11/6/2026 13:10"  (day-first ทั้งคู่) → ISO
function parseThaiDateTime(raw) {
  if (!raw || !raw.trim()) return null
  const [datePart, timePart = '00:00'] = raw.trim().split(/\s+/)
  const parts = datePart.split(/[-/]/).map(x => x.trim())
  if (parts.length !== 3) return null
  let [d, m, y] = parts.map(Number)
  if (!d || !m || !y) return null
  if (y < 100) y += 2000
  const [hh = 0, mm = 0] = timePart.split(':').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, hh, mm))
  return isNaN(dt.getTime()) ? null : dt.toISOString()
}

// split CSV line (data นี้ไม่มี comma ในฟิลด์ — split ตรงๆ + strip BOM/quotes)
function splitLine(line) {
  return line.split(',').map(c => c.replace(/^﻿/, '').replace(/^"|"$/g, '').trim())
}

// ── parse CSV ──
const raw = readFileSync(csvPath, 'utf8')
const lines = raw.split(/\r?\n/).filter(l => l.trim())
const header = splitLine(lines[0])
console.log(`CSV: ${csvPath}\nrows: ${lines.length - 1}\n`)

const rows = []
const skipped = []
for (let i = 1; i < lines.length; i++) {
  const c = splitLine(lines[i])
  // index: 0 memberType 1 first 2 last 3 phone 4 txn 5 model 6 src 7 amount 8 pStatus 9 point 10 (empty) 11 branch 12 createBy 13 createDate 14 expDate 15 remark
  const phone = last9(c[3])
  const purchased = parseThaiDateTime(c[13])
  const txn = (c[4] || '').trim() || null
  if (!phone || !purchased) { skipped.push({ line: i + 1, reason: !phone ? 'no phone' : 'no create date', raw: c[3] }); continue }
  rows.push({
    member_type:    c[0] || null,
    customer_name:  [c[1], c[2]].filter(Boolean).join(' ').trim() || null,
    phone,
    transaction_id: txn,
    model:          (c[5] || '').trim() || null,
    order_amount:   c[7] ? Number(String(c[7]).replace(/,/g, '')) || null : null,
    branch:         (c[11] || '').trim() || null,
    purchased_at:   purchased,
    expires_at:     parseThaiDateTime(c[14]),
    source:         'CSV_IMPORT',
  })
}

console.log(`valid rows: ${rows.length}   skipped: ${skipped.length}`)
skipped.forEach(s => console.log(`  skip line ${s.line}: ${s.reason} (${s.raw || ''})`))
console.log()

if (DRY) {
  console.log('── DRY RUN (ไม่เขียน) — ตัวอย่าง 3 แถว: ──')
  rows.slice(0, 3).forEach(r => console.log(JSON.stringify(r)))
  process.exit(0)
}

// ── match user_id by phone (last-9) ──
async function findUser(phone9) {
  const r = await sb(`users?select=id,phone&phone=ilike.*${phone9}`)
  if (!r.ok) return null
  const users = await r.json()
  const hit = users.find(u => last9(u.phone) === phone9)
  return hit?.id || null
}

// ── insert (idempotent) ──
let inserted = 0, linked = 0, dup = 0, failed = 0
for (const row of rows) {
  // dedup: มี txn เดียวกันแล้วข้าม
  if (row.transaction_id) {
    const ex = await (await sb(`refill_privileges?select=id&transaction_id=eq.${encodeURIComponent(row.transaction_id)}`)).json()
    if (Array.isArray(ex) && ex.length) { dup++; continue }
  }
  const user_id = await findUser(row.phone)
  if (user_id) linked++
  const res = await sb('refill_privileges', { method: 'POST', body: JSON.stringify({ ...row, user_id }) })
  if (res.ok) inserted++
  else { failed++; console.error(`  insert fail (${row.transaction_id || row.phone}):`, (await res.text()).slice(0, 200)) }
}

console.log(`\n✅ DONE — inserted ${inserted}, linked-to-user ${linked}, skipped-dup ${dup}, failed ${failed}`)
console.log('   (รอบ 4 รอบต่อออเดอร์ถูกสร้างอัตโนมัติด้วย trigger)')
