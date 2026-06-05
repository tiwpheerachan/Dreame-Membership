'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, Copy, Check, Calendar, ShoppingBag, Tag, Clock, Sparkles, Undo2, AlertTriangle } from 'lucide-react'
import type { Coupon } from '@/types'
import { formatDate } from '@/lib/utils'
import { getCouponTheme } from '@/lib/coupon-themes'

interface Props {
  coupon: Coupon | null
  status: 'active' | 'used' | 'expired'
  onClose: () => void
}

export default function CouponDetail({ coupon, status, onClose }: Props) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [closing, setClosing] = useState(false)
  const [livePrice, setLivePrice] = useState<{ current: number; discount: number; cash: number } | null>(null)

  // Refund state
  const [refundMode, setRefundMode]   = useState<'idle'|'confirm'|'final'|'doing'|'done'>('idle')
  const [refundError, setRefundError] = useState('')
  const [refundedPts, setRefundedPts] = useState(0)

  // ── Live price sync (POINTS_CASH reward only) ──
  const isPointsCashReward = !!coupon
    && status === 'active'
    && coupon.reward_meta?.redeem_type === 'POINTS_CASH'
    && coupon.reward_meta?.cash_top_up_thb != null

  useEffect(() => {
    if (!isPointsCashReward || !coupon?.reward_meta?.redemption_id) return
    let cancel = false
    fetch(`/api/redemptions/${coupon.reward_meta.redemption_id}/live-price`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (cancel || !d.success) return
        const cash = Number(coupon!.reward_meta!.cash_top_up_thb || 0)
        setLivePrice({ current: d.current_price, discount: d.current_price - cash, cash })
      })
      .catch(() => { /* ignore */ })
    return () => { cancel = true }
  }, [isPointsCashReward, coupon])

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
  // ใช้ live discount ถ้ามี (POINTS_CASH only) — fallback เป็น snapshot
  const displayDiscount = livePrice ? livePrice.discount : coupon.discount_value
  const discountChanged = livePrice && Math.abs(livePrice.discount - coupon.discount_value) > 0.01

  function copy() {
    navigator.clipboard.writeText(coupon!.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Self-refund eligibility ──
  // coupon มาจาก reward redemption + ไม่ใช่ PREMIUM (ส่งของจริง)
  const isRewardCoupon = !!coupon.auto_issue_key?.startsWith('REWARD_')
  const canRefund = isActive
    && isRewardCoupon
    && coupon.reward_meta?.redeem_type !== 'PREMIUM'

  async function submitRefund() {
    setRefundMode('doing')
    setRefundError('')
    try {
      const r = await fetch(`/api/coupons/${coupon!.id}/refund`, { method: 'POST' })
      const d = await r.json()
      if (!r.ok) {
        setRefundError(d.error || 'แลกคืนไม่สำเร็จ')
        setRefundMode('final')
        return
      }
      setRefundedPts(d.refunded_points || 0)
      setRefundMode('done')
      setTimeout(() => {
        handleClose()
        router.refresh()
      }, 1400)
    } catch (e) {
      setRefundError((e as Error).message || 'เกิดข้อผิดพลาด')
      setRefundMode('final')
    }
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
        position: 'fixed',
        // ใช้ inset แทน top/left/right/bottom ให้ปลอดภัย iOS Safari
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 200,
        background: 'rgba(14,14,14,0.55)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        // ใช้ grid place-items: center → centering ทำใน space ที่เหลือหลัง padding
        display: 'grid',
        placeItems: 'center',
        // Reserve space ให้ navbar (~96px) + safe-area iPhone notch
        paddingTop:    'max(16px, env(safe-area-inset-top))',
        paddingLeft:   16,
        paddingRight:  16,
        paddingBottom: 'calc(96px + env(safe-area-inset-bottom))',
        // กัน scroll bleed ไป body ฝั่งล่าง
        overscrollBehavior: 'contain',
        animation: closing ? 'pop-bd-out 0.18s ease forwards' : 'pop-bd-in 0.2s ease forwards',
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          // กว้างเต็มแต่ไม่เกิน 420 desktop
          width: '100%',
          maxWidth: 420,
          // maxHeight 100% = สูงสุดเท่าพื้นที่ที่ grid จัดให้ (viewport - padding ทุกด้าน)
          maxHeight: '100%',
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
            padding: '18px 22px 16px',
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
              fontSize: 42, fontWeight: 800, lineHeight: 0.95, margin: 0,
              color: theme.heroAccent,
              textShadow: '0 2px 12px rgba(0,0,0,0.20)',
              transition: 'all 0.3s ease',
            }}>
              {isPercent
                ? `${displayDiscount}%`
                : `฿${Number(Math.round(displayDiscount)).toLocaleString()}`}
            </p>

            {discountChanged && (
              <p style={{
                position: 'relative', zIndex: 2,
                fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '4px 0 0',
                textDecoration: 'line-through', fontWeight: 600,
              }}>
                {isPercent
                  ? `${coupon.discount_value}%`
                  : `฿${Number(coupon.discount_value).toLocaleString()}`}
              </p>
            )}

            <p style={{
              position: 'relative', zIndex: 2,
              fontSize: 11, color: theme.heroLabel, margin: '6px 0 0', fontWeight: 500,
            }}>
              {isPercent ? 'percent off' : 'baht off'}
              {livePrice && (
                <span style={{ marginLeft: 6, opacity: 0.85 }}>
                  · ราคาตอนนี้ ฿{livePrice.current.toLocaleString()} → จ่าย ฿{livePrice.cash.toLocaleString()}
                </span>
              )}
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
              {refundMode === 'idle' && (
                <>
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

                  {canRefund && (
                    <button onClick={() => { setRefundMode('confirm'); setRefundError('') }}
                      style={{
                        width:'100%', marginTop:8, padding:'10px 12px',
                        background:'transparent', border:'1px dashed var(--hair)',
                        borderRadius:'var(--r-md)', cursor:'pointer',
                        display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
                        fontSize:12, fontWeight:600, color:'var(--ink-mute)',
                      }}>
                      <Undo2 size={12}/> แลกคืนเพื่อรับแต้มกลับ
                    </button>
                  )}
                </>
              )}

              {refundMode === 'confirm' && (
                <>
                  <div style={{ textAlign:'center', marginBottom:12 }}>
                    <div style={{
                      width:44, height:44, margin:'0 auto 8px',
                      borderRadius:'50%', background:'var(--gold-glow)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      <Undo2 size={20} color="var(--gold-deep)"/>
                    </div>
                    <p style={{ margin:0, fontSize:15, fontWeight:800 }}>
                      ต้องการแลกคืนคูปองนี้?
                    </p>
                    <p style={{ margin:'6px 0 0', fontSize:11.5, color:'var(--ink-mute)', lineHeight:1.5 }}>
                      แต้มที่ใช้แลกจะถูกคืนกลับเข้าบัญชีของคุณ
                    </p>
                  </div>
                  <div style={{
                    padding:'10px 12px', borderRadius:10,
                    background:'#fef9e7', border:'1px solid #fce4a8',
                    display:'flex', gap:8, alignItems:'flex-start', marginBottom:12,
                  }}>
                    <AlertTriangle size={14} color="#a16207" style={{ flexShrink:0, marginTop:1 }}/>
                    <p style={{ margin:0, fontSize:11, color:'#78350f', lineHeight:1.5 }}>
                      หลังแลกคืน คูปองจะหายไปจากบัญชีและไม่สามารถนำกลับมาใช้ได้
                    </p>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => setRefundMode('idle')} className="btn tap"
                      style={{ flex:1, padding:'12px 0', background:'var(--bg-soft)', color:'var(--ink)' }}>
                      ยกเลิก
                    </button>
                    <button onClick={() => setRefundMode('final')} className="btn btn-ink tap"
                      style={{ flex:1, padding:'12px 0' }}>
                      ดำเนินการต่อ
                    </button>
                  </div>
                </>
              )}

              {(refundMode === 'final' || refundMode === 'doing') && (
                <>
                  <div style={{ textAlign:'center', marginBottom:12 }}>
                    <div style={{
                      width:44, height:44, margin:'0 auto 8px',
                      borderRadius:'50%', background:'#fef2f2',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      <AlertTriangle size={20} color="#dc2626"/>
                    </div>
                    <p style={{ margin:0, fontSize:15, fontWeight:800 }}>
                      ยืนยันแลกคืนอีกครั้ง
                    </p>
                    <p style={{ margin:'6px 0 0', fontSize:11.5, color:'var(--ink-mute)', lineHeight:1.5 }}>
                      การกระทำนี้ไม่สามารถย้อนกลับได้
                    </p>
                  </div>
                  {refundError && (
                    <div style={{
                      padding:'10px 12px', borderRadius:10,
                      background:'#fef2f2', border:'1px solid #fecaca',
                      fontSize:11.5, color:'#991b1b', marginBottom:10,
                    }}>
                      {refundError}
                    </div>
                  )}
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => setRefundMode('confirm')} disabled={refundMode==='doing'}
                      className="btn tap"
                      style={{ flex:1, padding:'12px 0', background:'var(--bg-soft)', color:'var(--ink)',
                        opacity: refundMode==='doing' ? 0.5 : 1 }}>
                      ย้อนกลับ
                    </button>
                    <button onClick={submitRefund} disabled={refundMode==='doing'}
                      className="tap"
                      style={{
                        flex:1, padding:'12px 0', borderRadius:'var(--r-md)',
                        background: refundMode==='doing' ? '#9ca3af' : '#dc2626',
                        color:'#fff', border:'none', fontSize:13, fontWeight:700,
                        cursor: refundMode==='doing' ? 'wait' : 'pointer',
                      }}>
                      {refundMode==='doing' ? 'กำลังแลกคืน…' : 'ใช่, แลกคืน'}
                    </button>
                  </div>
                </>
              )}

              {refundMode === 'done' && (
                <div style={{ textAlign:'center', padding:'8px 0' }}>
                  <div style={{
                    width:52, height:52, margin:'0 auto 10px',
                    borderRadius:'50%', background:'#ecfdf5',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <Check size={26} color="#16a34a"/>
                  </div>
                  <p style={{ margin:0, fontSize:16, fontWeight:800 }}>แลกคืนสำเร็จ</p>
                  <p style={{ margin:'4px 0 0', fontSize:13, color:'#16a34a', fontWeight:700 }}>
                    + {refundedPts.toLocaleString()} แต้ม
                  </p>
                </div>
              )}
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
