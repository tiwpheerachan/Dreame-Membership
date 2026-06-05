'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Package, ChevronLeft, Search, Truck, CheckCircle, Clock,
  XCircle, ExternalLink, AlertCircle, MapPin,
} from 'lucide-react'

type DisplayStatus = 'cancelled' | 'delivered' | 'in_transit' | 'partial' | 'paid' | 'processing'
type BQShipStatus = 'label_printed' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failure' | 'cancelled' | string

interface ActiveOrder {
  id: number
  order_number: string
  name: string
  total_price: string | number
  currency: string
  financial_status: string | null
  fulfillment_status: string | null
  tracking_number: string | null
  tracking_company: string | null
  tracking_url: string | null
  order_status_url: string | null
  shopify_created_at: string | null
  shipped_at: string | null
  display_status: DisplayStatus
  items_count: number
}

interface BQShipping {
  platform: string
  brand_name: string
  order_sn: string
  shipment_status: BQShipStatus | null
  carrier: string | null
  tracking_numbers: string[]
  tracking_urls: string[]
  shipped_at: string | null
  delivered_at: string | null
  last_event_status: string | null
  last_event_at: string | null
  last_event_location: string | null
}

interface BQOrderItem {
  item_name: string | null
  model_name: string | null
  quantity: number
  price: number | null
  buyer_paid: number | null
  image_url: string | null
}
interface BQOrder {
  platform: string
  order_sn: string
  brand_name: string | null
  order_create_time: string | null
  total_amount: number | null
  items: BQOrderItem[]
}
interface BQRegistration {
  registration: {
    id: string; order_sn: string; platform: string;
    item_name: string | null; status: string | null;
    total_amount: number | null; created_at: string;
  }
  order: BQOrder | null
  shipments: BQShipping[]
}

const BQ_STATUS_META: Record<BQShipStatus, { label: string; color: string; Icon: typeof Clock }> = {
  label_printed:    { label: 'พิมพ์ฉลาก',     color: '#C99B3E', Icon: Clock },
  in_transit:       { label: 'กำลังจัดส่ง',   color: '#4A7BC1', Icon: Truck },
  out_for_delivery: { label: 'ออกส่งวันนี้',  color: '#4A7BC1', Icon: Truck },
  delivered:        { label: 'จัดส่งสำเร็จ', color: '#3A8E5A', Icon: CheckCircle },
  failure:          { label: 'จัดส่งไม่สำเร็จ', color: '#B14242', Icon: XCircle },
  cancelled:        { label: 'ยกเลิก',       color: '#B14242', Icon: XCircle },
}

const PLATFORM_LABEL: Record<string, string> = {
  shopify:     'Shopify',
  shopee:      'Shopee',
  tiktok_shop: 'TikTok Shop',
  lazada:      'Lazada',
  offline:     'หน้าร้าน',
  b2b:         'B2B',
}

const STATUS_META: Record<DisplayStatus, { label: string; color: string; bg: string; Icon: typeof Clock }> = {
  processing: { label: 'กำลังเตรียม',   color: '#C99B3E', bg: 'rgba(201,155,62,0.10)',  Icon: Clock },
  paid:       { label: 'ชำระเงินแล้ว',  color: '#4A7BC1', bg: 'rgba(74,123,193,0.10)',  Icon: CheckCircle },
  partial:    { label: 'ส่งบางส่วน',    color: '#C99B3E', bg: 'rgba(201,155,62,0.10)',  Icon: Truck },
  in_transit: { label: 'กำลังจัดส่ง',   color: '#4A7BC1', bg: 'rgba(74,123,193,0.10)',  Icon: Truck },
  delivered:  { label: 'จัดส่งสำเร็จ', color: '#3A8E5A', bg: 'rgba(58,142,90,0.10)',   Icon: CheckCircle },
  cancelled:  { label: 'ยกเลิก',       color: '#B14242', bg: 'rgba(177,66,66,0.10)',   Icon: XCircle },
}

export default function TrackPage() {
  const [bqItems, setBqItems] = useState<BQRegistration[]>([])
  const [shopifyOrders, setShopifyOrders] = useState<ActiveOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [number, setNumber] = useState('')
  const [contact, setContact] = useState('')
  const [lookupBQ, setLookupBQ] = useState<{ shipments: BQShipping[]; order_sn: string } | null>(null)
  const [lookupError, setLookupError] = useState('')
  const [searching, setSearching] = useState(false)

  // โหลด list ของ user — แยกเป็นฟังก์ชันให้ refresh ได้
  function loadOrders() {
    return Promise.all([
      fetch('/api/orders/me-bq', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ items: [] })),
      fetch('/api/orders/me', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ active: [] })),
    ]).then(([bq, sh]) => {
      setBqItems(bq.items || [])
      setShopifyOrders(sh.active || [])
    })
  }

  useEffect(() => {
    // Auto-fill จาก ?order_sn=X ถ้ามี
    const params = new URLSearchParams(window.location.search)
    const presetSn = params.get('order_sn') || params.get('number')
    if (presetSn) {
      setNumber(presetSn)
      setSearching(true)
      fetch(`/api/orders/track-bq?order_sn=${encodeURIComponent(presetSn.replace(/^#/, ''))}`)
        .then(r => r.json())
        .then(d => {
          if (d.shipments) setLookupBQ({ shipments: d.shipments, order_sn: presetSn })
          else if (d.error) setLookupError(d.error)
        })
        .finally(() => setSearching(false))
    }

    loadOrders().finally(() => setLoading(false))

    // ── Auto-refresh ทุก 60 วินาที (เมื่อแท็บ active) ──
    const interval = setInterval(() => {
      if (!document.hidden) loadOrders()
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  async function track(e: React.FormEvent) {
    e.preventDefault()
    if (!number.trim()) return
    setSearching(true); setLookupError(''); setLookupBQ(null)
    try {
      // ลอง BQ ก่อน — ครอบคลุมทุก platform
      const r = await fetch(`/api/orders/track-bq?order_sn=${encodeURIComponent(number.trim().replace(/^#/, ''))}`)
      const d = await r.json()
      if (!r.ok) {
        // Fallback ไป Shopify-only lookup (ใช้ตอน BQ ยังไม่มี config)
        const r2 = await fetch(`/api/orders/track?number=${encodeURIComponent(number.trim())}&contact=${encodeURIComponent(contact.trim())}`)
        const d2 = await r2.json()
        if (!r2.ok) throw new Error(d.error || d2.error)
        return
      }
      setLookupBQ({ shipments: d.shipments || [], order_sn: number.trim() })
    } catch (e) { setLookupError((e as Error).message) }
    finally { setSearching(false) }
  }

  return (
    <div className="page-enter">
      <div style={{ padding: '14px 16px 0' }}>
        <Link href="/home" className="tap"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 13, color: 'var(--ink-mute)', textDecoration: 'none' }}>
          <ChevronLeft size={14} /> หน้าหลัก
        </Link>
      </div>

      <header style={{ padding: '14px 20px 18px' }}>
        <p className="eyebrow" style={{ marginBottom: 10 }}>Order Tracking</p>
        <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          <span style={{ fontWeight: 800 }}>ติดตาม</span>{' '}
          <span className="serif-i" style={{ fontWeight: 400 }}>คำสั่งซื้อ</span>
        </h1>
        <p style={{ fontSize: 12, color: 'var(--ink-mute)', margin: '6px 0 0' }}>
          ทุก platform · Shopee · TikTok · Shopify · Lazada · หน้าร้าน
        </p>
      </header>

      {/* Lookup form */}
      <section style={{ padding: '0 16px 18px' }}>
        <form onSubmit={track} className="card-product" style={{ padding: 14 }}>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em',
            textTransform: 'uppercase', color: 'var(--ink-mute)', margin: '0 0 10px' }}>
            ค้นหาออเดอร์
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input value={number} onChange={e => setNumber(e.target.value)}
              placeholder="เลขออเดอร์ (เช่น 1001 หรือ #1001)"
              style={inputStyle} />
            <input value={contact} onChange={e => setContact(e.target.value)}
              placeholder="email หรือเบอร์โทรที่ใช้สั่งซื้อ (optional ถ้า login)"
              style={inputStyle} />
            <button type="submit" disabled={searching || !number.trim()}
              style={primaryBtn}>
              <Search size={13} /> {searching ? 'ค้นหา…' : 'ค้นหาสถานะ'}
            </button>
          </div>
        </form>

        {lookupError && (
          <div className="card-product" style={{ marginTop: 10, padding: 12,
            background: '#FBE9E9', borderColor: '#E8B4B4', color: '#B14242',
            display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <AlertCircle size={14} style={{ marginTop: 2 }}/>
            <p style={{ fontSize: 12, margin: 0 }}>{lookupError}</p>
          </div>
        )}

        {lookupBQ && (
          <div style={{ marginTop: 10 }}>
            <BQShipmentResult orderSn={lookupBQ.order_sn} shipments={lookupBQ.shipments} />
          </div>
        )}
      </section>

      {/* My registered orders + shipping (BQ — cross-platform) */}
      <section style={{ padding: '0 16px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 4px 10px' }}>
          <h2 className="display" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
            ออเดอร์ของคุณ
          </h2>
          {bqItems.length > 0 && (
            <span style={{ fontSize: 10.5, color: 'var(--ink-mute)', fontWeight: 700 }}>
              {bqItems.length} รายการ
            </span>
          )}
        </div>

        {loading ? (
          <div className="card-product" style={{ padding: 32, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>
            กำลังโหลด…
          </div>
        ) : bqItems.length === 0 && shopifyOrders.length === 0 ? (
          <div className="card-product" style={{ padding: 36, textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, margin: '0 auto 14px', borderRadius: 16,
              background: 'var(--gold-glow)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'var(--gold-deep)',
            }}>
              <Package size={22} strokeWidth={1.5}/>
            </div>
            <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px' }}>
              ยังไม่มีออเดอร์ที่กำลังจัดส่ง
            </p>
            <p style={{ fontSize: 11.5, color: 'var(--ink-mute)', margin: 0, lineHeight: 1.6 }}>
              ลงทะเบียนสินค้าใน <Link href="/purchases/register" style={{ color: 'var(--gold-deep)', fontWeight: 700 }}>หน้าสินค้าของฉัน</Link><br/>
              เพื่อติดตามสถานะอัตโนมัติ
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {bqItems.map(item => (
              <BQOrderCard key={item.registration.id} item={item} />
            ))}
            {shopifyOrders.map(o => <OrderCard key={o.id} order={o} />)}
          </div>
        )}
      </section>
    </div>
  )
}

function OrderCard({ order, highlight }: { order: ActiveOrder; highlight?: boolean }) {
  const meta = STATUS_META[order.display_status] || STATUS_META.processing
  const dt = order.shopify_created_at ? new Date(order.shopify_created_at) : null
  return (
    <div className="card-product" style={{
      padding: 14,
      border: highlight ? '2px solid var(--gold)' : '1px solid var(--hair)',
      boxShadow: highlight ? '0 6px 18px rgba(160,120,43,0.18)' : 'var(--shadow-1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div>
          <p style={{ fontSize: 10.5, color: 'var(--ink-mute)', margin: 0, letterSpacing: '0.1em',
            textTransform: 'uppercase', fontWeight: 700 }}>
            ออเดอร์
          </p>
          <p style={{ fontSize: 16, fontWeight: 800, margin: '2px 0 0', fontFamily: 'var(--font-mono)' }}>
            {order.name || `#${order.order_number}`}
          </p>
        </div>
        <span style={{
          fontSize: 10.5, padding: '4px 10px', borderRadius: 'var(--r-pill)',
          background: meta.bg, color: meta.color, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <meta.Icon size={11}/> {meta.label}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 11.5, color: 'var(--ink-mute)' }}>
        <span>{order.items_count} ชิ้น</span>
        <span style={{ color: 'var(--ink)' }}>
          ฿{Number(order.total_price).toLocaleString()}
        </span>
        {dt && <span>{dt.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
      </div>

      {order.tracking_number && (
        <div style={{
          marginTop: 10, padding: '8px 10px', borderRadius: 8,
          background: 'var(--bg-soft)', border: '1px solid var(--hair)',
        }}>
          <p style={{ fontSize: 10, color: 'var(--ink-mute)', margin: 0, letterSpacing: '0.1em',
            textTransform: 'uppercase', fontWeight: 700 }}>
            Tracking
          </p>
          <p style={{ fontSize: 12, margin: '2px 0 0', fontWeight: 600 }}>
            {order.tracking_company || 'ผู้ให้บริการ'} · <span style={{ fontFamily: 'var(--font-mono)' }}>{order.tracking_number}</span>
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        {order.tracking_url && (
          <a href={order.tracking_url} target="_blank" rel="noopener noreferrer"
            style={trackBtn}>
            <Truck size={11}/> ติดตามพัสดุ
          </a>
        )}
        {order.order_status_url && (
          <a href={order.order_status_url} target="_blank" rel="noopener noreferrer"
            style={ghostBtn}>
            <ExternalLink size={11}/> ดูออเดอร์
          </a>
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  border: '1px solid var(--hair)', borderRadius: 8,
  fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)',
}
const primaryBtn: React.CSSProperties = {
  padding: '11px 16px', borderRadius: 'var(--r-pill)',
  background: 'var(--ink)', color: '#E8C58C',
  border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
}
const trackBtn: React.CSSProperties = {
  flex: 1, padding: '8px 12px', borderRadius: 'var(--r-pill)',
  background: '#5E8E3E', color: '#fff', textDecoration: 'none',
  fontSize: 11.5, fontWeight: 700, textAlign: 'center',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
}
const ghostBtn: React.CSSProperties = {
  flex: 1, padding: '8px 12px', borderRadius: 'var(--r-pill)',
  background: 'transparent', color: 'var(--ink-mute)', textDecoration: 'none',
  border: '1px solid var(--hair)',
  fontSize: 11.5, fontWeight: 700, textAlign: 'center',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
}

// ============================================================
// BQ Order Card — รูปสินค้า + timeline + tracking
// ============================================================

interface TimelineEvent {
  time: Date
  label: string
  detail?: string
  done: boolean
  highlight?: boolean
  Icon: typeof Clock
  color: string
}

function buildTimeline(reg: BQRegistration['registration'], order: BQOrder | null, ship: BQShipping | undefined): TimelineEvent[] {
  const events: TimelineEvent[] = []
  const orderTime = order?.order_create_time ? new Date(order.order_create_time) : new Date(reg.created_at)

  // 1. Order created
  events.push({
    time:  orderTime,
    label: 'สั่งซื้อสำเร็จ',
    detail: 'ออเดอร์ถูกสร้างขึ้น',
    done:  true,
    Icon:  Package,
    color: '#3A8E5A',
  })

  // 2. Registered in Dreame
  if (reg.created_at && Math.abs(new Date(reg.created_at).getTime() - orderTime.getTime()) > 60_000) {
    events.push({
      time:  new Date(reg.created_at),
      label: 'ลงทะเบียนกับ Dreame',
      detail: 'รับแต้มสะสม',
      done:  true,
      Icon:  CheckCircle,
      color: '#A0782B',
    })
  }

  // 3. Label printed (ถ้ามี)
  if (ship?.shipment_status === 'label_printed' && !ship.shipped_at) {
    events.push({
      time:  new Date(ship.last_event_at || orderTime),
      label: 'พิมพ์ฉลากจัดส่ง',
      detail: 'เตรียมส่งให้ขนส่ง',
      done:  true,
      highlight: true,
      Icon:  Package,
      color: '#C99B3E',
    })
  }

  // 4. Shipped
  if (ship?.shipped_at) {
    events.push({
      time:  new Date(ship.shipped_at),
      label: 'ออกจากคลังสินค้า',
      detail: ship.carrier ? `ส่งผ่าน ${ship.carrier}` : undefined,
      done:  true,
      Icon:  Truck,
      color: '#4A7BC1',
    })
  }

  // 5. Latest event (transit/out_for_delivery)
  if (ship?.last_event_at && ship.shipment_status &&
      ship.shipment_status !== 'delivered' && ship.shipment_status !== 'label_printed') {
    const meta = BQ_STATUS_META[ship.shipment_status]
    events.push({
      time:  new Date(ship.last_event_at),
      label: meta?.label || ship.last_event_status || 'อัพเดตล่าสุด',
      detail: ship.last_event_location || undefined,
      done:  true,
      highlight: true,
      Icon:  meta?.Icon || Truck,
      color: meta?.color || '#4A7BC1',
    })
  }

  // 6. Delivered (final)
  if (ship?.delivered_at) {
    events.push({
      time:  new Date(ship.delivered_at),
      label: 'จัดส่งสำเร็จ',
      detail: ship.last_event_location || undefined,
      done:  true,
      highlight: true,
      Icon:  CheckCircle,
      color: '#3A8E5A',
    })
  } else if (!ship) {
    // ไม่มี ship → expected next step
    events.push({
      time:  new Date(),
      label: 'รอข้อมูลการจัดส่ง',
      detail: 'ระบบจะแสดงสถานะเมื่อร้านค้าเตรียมส่ง',
      done:  false,
      Icon:  Clock,
      color: '#9CA29A',
    })
  }

  return events.sort((a, b) => a.time.getTime() - b.time.getTime())
}

function BQOrderCard({ item }: { item: BQRegistration }) {
  const reg = item.registration
  const order = item.order
  const ship = item.shipments[0]
  const platform = PLATFORM_LABEL[reg.platform] || PLATFORM_LABEL[order?.platform || ''] || reg.platform
  const status = ship?.shipment_status as BQShipStatus | undefined
  const meta = status ? BQ_STATUS_META[status] : null

  // ดึงสินค้าหลัก (item แรก)
  const mainItem = order?.items?.[0]
  const itemName = mainItem?.item_name || mainItem?.model_name || reg.item_name || 'สินค้าที่ลงทะเบียน'
  const totalAmount = order?.total_amount ?? reg.total_amount ?? 0
  const itemCount = order?.items?.length || 0

  const timeline = buildTimeline(reg, order, ship)
  const [expanded, setExpanded] = useState(false)
  const visibleEvents = expanded ? timeline : timeline.slice(-3)

  return (
    <div className="card-product" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Top section — รูป + ข้อมูล + status */}
      <div style={{ display: 'flex', gap: 12, padding: 14 }}>
        {/* Product image */}
        <div style={{
          width: 70, height: 70, flexShrink: 0,
          borderRadius: 'var(--r-md)',
          background: 'var(--bg-soft)',
          overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {mainItem?.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mainItem.image_url} alt={itemName}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Package size={24} color="var(--ink-faint)" strokeWidth={1.4}/>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{
              fontSize: 9, padding: '2px 7px', borderRadius: 'var(--r-pill)',
              background: 'var(--bg-soft)', color: 'var(--ink-soft)',
              fontWeight: 700, letterSpacing: '0.06em',
            }}>{platform}</span>
            {itemCount > 1 && (
              <span style={{ fontSize: 9.5, color: 'var(--ink-faint)' }}>
                +{itemCount - 1} รายการ
              </span>
            )}
          </div>
          <p style={{ fontSize: 13.5, fontWeight: 700, margin: 0, lineHeight: 1.3,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
            {itemName}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <span style={{
              fontSize: 10, color: 'var(--ink-faint)',
              fontFamily: 'var(--font-mono)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100,
            }}>
              #{reg.order_sn}
            </span>
            {totalAmount > 0 && (
              <>
                <span style={{ color: 'var(--ink-ghost)' }}>·</span>
                <span style={{ fontSize: 11.5, color: 'var(--ink)', fontWeight: 700 }}>
                  ฿{Number(totalAmount).toLocaleString()}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Status pill */}
        {meta && (
          <span style={{
            fontSize: 10, padding: '4px 9px', borderRadius: 'var(--r-pill)',
            background: `${meta.color}1A`, color: meta.color, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0,
            alignSelf: 'flex-start',
          }}>
            <meta.Icon size={10}/> {meta.label}
          </span>
        )}
      </div>

      {/* Timeline */}
      <div style={{
        background: 'var(--bg-soft)',
        padding: '12px 14px 4px',
        borderTop: '1px solid var(--hair)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--ink-mute)', margin: 0 }}>
            สถานะการจัดส่ง
          </p>
          {timeline.length > 3 && (
            <button onClick={() => setExpanded(e => !e)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 10.5, color: 'var(--gold-deep)', fontWeight: 700,
            }}>
              {expanded ? 'ย่อ' : `ดูทั้งหมด (${timeline.length})`}
            </button>
          )}
        </div>

        <div style={{ position: 'relative', paddingLeft: 6 }}>
          {visibleEvents.map((ev, i) => {
            const isLast = i === visibleEvents.length - 1
            return (
              <div key={i} style={{
                position: 'relative',
                paddingBottom: isLast ? 0 : 14,
                paddingLeft: 24,
              }}>
                {/* Connector line */}
                {!isLast && (
                  <div aria-hidden style={{
                    position: 'absolute',
                    left: 6, top: 18, bottom: 0,
                    width: 1.5,
                    background: ev.done ? `${ev.color}40` : 'var(--ink-ghost)',
                  }} />
                )}
                {/* Dot */}
                <div style={{
                  position: 'absolute', left: 0, top: 4,
                  width: 13, height: 13, borderRadius: '50%',
                  background: ev.done ? ev.color : 'var(--surface)',
                  border: `2px solid ${ev.done ? ev.color : 'var(--ink-ghost)'}`,
                  boxShadow: ev.highlight ? `0 0 0 3px ${ev.color}26` : 'none',
                }} />
                <div>
                  <p style={{
                    fontSize: 12, fontWeight: ev.highlight ? 800 : 600,
                    margin: 0, color: ev.done ? 'var(--ink)' : 'var(--ink-mute)',
                  }}>
                    {ev.label}
                  </p>
                  {ev.detail && (
                    <p style={{ fontSize: 10.5, color: 'var(--ink-mute)',
                      margin: '1px 0 0', lineHeight: 1.45 }}>
                      {ev.detail}
                    </p>
                  )}
                  {ev.done && (
                    <p style={{ fontSize: 9.5, color: 'var(--ink-faint)',
                      margin: '2px 0 0', letterSpacing: '0.02em' }}>
                      {ev.time.toLocaleString('th-TH', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tracking action */}
      {ship && ship.tracking_numbers.length > 0 && (
        <div style={{
          padding: '10px 14px', borderTop: '1px solid var(--hair)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 9.5, color: 'var(--ink-mute)', margin: 0,
              letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
              Tracking · {ship.carrier || 'ผู้ให้บริการ'}
            </p>
            <p style={{ fontSize: 11.5, margin: '2px 0 0', fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ship.tracking_numbers.join(', ')}
            </p>
          </div>
          {ship.tracking_urls.length > 0 && (
            <a href={ship.tracking_urls[0]} target="_blank" rel="noopener noreferrer"
              style={{
                padding: '7px 12px', borderRadius: 'var(--r-pill)',
                background: '#5E8E3E', color: '#fff', textDecoration: 'none',
                fontSize: 11, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
              }}>
              <ExternalLink size={10}/> ติดตาม
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Lookup result — สถานะการจัดส่งจาก BQ
// ============================================================
function BQShipmentResult({ orderSn, shipments }: { orderSn: string; shipments: BQShipping[] }) {
  if (shipments.length === 0) {
    return (
      <div className="card-product" style={{ padding: 16, background: 'var(--bg-soft)' }}>
        <p style={{ fontSize: 12.5, margin: 0, color: 'var(--ink-mute)' }}>
          พบออเดอร์ <code style={{ fontFamily: 'var(--font-mono)' }}>{orderSn}</code> แต่ยังไม่มีข้อมูลการจัดส่ง
        </p>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {shipments.map((s, i) => {
        const meta = s.shipment_status ? BQ_STATUS_META[s.shipment_status as BQShipStatus] : null
        const platform = PLATFORM_LABEL[s.platform] || s.platform
        return (
          <div key={i} className="card-product" style={{
            padding: 14, border: '2px solid var(--gold)',
            boxShadow: '0 6px 18px rgba(160,120,43,0.18)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <p style={{ fontSize: 10, color: 'var(--ink-mute)', margin: 0,
                  letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
                  {platform} · #{s.order_sn}
                </p>
                {s.brand_name && (
                  <p style={{ fontSize: 13, fontWeight: 700, margin: '2px 0 0' }}>
                    {s.brand_name}
                  </p>
                )}
              </div>
              {meta && (
                <span style={{
                  fontSize: 10.5, padding: '4px 10px', borderRadius: 'var(--r-pill)',
                  background: `${meta.color}1A`, color: meta.color, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
                }}>
                  <meta.Icon size={11}/> {meta.label}
                </span>
              )}
            </div>

            {s.tracking_numbers.length > 0 && (
              <div style={{
                marginTop: 8, padding: '8px 10px', borderRadius: 8,
                background: 'var(--bg-soft)',
              }}>
                <p style={{ fontSize: 10, color: 'var(--ink-mute)', margin: 0,
                  letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
                  {s.carrier || 'ผู้ให้บริการ'}
                </p>
                <p style={{ fontSize: 12, margin: '2px 0 0', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {s.tracking_numbers.join(', ')}
                </p>
                {s.last_event_at && (
                  <p style={{ fontSize: 10, color: 'var(--ink-faint)', margin: '4px 0 0',
                    display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <MapPin size={9}/>
                    {s.last_event_status} {s.last_event_location && `· ${s.last_event_location}`}
                  </p>
                )}
              </div>
            )}

            {s.tracking_urls.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <a href={s.tracking_urls[0]} target="_blank" rel="noopener noreferrer"
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 'var(--r-pill)',
                    background: '#5E8E3E', color: '#fff', textDecoration: 'none',
                    fontSize: 11.5, fontWeight: 700, textAlign: 'center',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}>
                  <ExternalLink size={11}/> ติดตามพัสดุ
                </a>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
