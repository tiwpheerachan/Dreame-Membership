// Server-side fetch: refill rounds keyed by the purchase_registration they belong to.
// สิทธิน้ำยาฟรีที่ auto-grant (Brand Shop) ผูกกับ registration ด้วย purchase_reg_id.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RefillRound } from './refill'

export async function getRefillRoundsByRegIds(
  supabase: SupabaseClient,
  regIds: string[],
): Promise<Map<string, RefillRound[]>> {
  const map = new Map<string, RefillRound[]>()
  if (regIds.length === 0) return map

  const { data: privs, error } = await supabase
    .from('refill_privileges')
    .select('id, purchase_reg_id')
    .in('purchase_reg_id', regIds)
    .is('deleted_at', null)
  // ตารางยังไม่ถูกสร้าง / คอลัมน์ยังไม่มี → ไม่ต้อง error หน้าจอ
  if (error || !privs?.length) return map

  const regByPriv = new Map(privs.map(p => [p.id as string, p.purchase_reg_id as string]))
  const { data: rounds } = await supabase
    .from('refill_rounds')
    .select('id, privilege_id, round_no, due_date, claim_open, claim_close, status, claimed_at')
    .in('privilege_id', privs.map(p => p.id as string))
    .order('round_no', { ascending: true })

  for (const r of rounds || []) {
    const regId = regByPriv.get(r.privilege_id as string)
    if (!regId) continue
    const arr = map.get(regId) || []
    arr.push(r as unknown as RefillRound)
    map.set(regId, arr)
  }
  return map
}
