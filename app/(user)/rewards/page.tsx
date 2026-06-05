'use client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Gift, Sparkles, Lock, AlertCircle, History, ChevronDown, ChevronUp, Info } from 'lucide-react'

interface Reward {
  id: string
  model_id: string | null
  model_name?: string | null
  name: string
  short_description: string | null
  description: string | null
  image_url: string | null
  points_required: number
  stock: number | null
  stock_remaining: number | null
  allowed_tiers: string[]
  terms: string | null
  redemption_limit_per_user: number | null
  ends_at: string | null
  is_featured: boolean
  can_redeem: boolean
  reason_blocked: string | null
  my_redeem_count: number
  // 3 modes
  redeem_type: 'POINTS_CASH' | 'VOUCHER' | 'PREMIUM'
  cash_top_up_thb: number | null
  voucher_value_thb: number | null
  shopify_product_url: string | null
}

interface Model { id: string; name: string; slug: string | null }

export default function RewardsPage() {
  const [data, setData] = useState<{
    profile: { tier: string; total_points: number }
    rewards: Reward[]; models: Model[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modelFilter, setModelFilter] = useState<string>('all')

  async function load() {
    setLoading(true); setError('')
    try {
      const r = await fetch('/api/rewards', { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setData(d)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    return modelFilter === 'all'
      ? data.rewards
      : data.rewards.filter(r => r.model_id === modelFilter)
  }, [data, modelFilter])

  return (
    <div className="page-enter" style={{ paddingTop: 18 }}>
      {/* Header */}
      <header style={{ padding: '14px 20px 22px' }}>
        <p className="eyebrow" style={{ marginBottom: 10 }}>Member Exclusive</p>
        <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          <span style={{ fontWeight: 800 }}>แลก</span>{' '}
          <span className="serif-i" style={{ fontWeight: 400 }}>ของรางวัล</span>
        </h1>
        {data && (
          <div style={{
            marginTop: 14, padding: '12px 14px',
            background: 'linear-gradient(135deg, var(--gold-glow), transparent)',
            border: '1px solid var(--hair)', borderRadius: 'var(--r-lg)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <p style={{ fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0, fontWeight: 700 }}>
                แต้มของฉัน · {data.profile.tier}
              </p>
              <p className="numerals" style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800, color: 'var(--gold-deep)' }}>
                {data.profile.total_points.toLocaleString()}
              </p>
            </div>
            <Link href="/redemptions" className="tap" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)',
              padding: '8px 12px', borderRadius: 'var(--r-pill)',
              background: 'var(--surface)', border: '1px solid var(--hair)',
              textDecoration: 'none',
            }}>
              <History size={12} /> ประวัติ
            </Link>
          </div>
        )}
      </header>

      {/* How rewards work — collapsible info card */}
      <HowRewardsWorkBanner />

      {/* Model tabs */}
      {data && data.models.length > 0 && (
        <div style={{ padding: '0 16px 12px', overflowX: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => setModelFilter('all')}
            className="tap"
            style={tabStyle(modelFilter === 'all')}>
            ทั้งหมด ({data.rewards.length})
          </button>
          {data.models.map(m => {
            const count = data.rewards.filter(r => r.model_id === m.id).length
            if (count === 0) return null
            return (
              <button key={m.id} onClick={() => setModelFilter(m.id)}
                className="tap" style={tabStyle(modelFilter === m.id)}>
                {m.name} ({count})
              </button>
            )
          })}
        </div>
      )}

      <div style={{ padding: '0 16px 24px' }}>
        {error && (
          <div className="card-product" style={{ padding: 16, marginBottom: 12,
            display: 'flex', gap: 8, alignItems: 'flex-start',
            background: '#FBE9E9', borderColor: '#E8B4B4', color: '#B14242' }}>
            <AlertCircle size={14} style={{ marginTop: 2 }} />
            <p style={{ fontSize: 12, margin: 0 }}>{error}</p>
          </div>
        )}

        {loading && !data ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>
            กำลังโหลด…
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-product" style={{ padding: '52px 24px', textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, margin: '0 auto 18px',
              borderRadius: '50%', background: 'var(--gold-glow)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--gold-deep)',
            }}>
              <Gift size={26} strokeWidth={1.4} />
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: 18 }}>
              <span style={{ fontWeight: 800 }}>ยังไม่มี</span>{' '}
              <span className="serif-i" style={{ fontWeight: 400 }}>ของรางวัล</span>
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--ink-mute)', margin: 0 }}>
              กลับมาดูใหม่เร็วๆ นี้
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(r => (
              <RewardCard key={r.id} reward={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '7px 14px', borderRadius: 'var(--r-pill)',
    background: active ? 'var(--ink)' : 'var(--surface)',
    color:      active ? '#fff'      : 'var(--ink-mute)',
    border:     active ? '1px solid var(--ink)' : '1px solid var(--hair)',
    fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
    cursor: 'pointer',
  }
}

function RewardCard({ reward }: { reward: Reward }) {
  return (
    <Link href={`/rewards/${reward.id}`}
      className="card-product tap"
      style={{
        display: 'flex', overflow: 'hidden',
        textDecoration: 'none', color: 'inherit',
        opacity: reward.can_redeem ? 1 : 0.7,
        position: 'relative',
      }}>
      {/* Image */}
      <div style={{
        width: 110, flexShrink: 0,
        background: 'var(--bg-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {reward.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={reward.image_url} alt={reward.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Gift size={28} color="var(--ink-faint)" strokeWidth={1.4} />
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        {reward.is_featured && (
          <p style={{ fontSize: 9, color: 'var(--gold-deep)', letterSpacing: '0.18em', textTransform: 'uppercase', margin: 0, fontWeight: 700 }}>
            ⭐ Featured
          </p>
        )}
        <p style={{ fontSize: 14, fontWeight: 700, margin: 0, lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {reward.name}
        </p>
        {reward.short_description && (
          <p style={{ fontSize: 11, color: 'var(--ink-mute)', margin: 0, lineHeight: 1.4,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
            {reward.short_description}
          </p>
        )}
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span className="numerals" style={{ fontSize: 18, fontWeight: 800, color: 'var(--gold-deep)' }}>
              {reward.points_required.toLocaleString()}
            </span>
            <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>แต้ม</span>
            {reward.redeem_type === 'POINTS_CASH' && reward.cash_top_up_thb && (
              <span style={{ fontSize: 11, color: 'var(--ink-mute)', marginLeft: 4 }}>
                + ฿{Number(reward.cash_top_up_thb).toLocaleString()}
              </span>
            )}
            {reward.redeem_type === 'VOUCHER' && reward.voucher_value_thb && (
              <span style={{ fontSize: 11, color: 'var(--gold-deep)', marginLeft: 4, fontWeight: 600 }}>
                = ฿{Number(reward.voucher_value_thb).toLocaleString()} off
              </span>
            )}
          </div>
          {reward.stock !== null && reward.stock_remaining !== null && reward.stock_remaining < 10 && (
            <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600 }}>
              เหลือ {reward.stock_remaining}
            </span>
          )}
        </div>
        {/* Mode badge */}
        <div style={{ marginTop: 4, display: 'flex', gap: 4 }}>
          {reward.redeem_type === 'POINTS_CASH' && (
            <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 'var(--r-pill)',
              background: 'rgba(201,155,62,0.12)', color: 'var(--gold-deep)', fontWeight: 700 }}>
              💰 แต้ม + เงินสด
            </span>
          )}
          {reward.redeem_type === 'VOUCHER' && (
            <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 'var(--r-pill)',
              background: 'rgba(74,123,193,0.12)', color: '#4A7BC1', fontWeight: 700 }}>
              🎟️ คูปอง
            </span>
          )}
          {reward.redeem_type === 'PREMIUM' && (
            <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 'var(--r-pill)',
              background: 'rgba(58,142,90,0.12)', color: '#3A8E5A', fontWeight: 700 }}>
              🎁 ของรางวัล
            </span>
          )}
        </div>
        {!reward.can_redeem && reward.reason_blocked && (
          <p style={{ fontSize: 10, color: 'var(--ink-faint)', margin: '4px 0 0',
            display: 'flex', alignItems: 'center', gap: 4 }}>
            <Lock size={9} /> {reward.reason_blocked}
          </p>
        )}
      </div>
    </Link>
  )
}

// ============================================================
// HowRewardsWorkBanner — แสดง 3 ประเภทการแลกเหนือลิสต์รางวัล
// Collapsible: เปิด/ปิดได้ — เก็บ state ใน localStorage
// ============================================================
function HowRewardsWorkBanner() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('rewards_howto_open')
      // เปิด default ครั้งแรก, ครั้งถัดไปจำ preference
      setOpen(saved === null ? true : saved === '1')
    }
  }, [])
  function toggle() {
    setOpen(o => {
      const n = !o
      if (typeof window !== 'undefined') localStorage.setItem('rewards_howto_open', n ? '1' : '0')
      return n
    })
  }

  return (
    <div style={{ padding: '0 16px 12px' }}>
      <button onClick={toggle} className="tap"
        style={{
          width: '100%', padding: '12px 14px',
          background: 'var(--surface)', border: '1px solid var(--hair)',
          borderRadius: 'var(--r-md)',
          display: 'flex', alignItems: 'center', gap: 10,
          cursor: 'pointer',
        }}>
        <Info size={14} color="var(--gold-deep)" />
        <span style={{ flex: 1, textAlign: 'left', fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>
          มี 3 วิธีแลก — กดดูรายละเอียด
        </span>
        {open ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
      </button>

      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ModeRow emoji="💰" color="#C99B3E" bg="rgba(201,155,62,0.06)" border="rgba(201,155,62,0.25)"
            title="แต้ม + เงินสด"
            desc="ใช้แต้มลดราคาสินค้า แล้วจ่ายเงินสดเพิ่ม — ระบบสร้างรหัสส่วนลดให้กดไปจ่ายที่ Shopify" />
          <ModeRow emoji="🎟️" color="#4A7BC1" bg="rgba(74,123,193,0.06)" border="rgba(74,123,193,0.25)"
            title="แลกเป็นคูปอง"
            desc="แลกแต้มเป็นคูปองส่วนลด ใช้กับการซื้ออะไรก็ได้ใน Shopify — โผล่ในแท็บ คูปอง" />
          <ModeRow emoji="🎁" color="#3A8E5A" bg="rgba(58,142,90,0.06)" border="rgba(58,142,90,0.25)"
            title="ของพรีเมียม"
            desc="ใช้แต้มแลกของแถมฟรี ไม่ต้องจ่ายเพิ่ม — ทีม Dreame จัดส่งให้ถึงบ้าน" />
          <div style={{
            padding: '8px 10px', borderRadius: 6,
            background: 'rgba(94,142,62,0.08)', border: '1px solid rgba(94,142,62,0.20)',
            fontSize: 11, color: '#3A8E5A', lineHeight: 1.5,
          }}>
            ⏰ <b>แลกตอนนี้ ใช้เมื่อไหร่ก็ได้</b> — รหัสมีอายุ 30 วัน (โดยทั่วไป) แลกเก็บไว้ก่อนรอใช้ตอนช้อปจริง
          </div>
        </div>
      )}
    </div>
  )
}

function ModeRow({ emoji, color, bg, border, title, desc }: {
  emoji: string; color: string; bg: string; border: string; title: string; desc: string
}) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 'var(--r-md)',
      background: bg, border: `1px solid ${border}`,
      display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 18, lineHeight: 1 }}>{emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12.5, fontWeight: 800, margin: 0, color }}>{title}</p>
        <p style={{ fontSize: 11, margin: '2px 0 0', color: 'var(--ink-soft)', lineHeight: 1.45 }}>
          {desc}
        </p>
      </div>
    </div>
  )
}
