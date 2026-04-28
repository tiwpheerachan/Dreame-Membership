import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Ticket } from 'lucide-react'
import type { Coupon } from '@/types'
import CouponCard from '@/components/user/CouponCard'

export default async function CouponsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  const { data: coupons } = await supabase
    .from('coupons').select('*').eq('user_id', user.id)
    .order('valid_until', { ascending: true })

  const active  = (coupons || []).filter((c: Coupon) => !c.used_at && c.valid_until >= today)
  const used    = (coupons || []).filter((c: Coupon) =>  c.used_at)
  const expired = (coupons || []).filter((c: Coupon) => !c.used_at && c.valid_until <  today)

  const Section = ({ title, list, status, accent }: {
    title: string; list: Coupon[]; status: 'active'|'used'|'expired'; accent: string
  }) => (
    list.length > 0 ? (
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '4px 4px 12px' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent }} />
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
            {title}
          </p>
          <span style={{
            marginLeft: 'auto', fontSize: 11, fontWeight: 600,
            color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)',
          }}>
            {String(list.length).padStart(2, '0')}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map(c => <CouponCard key={c.id} coupon={c} status={status} />)}
        </div>
      </div>
    ) : null
  )

  return (
    <div className="page-enter" style={{ paddingTop: 18 }}>
      <header style={{ padding: '14px 20px 22px' }}>
        <p className="eyebrow" style={{ marginBottom: 10 }}>Privilege Vault</p>
        <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          <span style={{ fontWeight: 800 }}>คูปอง</span>{' '}
          <span className="serif-i" style={{ fontWeight: 400 }}>ของฉัน</span>
        </h1>
      </header>

      <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {active.length === 0 && used.length === 0 && expired.length === 0 ? (
          <div className="card-product" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '52px 24px', textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, margin: '0 auto 18px',
                borderRadius: '50%', background: 'var(--gold-glow)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--gold-deep)',
              }}>
                <Ticket size={26} strokeWidth={1.4} />
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: 18 }}>
                <span style={{ fontWeight: 800 }}>ยังไม่มี</span>{' '}
                <span className="serif-i" style={{ fontWeight: 400 }}>คูปอง</span>
              </h3>
              <p style={{ fontSize: 12.5, color: 'var(--ink-mute)', margin: 0, lineHeight: 1.6 }}>
                คูปองพิเศษจะปรากฏที่นี่<br/>เมื่อได้รับจาก Dreame
              </p>
            </div>
          </div>
        ) : (
          <>
            <Section title="ใช้ได้" list={active} status="active" accent="var(--green)" />
            <Section title="ใช้แล้ว" list={used} status="used" accent="var(--ink-mute)" />
            <Section title="หมดอายุ" list={expired} status="expired" accent="var(--red)" />
          </>
        )}
      </div>
    </div>
  )
}
