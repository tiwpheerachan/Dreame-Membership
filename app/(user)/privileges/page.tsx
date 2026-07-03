import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Gift } from 'lucide-react'
import PrivilegesClient from '@/components/user/PrivilegesClient'
import type { RefillRound } from '@/lib/refill'

export const dynamic = 'force-dynamic'

export interface Privilege {
  id: string
  customer_name: string | null
  transaction_id: string | null
  model: string | null
  branch: string | null
  order_amount: number | null
  purchased_at: string
  expires_at: string | null
  total_rounds: number
  benefit_label: string
  rounds: RefillRound[]
}

// users.phone ('0952…'/'+66952…') → 9 หลักท้าย ให้ตรงกับ refill_privileges.phone
function last9(raw: string | null | undefined): string | null {
  if (!raw) return null
  const d = raw.replace(/\D/g, '')
  return d.length >= 9 ? d.slice(-9) : null
}

export default async function PrivilegesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceClient()
  const { data: me } = await service.from('users').select('phone').eq('id', user.id).single()
  const phone9 = last9(me?.phone)

  const filters = [`user_id.eq.${user.id}`]
  if (phone9) filters.push(`phone.eq.${phone9}`)

  let privileges: Privilege[] = []
  const { data: privs, error } = await service
    .from('refill_privileges')
    .select('*')
    .or(filters.join(','))
    .order('purchased_at', { ascending: false })

  // ตารางยังไม่ถูกสร้าง (ยังไม่รัน migration 0039) → แสดง empty state
  if (!error && privs && privs.length > 0) {
    // Auto-link: สิทธิที่ match เบอร์แต่ยังไม่ผูก user_id
    const unlinked = privs.filter(p => !p.user_id).map(p => p.id as string)
    if (unlinked.length > 0) {
      await service.from('refill_privileges').update({ user_id: user.id }).in('id', unlinked)
    }

    const ids = privs.map(p => p.id as string)
    const { data: rounds } = await service
      .from('refill_rounds').select('*')
      .in('privilege_id', ids)
      .order('round_no', { ascending: true })

    const byPriv: Record<string, RefillRound[]> = {}
    for (const r of (rounds || []) as RefillRound[] & { privilege_id: string }[]) {
      ;(byPriv[(r as { privilege_id: string }).privilege_id] ||= []).push(r)
    }
    privileges = privs.map(p => ({ ...(p as unknown as Privilege), rounds: byPriv[p.id as string] || [] }))
  }

  if (privileges.length === 0) {
    return (
      <div className="page-enter" style={{ paddingTop: 18 }}>
        <header style={{ padding: '14px 20px 22px' }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>Member Exclusive</p>
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            <span style={{ fontWeight: 800 }}>สิทธิ</span>{' '}
            <span className="serif-i" style={{ fontWeight: 400 }}>พิเศษ</span>
          </h1>
        </header>
        <div style={{ padding: '0 16px 24px' }}>
          <div className="card-product" style={{ padding: '52px 24px', textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, margin: '0 auto 18px', borderRadius: '50%',
              background: 'var(--gold-glow)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'var(--gold-deep)',
            }}>
              <Gift size={26} strokeWidth={1.4} />
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: 18 }}>
              <span style={{ fontWeight: 800 }}>ยังไม่มี</span>{' '}
              <span className="serif-i" style={{ fontWeight: 400 }}>สิทธิพิเศษ</span>
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--ink-mute)', margin: 0, lineHeight: 1.6 }}>
              สิทธิรับน้ำยาฟรีจะปรากฏที่นี่<br/>เมื่อคุณซื้อเครื่องรุ่นที่ร่วมรายการ
            </p>
          </div>
        </div>
      </div>
    )
  }

  return <PrivilegesClient privileges={privileges} />
}
