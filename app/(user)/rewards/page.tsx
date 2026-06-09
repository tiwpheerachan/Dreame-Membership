'use client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Gift, Sparkles, Lock, AlertCircle, History, ChevronDown, ChevronUp, Info,
  CheckCircle, Clock, Truck, XCircle, Copy, ExternalLink, History as HistoryIcon,
} from 'lucide-react'

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
  original_price_thb?: number | null
}

interface Model { id: string; name: string; slug: string | null }

interface MyRedemption {
  id: string
  reward_id: string
  reward_snapshot: {
    name: string; image_url: string | null; points_required: number;
    redeem_type?: 'POINTS_CASH' | 'VOUCHER' | 'PREMIUM';
    cash_top_up_thb?: number | null;
    original_price_thb?: number | null;
    voucher_value_thb?: number | null;
  }
  points_used: number
  status: 'pending' | 'redeemed' | 'confirmed' | 'shipping' | 'delivered' | 'cancelled' | 'expired'
  shopify_code: string | null
  shopify_apply_url: string | null
  code_expires_at: string | null
  refund_reason: string | null
  tracking_number: string | null
  tracking_carrier: string | null
  created_at: string
}

const REDEMPTION_STATUS: Record<MyRedemption['status'], { label: string; color: string; Icon: typeof Clock }> = {
  pending:   { label: 'รอยืนยัน',  color: '#C99B3E', Icon: Clock },
  redeemed:  { label: 'พร้อมใช้',  color: '#C99B3E', Icon: Sparkles },
  confirmed: { label: 'ยืนยันแล้ว', color: '#4A7BC1', Icon: CheckCircle },
  shipping:  { label: 'กำลังส่ง',  color: '#4A7BC1', Icon: Truck },
  delivered: { label: 'ใช้แล้ว',   color: '#3A8E5A', Icon: CheckCircle },
  cancelled: { label: 'ยกเลิก',   color: '#B14242', Icon: XCircle },
  expired:   { label: 'หมดอายุ',  color: '#9CA29A', Icon: Clock },
}

const ACTIVE_STATUSES: MyRedemption['status'][]  = ['pending', 'redeemed', 'confirmed', 'shipping']
const HISTORY_STATUSES: MyRedemption['status'][] = ['delivered', 'cancelled', 'expired']
type MyTab = 'active' | 'history'

export default function RewardsPage() {
  const [data, setData] = useState<{
    profile: { tier: string; total_points: number }
    rewards: Reward[]; models: Model[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modelFilter, setModelFilter] = useState<string>('all')

  // ── 2 main tabs: ของรางวัล / ประวัติของฉัน ──
  const [mainTab, setMainTab] = useState<'catalog' | 'mine'>('catalog')
  // ── การแลกของฉัน (sub-tabs) ──
  const [myRedemptions, setMyRedemptions] = useState<MyRedemption[]>([])
  const [myTab, setMyTab] = useState<MyTab>('active')

  async function load() {
    setLoading(true); setError('')
    try {
      const [rwRes, mineRes] = await Promise.all([
        fetch('/api/rewards', { cache: 'no-store' }).then(r => r.json()),
        fetch('/api/redemptions/me', { cache: 'no-store' })
          .then(r => r.json()).catch(() => ({ redemptions: [] })),
      ])
      if (rwRes.error) throw new Error(rwRes.error)
      setData(rwRes)
      setMyRedemptions(mineRes.redemptions || [])
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const myActive  = myRedemptions.filter(r => ACTIVE_STATUSES.includes(r.status))
  const myHistory = myRedemptions.filter(r => HISTORY_STATUSES.includes(r.status))
  const myList    = myTab === 'active' ? myActive : myHistory

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
          </div>
        )}
      </header>

      {/* ─── 2 MAIN TABS: ของรางวัล (เด่นทอง) / ประวัติของฉัน ─── */}
      <MainTabs
        active={mainTab}
        onChange={setMainTab}
        catalogCount={data?.rewards.length || 0}
        mineCount={myRedemptions.length}
      />

      {mainTab === 'catalog' ? (
        <>
          {/* What You Get — VIP Treatments showcase */}
          <VIPTreatments />

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
        </>
      ) : (
        /* ─── ประวัติของฉัน (สอง sub-tabs: พร้อมใช้ / ประวัติ) ─── */
        <MyRedemptionsSection
          activeCount={myActive.length}
          historyCount={myHistory.length}
          tab={myTab}
          onTabChange={setMyTab}
          items={myList}
        />
      )}
    </div>
  )
}

// ============================================================
// MainTabs — 2 main tabs: ของรางวัล (เด่นทอง) / ประวัติของฉัน
// ============================================================
function MainTabs({ active, onChange, catalogCount, mineCount }: {
  active: 'catalog' | 'mine'; onChange: (t: 'catalog' | 'mine') => void
  catalogCount: number; mineCount: number
}) {
  return (
    <div style={{ padding: '4px 16px 16px' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 8,
      }}>
        {/* CATALOG — gold prominent CTA */}
        <button onClick={() => onChange('catalog')} className="tap"
          style={{
            position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 16px', borderRadius: 16,
            background: active === 'catalog'
              ? 'linear-gradient(180deg, #FAF3DC 0%, #EADBB1 35%, #C9A063 75%, #A0782B 100%)'
              : 'var(--surface)',
            boxShadow: active === 'catalog'
              ? 'inset 0 1px 0 rgba(255,250,235,0.95), inset 0 -1px 0 rgba(120,80,20,0.35), 0 6px 18px rgba(160,120,43,0.34)'
              : '0 2px 6px rgba(20,18,15,0.05)',
            border: active === 'catalog' ? 'none' : '1px solid var(--hair)',
            color: active === 'catalog' ? '#1A1815' : 'var(--ink-mute)',
            cursor: 'pointer', overflow: 'hidden',
            transition: 'box-shadow 0.18s ease, background 0.18s ease',
          }}>
          {active === 'catalog' && (
            <Sparkles size={48} aria-hidden style={{
              position: 'absolute', right: -8, top: -8,
              color: 'rgba(255,250,235,0.4)', pointerEvents: 'none',
            }} />
          )}
          <Gift size={17} strokeWidth={active === 'catalog' ? 2.4 : 2}
            style={{ position: 'relative', zIndex: 1 }} />
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'left' }}>
            <p style={{
              margin: 0, fontSize: 13.5, fontWeight: 800, lineHeight: 1.2,
              textShadow: active === 'catalog' ? '0 1px 0 rgba(255,250,235,0.55)' : 'none',
            }}>
              ของรางวัล
            </p>
            <p style={{
              margin: '2px 0 0', fontSize: 10, fontWeight: 700,
              opacity: active === 'catalog' ? 0.75 : 0.6,
              letterSpacing: '0.04em',
            }}>
              {catalogCount} รายการ
            </p>
          </div>
        </button>

        {/* MINE — normal */}
        <button onClick={() => onChange('mine')} className="tap"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 12px', borderRadius: 16,
            background: active === 'mine' ? 'var(--ink)' : 'var(--surface)',
            color:      active === 'mine' ? '#E8C58C'   : 'var(--ink-mute)',
            border:     active === 'mine' ? 'none' : '1px solid var(--hair)',
            boxShadow: active === 'mine'
              ? '0 6px 18px rgba(20,18,15,0.22)'
              : '0 2px 6px rgba(20,18,15,0.05)',
            cursor: 'pointer',
            transition: 'all 0.18s ease',
          }}>
          <HistoryIcon size={16} strokeWidth={active === 'mine' ? 2.4 : 2} />
          <div style={{ textAlign: 'left' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, lineHeight: 1.2 }}>
              ประวัติของฉัน
            </p>
            <p style={{
              margin: '2px 0 0', fontSize: 10, fontWeight: 700,
              opacity: 0.6, letterSpacing: '0.04em',
            }}>
              {mineCount} รายการ
            </p>
          </div>
        </button>
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
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span className="numerals" style={{ fontSize: 18, fontWeight: 800, color: 'var(--gold-deep)' }}>
                {reward.points_required.toLocaleString()}
              </span>
              <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>แต้ม</span>
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

          {/* ── POINTS_CASH: เน้นยอดที่ต้องจ่ายเพิ่มเป็นบรรทัดต่างหาก ── */}
          {reward.redeem_type === 'POINTS_CASH' && reward.cash_top_up_thb && (
            <div style={{
              display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 6,
              padding: '4px 9px', borderRadius: 'var(--r-pill)',
              background: 'linear-gradient(135deg, #FAF3DC, #EADBB1)',
              border: '1px solid rgba(201,155,62,0.30)',
            }}>
              <span style={{ fontSize: 10, color: '#A0782B', fontWeight: 800, letterSpacing: '0.04em' }}>
                + จ่ายเพิ่ม
              </span>
              <span className="numerals" style={{ fontSize: 13, fontWeight: 800, color: '#1A1815', lineHeight: 1 }}>
                ฿{Number(reward.cash_top_up_thb).toLocaleString()}
              </span>
              {reward.original_price_thb && Number(reward.original_price_thb) > Number(reward.cash_top_up_thb) && (
                <span style={{
                  fontSize: 9.5, color: 'var(--ink-faint)',
                  textDecoration: 'line-through', marginLeft: 2,
                }}>
                  ฿{Number(reward.original_price_thb).toLocaleString()}
                </span>
              )}
            </div>
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
            desc="ใช้แต้มแลกของแถมฟรี — รับ code ที่ Shopify ทันที ไม่ต้องรอแอดมิน" />
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

// ============================================================
// VIP Treatments — What You Get showcase
// ใช้รูป /images/benefits/vip-treatments.png ที่ upload ไว้แล้ว
// ============================================================
function VIPTreatments() {
  // ratio = 3230 / 882 ≈ 3.66
  return (
    <section style={{ padding: '0 16px 18px' }}>
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '3230 / 882',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
      }}>
        <Image
          src="/images/benefits/vip-treatments.png"
          alt="What You Get — Your VIP Treatments"
          fill
          sizes="(max-width: 480px) 100vw, 480px"
          priority={false}
          style={{ objectFit: 'contain' }}
        />
      </div>
    </section>
  )
}

// ============================================================
// MyRedemptionsSection — inline tabs (พร้อมใช้ / ประวัติ)
// ============================================================
function MyRedemptionsSection({
  activeCount, historyCount, tab, onTabChange, items,
}: {
  activeCount: number; historyCount: number; tab: MyTab
  onTabChange: (t: MyTab) => void; items: MyRedemption[]
}) {
  return (
    <section style={{ padding: '0 16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 4px 10px' }}>
        <h2 className="display" style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
          การแลก<span className="serif-i" style={{ fontWeight: 400 }}>ของฉัน</span>
        </h2>
        <Link href="/redemptions" style={{
          fontSize: 10.5, color: 'var(--ink-mute)', textDecoration: 'none', fontWeight: 700,
        }}>
          ดูทั้งหมด →
        </Link>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <TabPill
          active={tab === 'active'}
          onClick={() => onTabChange('active')}
          Icon={Sparkles}
          label="พร้อมใช้"
          count={activeCount}
        />
        <TabPill
          active={tab === 'history'}
          onClick={() => onTabChange('history')}
          Icon={HistoryIcon}
          label="ประวัติ"
          count={historyCount}
        />
      </div>

      {/* List */}
      {items.length === 0 ? (
        <div style={{
          padding: '20px 16px', textAlign: 'center',
          background: 'var(--bg-soft)', borderRadius: 'var(--r-md)',
          fontSize: 11.5, color: 'var(--ink-mute)',
        }}>
          {tab === 'active' ? 'ไม่มีรายการที่พร้อมใช้' : 'ไม่มีประวัติ'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.slice(0, 5).map(r => <MyRedemptionRow key={r.id} r={r} />)}
          {items.length > 5 && (
            <Link href="/redemptions" style={{
              padding: '10px 14px', borderRadius: 'var(--r-md)',
              background: 'var(--surface)', border: '1px dashed var(--hair)',
              textAlign: 'center', fontSize: 11.5, fontWeight: 700,
              color: 'var(--gold-deep)', textDecoration: 'none',
            }}>
              ดูอีก {items.length - 5} รายการ →
            </Link>
          )}
        </div>
      )}
    </section>
  )
}

function TabPill({ active, onClick, Icon, label, count }: {
  active: boolean; onClick: () => void; Icon: typeof Clock; label: string; count: number
}) {
  return (
    <button onClick={onClick} className="tap" style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '8px 14px', borderRadius: 'var(--r-pill)',
      background: active ? 'var(--ink)' : 'var(--surface)',
      color:      active ? '#E8C58C'   : 'var(--ink-mute)',
      border:     active ? '1px solid var(--ink)' : '1px solid var(--hair)',
      fontSize: 12, fontWeight: 700,
      cursor: 'pointer', transition: 'all 0.18s ease',
    }}>
      <Icon size={11} />
      {label}
      <span style={{
        fontSize: 10, padding: '1px 7px', borderRadius: 100,
        background: active ? 'rgba(232,197,140,0.20)' : 'var(--bg-soft)',
        color:      active ? '#E8C58C' : 'var(--ink-mute)',
        fontWeight: 800,
      }}>{count}</span>
    </button>
  )
}

function MyRedemptionRow({ r }: { r: MyRedemption }) {
  const meta = REDEMPTION_STATUS[r.status]
  const snap = r.reward_snapshot || { name: 'reward', image_url: null, points_required: 0 }
  const [copied, setCopied] = useState(false)
  const isExpired = r.code_expires_at && new Date(r.code_expires_at) < new Date()

  function copyCode(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    if (!r.shopify_code) return
    navigator.clipboard.writeText(r.shopify_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="card-product" style={{
      padding: 10, display: 'flex', gap: 10, alignItems: 'center',
      borderColor: meta.color === '#C99B3E' ? 'rgba(201,155,62,0.30)' : 'var(--hair)',
    }}>
      {/* Image */}
      <div style={{
        width: 48, height: 48, flexShrink: 0,
        borderRadius: 'var(--r-md)',
        background: 'var(--bg-soft)',
        overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {snap.image_url
          ? /* eslint-disable-next-line @next/next/no-img-element */ (
            <img src={snap.image_url} alt={snap.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )
          : <Gift size={20} color="var(--ink-faint)"/>}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12.5, fontWeight: 700, margin: 0, lineHeight: 1.3,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as const }}>
          {snap.name}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 9.5, padding: '2px 7px', borderRadius: 100,
            background: `${meta.color}1A`, color: meta.color,
            fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3,
          }}>
            <meta.Icon size={9}/> {meta.label}
          </span>
          {/* แต้ม + เงินสด → "100 แต้ม + ฿1,000" gold pill */}
          {snap.redeem_type === 'POINTS_CASH' && snap.cash_top_up_thb != null ? (
            <span style={{
              display: 'inline-flex', alignItems: 'baseline', gap: 3,
              padding: '2px 8px', borderRadius: 100,
              background: 'linear-gradient(135deg, #FAF3DC, #EADBB1)',
              border: '1px solid rgba(201,155,62,0.30)',
            }}>
              <span className="numerals" style={{ fontSize: 10.5, fontWeight: 800, color: '#A0782B' }}>
                {(r.points_used || snap.points_required).toLocaleString()}
              </span>
              <span style={{ fontSize: 8.5, fontWeight: 700, color: '#A0782B' }}>แต้ม</span>
              <span style={{ fontSize: 9, color: '#A0782B', margin: '0 1px' }}>+</span>
              <span className="numerals" style={{ fontSize: 10.5, fontWeight: 800, color: '#1A1815' }}>
                ฿{Number(snap.cash_top_up_thb).toLocaleString()}
              </span>
            </span>
          ) : snap.points_required > 0 ? (
            <span style={{ fontSize: 10, color: 'var(--ink-faint)' }}>
              · {(r.points_used || snap.points_required).toLocaleString()} แต้ม
            </span>
          ) : null}
        </div>
        {r.shopify_code && !isExpired && r.status !== 'delivered' && r.status !== 'cancelled' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700,
              color: 'var(--ink)',
              padding: '2px 7px', borderRadius: 5,
              background: 'var(--gold-glow)', border: '1px dashed var(--gold-line)',
            }}>{r.shopify_code}</span>
            <button onClick={copyCode} className="tap" style={{
              background: 'transparent', border: 'none',
              color: copied ? '#3A8E5A' : 'var(--ink-faint)',
              cursor: 'pointer', padding: 2,
              display: 'inline-flex', alignItems: 'center',
            }}>
              {copied ? <CheckCircle size={11}/> : <Copy size={11}/>}
            </button>
          </div>
        )}
      </div>

      {/* Apply button (active code only) */}
      {r.shopify_apply_url && !isExpired && r.status !== 'delivered' && r.status !== 'cancelled' && (
        <a href={r.shopify_apply_url} target="_blank" rel="noopener noreferrer"
          style={{
            padding: '6px 10px', borderRadius: 'var(--r-pill)',
            background: '#5E8E3E', color: '#fff', textDecoration: 'none',
            fontSize: 10.5, fontWeight: 700, flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
          <ExternalLink size={10}/> ใช้
        </a>
      )}
    </div>
  )
}
