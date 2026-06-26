'use client'
import type { Coupon } from '@/types'
import { formatDate } from '@/lib/utils'
import { Copy, Check, Info, ExternalLink, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'
import { useState, useEffect } from 'react'
import CouponDetail from './CouponDetail'
import { getCouponTheme } from '@/lib/coupon-themes'

interface Props { coupon: Coupon; status: 'active' | 'used' | 'expired' }

export default function CouponCard({ coupon, status }: Props) {
  const [copied, setCopied] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const isActive = status === 'active'
  const isPercent = coupon.discount_type === 'PERCENT'
  const theme = getCouponTheme(isActive ? coupon.theme : 'black')

  // ── Realtime price sync (POINTS_CASH reward coupons only) ──
  const isPointsCashReward = isActive
    && coupon.reward_meta?.redeem_type === 'POINTS_CASH'
    && coupon.reward_meta?.shopify_product_url
    && coupon.reward_meta?.cash_top_up_thb != null
  const [livePrice, setLivePrice] = useState<{
    current: number; discount: number; cash_top_up: number; sale: boolean
  } | null>(null)
  const [livePriceLoading, setLivePriceLoading] = useState(false)

  // Fetch live price on mount (เฉพาะ POINTS_CASH)
  useEffect(() => {
    if (!isPointsCashReward) return
    let cancel = false
    setLivePriceLoading(true)
    fetch(`/api/redemptions/${coupon.reward_meta!.redemption_id}/live-price`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (cancel || !d.success) return
        const cash = Number(coupon.reward_meta!.cash_top_up_thb || 0)
        setLivePrice({
          current:      d.current_price,
          discount:     d.current_price - cash,
          cash_top_up:  cash,
          sale:         d.compare_at_price && d.compare_at_price > d.current_price,
        })
      })
      .catch(() => { /* ignore */ })
      .finally(() => { if (!cancel) setLivePriceLoading(false) })
    return () => { cancel = true }
  }, [isPointsCashReward, coupon.reward_meta])

  // Display discount value — POINTS_CASH ใช้ live, อื่นๆใช้ snapshot
  const displayDiscount = (isPointsCashReward && livePrice)
    ? livePrice.discount
    : coupon.discount_value
  // ตรวจว่า discount เปลี่ยนจาก snapshot ไหม (เพื่อโชว์ pulse animation)
  const discountChanged = isPointsCashReward && livePrice
    && Math.abs(livePrice.discount - coupon.discount_value) > 0.01

  // Use button: open THIS coupon's own apply link (cart permalink that carries
  // this exact code + product). We deliberately do NOT regenerate the code here —
  // regenerating produced a new code each click that no longer matched the code
  // shown on the coupon ("โค้ดไม่ตรงกัน"). The code stays stable = always matches.
  function smartUse(e: React.MouseEvent) {
    e.stopPropagation(); e.preventDefault()
    const target = coupon.apply_url || coupon.reward_meta?.shopify_product_url
    if (target) window.open(target, '_blank')
  }

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
        {/* If coupon has image (reward coupon), show product image instead of theme stamp */}
        {coupon.image_url ? (
          <div style={{
            width: 92, flexShrink: 0, position: 'relative',
            background: 'var(--bg-soft)',
            borderRight: '1px dashed var(--line)',
            overflow: 'hidden',
          }}>
            {/* Notches */}
            <div style={{
              position: 'absolute', top: -7, right: -7, zIndex: 2,
              width: 14, height: 14, borderRadius: '50%',
              background: '#fff', border: '1px solid var(--line)',
            }} />
            <div style={{
              position: 'absolute', bottom: -7, right: -7, zIndex: 2,
              width: 14, height: 14, borderRadius: '50%',
              background: '#fff', border: '1px solid var(--line)',
            }} />
            {/* Product image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coupon.image_url} alt={coupon.title || 'reward'}
              style={{ width: '100%', height: '100%', objectFit: 'cover',
                opacity: isActive ? 1 : 0.5 }} />
            {/* Gold overlay tag — discount value */}
            <div style={{
              position: 'absolute', bottom: 4, left: 4, right: 4, zIndex: 3,
              background: isActive
                ? 'linear-gradient(135deg, #FAF3DC 0%, #C9A063 100%)'
                : 'rgba(0,0,0,0.55)',
              color: isActive ? '#1A1815' : '#fff',
              padding: '3px 4px', borderRadius: 4,
              textAlign: 'center', backdropFilter: 'blur(4px)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
            }}>
              <p style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '0.14em',
                textTransform: 'uppercase', margin: 0, opacity: 0.85, lineHeight: 1 }}>
                {isPercent ? 'OFF' : '฿ OFF'}
              </p>
              <p className="numerals" style={{
                fontSize: 13.5, fontWeight: 800, lineHeight: 1.05, margin: '1px 0 0',
                letterSpacing: '-0.01em',
                transition: 'all 0.3s ease',
                opacity: livePriceLoading ? 0.5 : 1,
              }}>
                {isPercent
                  ? `${displayDiscount}%`
                  : Number(Math.round(displayDiscount)).toLocaleString()}
              </p>
              {discountChanged && (
                <p style={{ fontSize: 6.5, margin: '1px 0 0', opacity: 0.7,
                  textDecoration: 'line-through', lineHeight: 1 }}>
                  {Number(coupon.discount_value).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        ) : (
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
              transition: 'all 0.3s ease',
              opacity: livePriceLoading ? 0.5 : 1,
            }}>
              {isPercent
                ? `${displayDiscount}`
                : `${Number(Math.round(displayDiscount)).toLocaleString()}`}
            </p>
            {discountChanged && (
              <p style={{ fontSize: 10, margin: '2px 0 0',
                color: isActive ? theme.stampAccent : 'var(--ink-faint)',
                opacity: 0.7, textDecoration: 'line-through' }}>
                {Number(coupon.discount_value).toLocaleString()}
              </p>
            )}
            <p className="serif-i" style={{
              fontSize: 11, margin: '4px 0 0',
              color: isActive ? theme.stampAccent : 'var(--ink-faint)',
            }}>
              {isPercent ? 'percent' : '฿'}
            </p>
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 12px 8px', flex: 1, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
              <p className="kicker" style={{ margin: '0 0 2px', fontSize: 8.5 }}>EXCLUSIVE OFFER</p>
              <Info size={11} color="var(--ink-faint)" />
            </div>
            <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 2px', lineHeight: 1.25,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as const,
            }}>
              {coupon.title || 'คูปองส่วนลด'}
            </p>
            {coupon.description && (
              <p className="serif-i" style={{
                fontSize: 10.5, color: 'var(--ink-mute)', margin: '0 0 4px', lineHeight: 1.4,
                overflow: 'hidden', display: '-webkit-box',
                WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as const,
              }}>
                {coupon.description}
              </p>
            )}
            {coupon.min_purchase > 0 && (
              <p style={{ fontSize: 10, color: 'var(--ink-faint)', margin: 0 }}>
                ขั้นต่ำ ฿{Number(coupon.min_purchase).toLocaleString()}
              </p>
            )}

            {/* ── Points + Cash summary — "X แต้ม + ฿Y" ── */}
            {isPointsCashReward && coupon.reward_meta?.points_used && (
              <div style={{
                marginTop: 5,
                display: 'inline-flex', alignItems: 'baseline', gap: 4,
                padding: '3px 8px', borderRadius: 'var(--r-pill)',
                background: 'linear-gradient(135deg, #FAF3DC, #EADBB1)',
                border: '1px solid rgba(201,155,62,0.30)',
              }}>
                <span className="numerals" style={{ fontSize: 11.5, fontWeight: 800, color: '#A0782B' }}>
                  {Number(coupon.reward_meta.points_used).toLocaleString()}
                </span>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#A0782B' }}>แต้ม</span>
                <span style={{ fontSize: 10, color: '#A0782B', margin: '0 1px' }}>+</span>
                <span className="numerals" style={{ fontSize: 11.5, fontWeight: 800, color: '#1A1815' }}>
                  ฿{Number(coupon.reward_meta.cash_top_up_thb || 0).toLocaleString()}
                </span>
              </div>
            )}

            {/* Realtime live price (POINTS_CASH reward only) — compact */}
            {isPointsCashReward && (
              <div style={{
                marginTop: 5, padding: '4px 7px', borderRadius: 5,
                background: livePrice?.sale
                  ? 'rgba(58,142,90,0.08)'
                  : 'rgba(201,155,62,0.06)',
                border: `1px solid ${livePrice?.sale ? 'rgba(58,142,90,0.25)' : 'rgba(201,155,62,0.25)'}`,
                fontSize: 10, lineHeight: 1.35,
              }}>
                {livePriceLoading ? (
                  <span style={{ color: 'var(--ink-mute)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <RefreshCw size={9} className="animate-spin" /> เช็คราคาล่าสุด...
                  </span>
                ) : livePrice ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    {livePrice.sale ? <TrendingDown size={10} color="#3A8E5A"/> : <TrendingUp size={10} color="var(--gold-deep)"/>}
                    <span style={{ color: livePrice.sale ? '#3A8E5A' : 'var(--gold-deep)', fontWeight: 700 }}>
                      ฿{livePrice.current.toLocaleString()}
                    </span>
                    <span style={{ color: 'var(--ink-mute)' }}>→ จ่าย</span>
                    <b style={{ color: 'var(--gold-deep)' }}>
                      ฿{livePrice.cash_top_up.toLocaleString()}
                    </b>
                  </span>
                ) : (
                  <span style={{ color: 'var(--ink-faint)' }}>
                    sync ตอนกด ใช้
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Bottom bar — code + action */}
          <div style={{
            background: 'var(--black)', color: '#fff',
            padding: '7px 12px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <p style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.55)', margin: 0,
                letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                {status === 'used' ? 'ใช้แล้ว' : status === 'expired' ? 'หมดอายุ' : `EXP ${formatDate(coupon.valid_until)}`}
              </p>
              <p style={{
                fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 700,
                color: 'var(--gold-soft)', margin: '1px 0 0', letterSpacing: '0.10em',
              }}>
                {coupon.code}
              </p>
            </div>
            {isActive && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                {(coupon.apply_url || coupon.reward_meta) && (
                  <button onClick={smartUse}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '5px 10px', borderRadius: 'var(--r-pill)',
                      background: '#5E8E3E', color: '#fff',
                      border: 'none', cursor: 'pointer',
                      fontSize: 10.5, fontWeight: 700,
                    }}>
                    <ExternalLink size={10}/> ใช้
                  </button>
                )}
                <button onClick={copy} className="tap" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '5px 10px', borderRadius: 'var(--r-pill)',
                  background: copied ? 'var(--gold)' : 'var(--gold-soft)',
                  color: copied ? '#fff' : 'var(--ink)',
                  border: 'none', cursor: 'pointer', fontSize: 10.5, fontWeight: 700,
                  transition: 'all 0.18s ease',
                }}>
                  {copied ? <><Check size={10}/> COPIED</> : <><Copy size={10}/> COPY</>}
                </button>
              </div>
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
