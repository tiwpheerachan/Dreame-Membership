// GET /api/privileges/me
// คืนสิทธิรับน้ำยาฟรีของ user (ผูกด้วย user_id หรือเบอร์โทร last-9)
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, getRateKey } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// เบอร์ในตาราง refill_privileges เก็บแบบ national 9 หลัก (ตัด 0 หน้า)
// users.phone อาจเป็น '0952246276' / '+66952246276' → เอา 9 หลักท้าย
function last9(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  return digits.length >= 9 ? digits.slice(-9) : null
}

export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit({ key: getRateKey(req, user.id), limit: 60, windowMs: 60_000 })
  if (!rl.allowed) return NextResponse.json({ error: 'rate limited' }, { status: 429, headers: rl.headers })

  const service = createServiceClient()

  // เบอร์ของ user เอง (ไว้ match สิทธิที่ยังไม่ผูก user_id)
  const { data: me } = await service.from('users').select('phone').eq('id', user.id).single()
  const phone9 = last9(me?.phone)

  // ดึงสิทธิที่เป็นของ user นี้: user_id ตรง หรือ เบอร์ตรง
  const filters = [`user_id.eq.${user.id}`]
  if (phone9) filters.push(`phone.eq.${phone9}`)

  const { data: privileges, error } = await service
    .from('refill_privileges')
    .select('*')
    .is('deleted_at', null)   // ซ่อนสิทธิที่ถูกลบจากลูกค้า
    .or(filters.join(','))
    .order('purchased_at', { ascending: false })

  if (error) {
    // ตารางยังไม่ถูกสร้าง (ยังไม่รัน migration 0039)
    if (/refill_privileges.*does not exist|schema cache/i.test(error.message)) {
      return NextResponse.json({ privileges: [] }, { headers: rl.headers })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const privs = privileges || []
  if (privs.length === 0) return NextResponse.json({ privileges: [] }, { headers: rl.headers })

  // Auto-link: สิทธิที่ match เบอร์แต่ยังไม่ผูก user_id → ผูกให้เลย (idempotent)
  const unlinked = privs.filter(p => !p.user_id).map(p => p.id as string)
  if (unlinked.length > 0) {
    await service.from('refill_privileges').update({ user_id: user.id }).in('id', unlinked)
  }

  // ดึงรอบทั้งหมดของสิทธิเหล่านี้
  const ids = privs.map(p => p.id as string)
  const { data: rounds } = await service
    .from('refill_rounds')
    .select('*')
    .in('privilege_id', ids)
    .order('round_no', { ascending: true })

  const roundsByPriv: Record<string, unknown[]> = {}
  for (const r of rounds || []) {
    const k = r.privilege_id as string
    ;(roundsByPriv[k] ||= []).push(r)
  }

  const result = privs.map(p => ({ ...p, rounds: roundsByPriv[p.id as string] || [] }))

  return NextResponse.json({ privileges: result }, { headers: rl.headers })
}
