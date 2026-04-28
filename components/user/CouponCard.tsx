'use client'
import type { Coupon } from '@/types'
import { formatDate } from '@/lib/utils'
import { Copy, Check, Info } from 'lucide-react'
import { useState } from 'react'
import CouponDetail from './CouponDetail'
import { getCouponTheme } from '@/lib/coupon-themes'

interface Props { coupon: Coupon; status: 'active' | 'used' | 'expired' }

export default function CouponCard({ coupon, status }: Props) {
  const [copied, setCopied] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const isActive = status === 'active'
  const isPercent = coupon.discount_type === 'PERCENT'
  const theme = getCouponTheme(isActive ? coupon.theme : 'black')

  function copy(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(coupon.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <div
        onClick={() => setShowDetail(true)}
        className="tap"
        style={{
          display: 'flex',
          background: 'var(--surface)',
          border: '1px solid var(--hair)',
          borderRadius: 'var(--r-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-1)',
          opacity: isActive ? 1 : 0.55,
          position: 'relative',
          cursor: 'pointer',
          transition: 'transform 0.18s ease, box-shadow 0.18s ease',
        }}
      >
        {/* Stamp side — themed */}
        <div style={{
          width: 110, flexShrink: 0,
          background: isActive ? theme.stampBg : 'var(--bg-soft)',
          borderRight: isActive ? '1px dashed rgba(255,255,255,0.20)' : '1px dashed var(--line)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '14px 8px',
          position: 'relative',
          color: isActive ? theme.stampText : 'var(--ink)',
        }}>
          {/* Notch */}
          <div style={{
            position: 'absolute', top: -8, right: -8,
            width: 16, height: 16, borderRadius: '50%',
            background: '#fff', border: '1px solid var(--line)',
          }} />
          <div style={{
            position: 'absolute', bottom: -8, right: -8,
            width: 16, height: 16, borderRadius: '50%',
            background: '#fff', border: '1px solid var(--line)',
          }} />

          <p style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.20em', textTransform: 'uppercase',
            margin: '0 0 6px',
            color: isActive ? theme.stampAccent : 'var(--ink-faint)',
          }}>
            {isPercent ? 'OFF' : 'BAHT'}
          </p>
          <p className="numerals" style={{
            fontSize: 32, lineHeight: 1, margin: 0, letterSpacing: '-0.02em',
            color: isActive ? theme.stampText : 'var(--ink-faint)',
          }}>
            {isPercent ? `${coupon.discount_value}` : `${Number(coupon.discount_value).toLocaleString()}`}
          </p>
          <p className="serif-i" style={{
            fontSize: 11, margin: '4px 0 0',
            color: isActive ? theme.stampAccent : 'var(--ink-faint)',
          }}>
            {isPercent ? 'percent' : '฿'}
          </p>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 16px 10px', flex: 1, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <p className="kicker" style={{ margin: '0 0 4px' }}>EXCLUSIVE OFFER</p>
              <Info size={12} color="var(--ink-faint)" />
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px', lineHeight: 1.3 }}>
              {coupon.title || 'คูปองส่วนลด'}
            </p>
            {coupon.description && (
              <p className="serif-i" style={{
                fontSize: 11, color: 'var(--ink-mute)', margin: '0 0 6px', lineHeight: 1.5,
                overflow: 'hidden', display: '-webkit-box',
                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
              }}>
                {coupon.description}
              </p>
            )}
            {coupon.min_purchase > 0 && (
              <p style={{ fontSize: 10.5, color: 'var(--ink-faint)', margin: 0 }}>
                ยอดขั้นต่ำ ฿{Number(coupon.min_purchase).toLocaleString()}
              </p>
            )}
          </div>

          {/* Bottom bar — code + action */}
          <div style={{
            background: 'var(--black)', color: '#fff',
            padding: '10px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)', margin: 0, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                {status === 'used' ? 'ใช้แล้ว' : status === 'expired' ? 'หมดอายุ' : `EXP ${formatDate(coupon.valid_until)}`}
              </p>
              <p style={{
                fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
                color: 'var(--gold-soft)', margin: '2px 0 0', letterSpacing: '0.12em',
              }}>
                {coupon.code}
              </p>
            </div>
            {isActive && (
              <button onClick={copy} className="tap" style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 'var(--r-pill)',
                background: copied ? 'var(--gold)' : 'var(--gold-soft)',
                color: copied ? '#fff' : 'var(--ink)',
                border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                transition: 'all 0.18s ease',
              }}>
                {copied ? <><Check size={11}/> COPIED</> : <><Copy size={11}/> COPY</>}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Detail bottom sheet */}
      {showDetail && (
        <CouponDetail
          coupon={coupon}
          status={status}
          onClose={() => setShowDetail(false)}
        />
      )}
    </>
  )
}
