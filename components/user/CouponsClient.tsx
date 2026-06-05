'use client'
import { useState } from 'react'
import type { Coupon } from '@/types'
import CouponCard from './CouponCard'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  active:  Coupon[]
  used:    Coupon[]
  expired: Coupon[]
}

export default function CouponsClient({ active, used, expired }: Props) {
  const [showHistory, setShowHistory] = useState(false)

  const Section = ({ title, list, status, accent }: {
    title: string; list: Coupon[]; status: 'active' | 'used' | 'expired'; accent: string
  }) => (
    list.length > 0 ? (
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '4px 4px 12px' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent }} />
          <p style={{
            margin: 0, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.16em', textTransform: 'uppercase',
            color: 'var(--ink-mute)',
          }}>{title}</p>
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

  const historyCount = used.length + expired.length

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
        <Section title="ใช้ได้" list={active} status="active" accent="var(--green)" />

        {active.length === 0 && (
          <div className="card-product" style={{ padding: '32px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--ink-mute)', margin: 0, lineHeight: 1.6 }}>
              ยังไม่มีคูปองที่ใช้ได้ในตอนนี้<br/>
              <span style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>
                อัปเลเวลสมาชิกเพื่อรับคูปองพิเศษ
              </span>
            </p>
          </div>
        )}

        {historyCount > 0 && (
          <div>
            <button
              onClick={() => setShowHistory(s => !s)}
              className="tap"
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderRadius: 12,
                background: 'var(--surface)', border: '1px solid var(--hair)',
                cursor: 'pointer',
              }}>
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.16em',
                textTransform: 'uppercase', color: 'var(--ink-mute)',
              }}>
                ประวัติ ({historyCount})
              </span>
              <span style={{ color: 'var(--ink-faint)', display: 'inline-flex', alignItems: 'center' }}>
                {showHistory ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
              </span>
            </button>

            {showHistory && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <Section title="ใช้แล้ว" list={used}    status="used"    accent="var(--ink-mute)" />
                <Section title="หมดอายุ" list={expired} status="expired" accent="var(--red)" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
