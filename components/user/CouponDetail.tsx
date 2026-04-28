'use client'
import { useState, useEffect } from 'react'
import { X, Copy, Check, Calendar, ShoppingBag, Tag, Clock, Sparkles } from 'lucide-react'
import type { Coupon } from '@/types'
import { formatDate } from '@/lib/utils'
import { getCouponTheme } from '@/lib/coupon-themes'

interface Props {
  coupon: Coupon | null
  status: 'active' | 'used' | 'expired'
  onClose: () => void
}

export default function CouponDetail({ coupon, status, onClose }: Props) {
  const [copied, setCopied] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (coupon) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [coupon])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') handleClose() }
    if (coupon) {
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
    }
  }, [coupon])

  function handleClose() {
    setClosing(true)
    setTimeout(() => { onClose(); setClosing(false) }, 180)
  }

  if (!coupon) return null

  const isActive = status === 'active'
  const isPercent = coupon.discount_type === 'PERCENT'
  const theme = getCouponTheme(isActive ? coupon.theme : 'black')

  function copy() {
    navigator.clipboard.writeText(coupon!.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const conditionLines = (coupon.description || '')
    .split(/\n+/).map(l => l.trim()).filter(Boolean)

  return (
    <>
      <style suppressHydrationWarning>{`
        @keyframes pop-bd-in   { from { opacity:0 } to { opacity:1 } }
        @keyframes pop-bd-out  { from { opacity:1 } to { opacity:0 } }
        @keyframes pop-in      { from { opacity:0; transform: scale(0.92); } to { opacity:1; transform: scale(1); } }
        @keyframes pop-out     { from { opacity:1; transform: scale(1); } to { opacity:0; transform: scale(0.96); } }
      `}</style>
      <div onClick={handleClose} style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
        background: 'rgba(14,14,14,0.55)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        animation: closing ? 'pop-bd-out 0.18s ease forwards' : 'pop-bd-in 0.2s ease forwards',
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          width: '100%', maxWidth: 380,
          maxHeight: 'min(80vh, 680px)',
          background: '#fff',
          borderRadius: 'var(--r-xl)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 32px 80px rgba(14,14,14,0.40), 0 16px 32px rgba(14,14,14,0.20)',
          animation: closing
            ? 'pop-out 0.18s cubic-bezier(0.4,0,1,1) forwards'
            : 'pop-in 0.30s cubic-bezier(0.34,1.36,0.64,1) forwards',
          position: 'relative',
        }}>
          {/* Close button */}
          <button onClick={handleClose} className="tap" style={{
            position: 'absolute', top: 12, right: 12, zIndex: 11,
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.22)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#fff',
          }}>
            <X size={15} strokeWidth={2.2} />
          </button>

          {/* Hero — compact, theme-colored */}
          <div style={{
            position: 'relative',
            background: theme.heroBg,
            color: '#fff',
            padding: '22px 22px',
            textAlign: 'center',
            overflow: 'hidden',
            flexShrink: 0,
          }}>
            <div aria-hidden style={{
              position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)',
              width: 220, height: 220, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 65%)',
              pointerEvents: 'none',
            }} />
            <span aria-hidden style={{ position: 'absolute', top: '20%', left: '14%', fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>✦</span>
            <span aria-hidden style={{ position: 'absolute', top: '30%', right: '18%', fontSize: 8, color: 'rgba(255,255,255,0.45)' }}>✦</span>
            <span aria-hidden style={{ position: 'absolute', bottom: '22%', right: '16%', fontSize: 9, color: 'rgba(255,255,255,0.50)' }}>✦</span>

            <span style={{
              position: 'relative', zIndex: 2,
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', borderRadius: 'var(--r-pill)',
              background: 'rgba(255,255,255,0.16)',
              border: '1px solid rgba(255,255,255,0.24)',
              color: '#fff',
              fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
              marginBottom: 12,
            }}>
              <Sparkles size={10} /> Exclusive Offer
            </span>

            <p style={{
              position: 'relative', zIndex: 2,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: theme.heroLabel, margin: '0 0 4px',
            }}>
              {isPercent ? 'Discount' : 'Save'}
            </p>

            <p className="display tnum" style={{
              position: 'relative', zIndex: 2,
              fontSize: 48, fontWeight: 800, lineHeight: 0.95, margin: 0,
              color: theme.heroAccent,
              textShadow: '0 2px 12px rgba(0,0,0,0.20)',
            }}>
              {isPercent ? `${coupon.discount_value}%` : `฿${Number(coupon.discount_value).toLocaleString()}`}
            </p>

            <p style={{
              position: 'relative', zIndex: 2,
              fontSize: 11, color: theme.heroLabel, margin: '6px 0 0', fontWeight: 500,
            }}>
              {isPercent ? 'percent off' : 'baht off'}
            </p>
          </div>

          {/* Scrollable middle */}
          <div style={{
            flex: 1, minHeight: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '18px 20px 14px',
          }}>
            <h2 className="display" style={{
              fontSize: 17, fontWeight: 800, margin: '0 0 14px', lineHeight: 1.3,
            }}>
              {coupon.title || 'คูปองส่วนลด'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              <InfoRow Icon={Calendar} label="ใช้ได้ตั้งแต่"
                value={`${formatDate(coupon.valid_from)} — ${formatDate(coupon.valid_until)}`} />
              {coupon.min_purchase > 0 && (
                <InfoRow Icon={ShoppingBag} label="ยอดขั้นต่ำ"
                  value={`฿${Number(coupon.min_purchase).toLocaleString()}`} />
              )}
              {coupon.max_discount && (
                <InfoRow Icon={Tag} label="ลดสูงสุด"
                  value={`฿${Number(coupon.max_discount).toLocaleString()}`} />
              )}
              {status === 'used' && coupon.used_at && (
                <InfoRow Icon={Clock} label="ใช้เมื่อ" value={formatDate(coupon.used_at)} />
              )}
            </div>

            {conditionLines.length > 0 && (
              <div>
                <p className="kicker" style={{ margin: '0 0 10px' }}>เงื่อนไข</p>
                <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                  {conditionLines.map((line, i) => (
                    <li key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7,
                      fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.55,
                    }}>
                      <span style={{
                        flexShrink: 0,
                        width: 16, height: 16, borderRadius: '50%',
                        background: 'var(--gold-glow)', color: 'var(--gold-deep)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 800,
                        marginTop: 1,
                      }}>
                        {i + 1}
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          {/* Sticky footer */}
          {isActive ? (
            <div style={{
              flexShrink: 0,
              padding: '12px 20px 18px',
              borderTop: '1px solid var(--hair)',
              background: '#fff',
            }}>
              <p className="kicker" style={{ margin: '0 0 8px', textAlign: 'center' }}>
                Coupon Code
              </p>
              <div style={{
                position: 'relative', overflow: 'hidden',
                border: '2px dashed var(--gold-line)',
                borderRadius: 'var(--r-md)',
                padding: '12px 16px',
                background: 'var(--gold-glow)',
                textAlign: 'center',
                marginBottom: 10,
              }}>
                <p style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 18, fontWeight: 800, letterSpacing: '0.18em',
                  color: 'var(--ink)', margin: 0,
                }}>
                  {coupon.code}
                </p>
              </div>
              <button onClick={copy} className="btn btn-ink tap" style={{ width: '100%', padding: '12px 18px' }}>
                {copied ? <><Check size={13} /> คัดลอกแล้ว</> : <><Copy size={13} /> คัดลอกโค้ด</>}
              </button>
            </div>
          ) : (
            <div style={{
              flexShrink: 0,
              padding: '12px 20px 18px',
              borderTop: '1px solid var(--hair)',
              background: '#fff',
            }}>
              <div style={{
                padding: '12px 14px', borderRadius: 'var(--r-md)',
                background: 'var(--bg-soft)',
                textAlign: 'center',
              }}>
                <p style={{ fontSize: 12.5, color: 'var(--ink-mute)', margin: 0, fontWeight: 600 }}>
                  {status === 'used' ? '✓ ใช้คูปองนี้แล้ว' : '⏰ คูปองหมดอายุแล้ว'}
                </p>
                <p style={{ fontSize: 10.5, color: 'var(--ink-faint)', margin: '4px 0 0', fontFamily: 'var(--font-mono)' }}>
                  {coupon.code}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function InfoRow({ Icon, label, value }: { Icon: typeof Calendar; label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px',
      background: 'var(--bg-soft)',
      borderRadius: 'var(--r-md)',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7,
        background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--ink-soft)', flexShrink: 0,
      }}>
        <Icon size={13} strokeWidth={1.7} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: 'var(--ink-mute)', margin: 0,
        }}>
          {label}
        </p>
        <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', margin: '1px 0 0' }}>
          {value}
        </p>
      </div>
    </div>
  )
}
