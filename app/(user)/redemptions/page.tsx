'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Package, ChevronLeft, CheckCircle, Clock, Truck, XCircle, Gift, RefreshCw, ExternalLink, Copy, Sparkles, History as HistoryIcon } from 'lucide-react'

interface Redemption {
  id: string
  reward_id: string
  reward_snapshot: {
    name: string; image_url: string | null; points_required: number;
    redeem_type?: 'POINTS_CASH' | 'VOUCHER' | 'PREMIUM';
    cash_top_up_thb?: number; voucher_value_thb?: number;
    shopify_product_url?: string;
  }
  points_used: number
  shipping_name: string
  shipping_address: string
  shipping_district: string
  shipping_province: string
  shipping_postcode: string
  status: 'pending' | 'redeemed' | 'confirmed' | 'shipping' | 'delivered' | 'cancelled' | 'expired'
  tracking_number: string | null
  tracking_carrier: string | null
  shopify_code: string | null
  shopify_apply_url: string | null
  code_expires_at: string | null
  refund_reason: string | null
  created_at: string
  shipped_at: string | null
  delivered_at: string | null
}

const STATUS_LABEL: Record<Redemption['status'], { label: string; color: string; Icon: typeof Clock }> = {
  pending:   { label: 'รอยืนยัน',    color: '#C99B3E', Icon: Clock },
  redeemed:  { label: 'พร้อมใช้',    color: '#C99B3E', Icon: Sparkles },
  confirmed: { label: 'พร้อมใช้',    color: '#C99B3E', Icon: Sparkles },
  shipping:  { label: 'กำลังส่ง',    color: '#4A7BC1', Icon: Truck },
  delivered: { label: 'ใช้แล้ว',     color: '#3A8E5A', Icon: CheckCircle },
  cancelled: { label: 'ยกเลิก',     color: '#B14242', Icon: XCircle },
  expired:   { label: 'หมดอายุ',    color: '#9CA29A', Icon: Clock },
}

type TabKey = 'active' | 'history'

export default function RedemptionsPage() {
  const [items, setItems] = useState<Redemption[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('active')

  useEffect(() => {
    fetch('/api/redemptions/me', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setItems(d.redemptions || []))
      .finally(() => setLoading(false))
  }, [])

  // แยก: "ที่ยังใช้ได้" vs "ประวัติ"
  const ACTIVE: Redemption['status'][] = ['pending', 'redeemed', 'confirmed', 'shipping']
  const HISTORY: Redemption['status'][] = ['delivered', 'cancelled', 'expired']
  const activeItems  = items.filter(i => ACTIVE.includes(i.status))
  const historyItems = items.filter(i => HISTORY.includes(i.status))
  const list = tab === 'active' ? activeItems : historyItems

  return (
    <div className="page-enter">
      <div style={{ padding: '14px 16px 0' }}>
        <Link href="/rewards" className="tap"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 13, color: 'var(--ink-mute)', textDecoration: 'none' }}>
          <ChevronLeft size={14} /> ของรางวัล
        </Link>
      </div>

      <header style={{ padding: '14px 20px 18px' }}>
        <p className="eyebrow" style={{ marginBottom: 10 }}>My Rewards</p>
        <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          <span style={{ fontWeight: 800 }}>การ</span>{' '}
          <span className="serif-i" style={{ fontWeight: 400 }}>แลกของฉัน</span>
        </h1>
      </header>

      {/* Tabs */}
      <div style={{ padding: '0 16px 14px', display: 'flex', gap: 6 }}>
        <button onClick={() => setTab('active')} className="tap"
          style={tabBtnStyle(tab === 'active')}>
          <Sparkles size={11} />
          พร้อมใช้
          {activeItems.length > 0 && (
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 100,
              background: tab === 'active' ? 'rgba(232,197,140,0.20)' : 'var(--bg-soft)',
              color: tab === 'active' ? '#E8C58C' : 'var(--ink-mute)', fontWeight: 700 }}>
              {activeItems.length}
            </span>
          )}
        </button>
        <button onClick={() => setTab('history')} className="tap"
          style={tabBtnStyle(tab === 'history')}>
          <HistoryIcon size={11} />
          ประวัติ
          {historyItems.length > 0 && (
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 100,
              background: tab === 'history' ? 'rgba(232,197,140,0.20)' : 'var(--bg-soft)',
              color: tab === 'history' ? '#E8C58C' : 'var(--ink-mute)', fontWeight: 700 }}>
              {historyItems.length}
            </span>
          )}
        </button>
      </div>

      <div style={{ padding: '0 16px 24px' }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>
            กำลังโหลด…
          </div>
        ) : list.length === 0 ? (
          <div className="card-product" style={{ padding: '52px 24px', textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, margin: '0 auto 18px',
              borderRadius: '50%', background: 'var(--gold-glow)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--gold-deep)',
            }}>
              <Package size={26} strokeWidth={1.4} />
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: 17 }}>
              <span style={{ fontWeight: 800 }}>
                {tab === 'active' ? 'ยังไม่มี' : 'ยังไม่มี'}
              </span>{' '}
              <span className="serif-i" style={{ fontWeight: 400 }}>
                {tab === 'active' ? 'รายการพร้อมใช้' : 'ประวัติ'}
              </span>
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--ink-mute)', margin: '0 0 16px' }}>
              {tab === 'active'
                ? 'แลกของรางวัลเพื่อรับรหัสส่วนลด — ใช้ที่ Shopify ได้ทันที'
                : 'รายการที่ใช้/หมดอายุแล้วจะถูกเก็บไว้ที่นี่'}
            </p>
            <Link href="/rewards" className="tap" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', borderRadius: 'var(--r-pill)',
              background: 'var(--ink)', color: '#E8C58C',
              textDecoration: 'none', fontSize: 13, fontWeight: 700,
            }}>
              <Gift size={13} /> ไปเลือกของรางวัล
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {list.map(r => (
              <RedemptionCard key={r.id} r={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, padding: '9px 12px',
    borderRadius: 'var(--r-pill)',
    background: active ? 'var(--ink)' : 'var(--surface)',
    color:      active ? '#E8C58C' : 'var(--ink-mute)',
    border:     active ? '1px solid var(--ink)' : '1px solid var(--hair)',
    fontSize: 12, fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    cursor: 'pointer',
  }
}

function RedemptionCard({ r }: { r: Redemption }) {
  const { label, color, Icon } = STATUS_LABEL[r.status]
  const [refreshing, setRefreshing] = useState(false)
  const [refreshed, setRefreshed] = useState<{ code: string; apply_url: string; live_price?: number; cash_top_up?: number; sale_detected?: boolean } | null>(null)
  const [refreshError, setRefreshError] = useState('')

  const isPointsCash = r.reward_snapshot?.redeem_type === 'POINTS_CASH'
  const isVoucher    = r.reward_snapshot?.redeem_type === 'VOUCHER'
  const isPremium    = r.reward_snapshot?.redeem_type === 'PREMIUM'
  const isUsed       = r.status === 'delivered'
  const isExpired    = r.status === 'expired'
  // Code is ready to use while the redemption is 'redeemed' (no code yet / just
  // issued) OR 'confirmed' (Shopify code generated, not yet used). The redeem
  // API marks it 'confirmed' after generating the code, so requiring exactly
  // 'redeemed' here hid the code + "go to Shopify" button on every successful
  // redemption.
  const canUseCode   = r.shopify_code && (r.status === 'redeemed' || r.status === 'confirmed')
  const currentCode  = refreshed?.code || r.shopify_code
  const currentUrl   = refreshed?.apply_url || r.shopify_apply_url || r.reward_snapshot?.shopify_product_url

  async function refreshPrice() {
    setRefreshing(true); setRefreshError('')
    try {
      const res = await fetch(`/api/redemptions/${r.id}/refresh-code`, { method: 'POST' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setRefreshed({
        code: d.code, apply_url: d.apply_url,
        live_price: d.live_price, cash_top_up: d.cash_top_up, sale_detected: d.sale_detected,
      })
    } catch (e) { setRefreshError((e as Error).message) }
    finally { setRefreshing(false) }
  }

  return (
    <div className="card-product" style={{ padding: 14, display: 'flex', gap: 12 }}>
      <div style={{
        width: 72, height: 72, borderRadius: 'var(--r-md)', flexShrink: 0,
        background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {r.reward_snapshot?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.reward_snapshot.image_url} alt={r.reward_snapshot.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Gift size={24} color="var(--ink-faint)" />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
            {r.reward_snapshot?.name || '—'}
          </p>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 'var(--r-pill)',
            background: `${color}1A`, color, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
          }}>
            <Icon size={9} /> {label}
          </span>
        </div>
        <p className="numerals" style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold-deep)', margin: '4px 0 6px' }}>
          -{r.points_used.toLocaleString()} แต้ม
          {r.reward_snapshot?.redeem_type === 'POINTS_CASH' && r.reward_snapshot.cash_top_up_thb && (
            <span style={{ color: 'var(--ink-mute)', fontWeight: 600, marginLeft: 6 }}>
              + ฿{Number(r.reward_snapshot.cash_top_up_thb).toLocaleString()}
            </span>
          )}
        </p>

        {/* Used / Expired states */}
        {isUsed && r.shopify_code && (
          <div style={{ marginTop: 6, padding: 8, borderRadius: 6,
            background: 'rgba(58,142,90,0.06)', border: '1px solid rgba(58,142,90,0.20)',
            display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle size={13} color="#3A8E5A" />
            <p style={{ fontSize: 10.5, color: '#3A8E5A', margin: 0, fontWeight: 600 }}>
              ใช้ที่ Shopify แล้ว · <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, marginLeft: 4 }}>{r.shopify_code}</code>
            </p>
          </div>
        )}
        {isExpired && (
          <div style={{ marginTop: 6, padding: 8, borderRadius: 6,
            background: 'var(--bg-soft)', border: '1px solid var(--hair)',
            display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={13} color="var(--ink-mute)" />
            <p style={{ fontSize: 10.5, color: 'var(--ink-mute)', margin: 0 }}>
              รหัสหมดอายุไม่ได้ใช้ · แต้มจะไม่คืน
            </p>
          </div>
        )}

        {/* Code block + refresh CTA — เฉพาะตอน redeemed (พร้อมใช้) */}
        {currentCode && canUseCode && (
          <div style={{
            marginTop: 6, padding: 8, borderRadius: 6,
            background: 'linear-gradient(135deg, var(--gold-glow), transparent)',
            border: '1px solid var(--gold-line)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <code style={{
                flex: 1, fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 700,
                color: 'var(--gold-deep)', letterSpacing: '0.06em',
              }}>{currentCode}</code>
              <button onClick={(e) => {
                e.preventDefault()
                if (currentCode) navigator.clipboard.writeText(currentCode)
              }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-mute)', padding: 2 }}>
                <Copy size={12}/>
              </button>
            </div>
            {refreshed?.live_price && (
              <p style={{ fontSize: 9.5, marginTop: 4,
                color: refreshed.sale_detected ? '#3A8E5A' : 'var(--ink-mute)' }}>
                {refreshed.sale_detected && '🎉 '}
                ราคา ณ ขณะนี้: ฿{refreshed.live_price.toLocaleString()} → จ่ายเพียง ฿{refreshed.cash_top_up?.toLocaleString()}
              </p>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {isPointsCash && (
                <button onClick={refreshPrice} disabled={refreshing}
                  style={{
                    padding: '5px 10px', fontSize: 10, fontWeight: 600,
                    background: 'transparent', color: 'var(--gold-deep)',
                    border: '1px solid var(--gold-line)', borderRadius: 'var(--r-pill)',
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                  <RefreshCw size={10} className={refreshing ? 'animate-spin' : ''} />
                  {refreshing ? 'sync ราคา...' : 'sync ราคาล่าสุด'}
                </button>
              )}
              {currentUrl && (
                <a href={currentUrl} target="_blank" rel="noopener noreferrer"
                  style={{
                    padding: '5px 10px', fontSize: 10, fontWeight: 700,
                    background: '#5E8E3E', color: '#fff',
                    border: 'none', borderRadius: 'var(--r-pill)',
                    textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                  <ExternalLink size={10}/> ไปที่ Shopify
                </a>
              )}
            </div>
            {refreshError && (
              <p style={{ fontSize: 10, color: '#B14242', marginTop: 4 }}>{refreshError}</p>
            )}
          </div>
        )}

        {r.tracking_number && (
          <p style={{ fontSize: 10, color: 'var(--ink-faint)', margin: '4px 0 0', fontFamily: 'var(--font-mono)' }}>
            {r.tracking_carrier || 'tracking'}: {r.tracking_number}
          </p>
        )}
        {r.refund_reason && (
          <p style={{ fontSize: 10, color: '#B14242', margin: '4px 0 0' }}>
            {r.refund_reason === 'user_self_refund'
              ? 'แลกคืนโดยลูกค้า → คืนแต้มแล้ว'
              : `ยกเลิก: ${r.refund_reason}`}
          </p>
        )}
        <p style={{ fontSize: 9.5, color: 'var(--ink-faint)', margin: '6px 0 0' }}>
          {new Date(r.created_at).toLocaleString('th-TH', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  )
}
