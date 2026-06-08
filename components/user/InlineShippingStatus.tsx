'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Truck, CheckCircle, Clock, XCircle, ExternalLink, MapPin, RefreshCw,
} from 'lucide-react'

interface BQShipping {
  platform: string
  brand_name: string
  order_sn: string
  shipment_status: string | null
  carrier: string | null
  tracking_numbers: string[]
  tracking_urls: string[]
  shipped_at: string | null
  delivered_at: string | null
  last_event_status: string | null
  last_event_at: string | null
  last_event_location: string | null
}

const STATUS_META: Record<string, { label: string; color: string; Icon: typeof Clock }> = {
  label_printed:    { label: 'พิมพ์ฉลาก',     color: '#C99B3E', Icon: Clock },
  in_transit:       { label: 'กำลังจัดส่ง',   color: '#4A7BC1', Icon: Truck },
  out_for_delivery: { label: 'ออกส่งวันนี้',  color: '#4A7BC1', Icon: Truck },
  delivered:        { label: 'จัดส่งสำเร็จ', color: '#3A8E5A', Icon: CheckCircle },
  failure:          { label: 'จัดส่งไม่สำเร็จ', color: '#B14242', Icon: XCircle },
  cancelled:        { label: 'ยกเลิก',       color: '#B14242', Icon: XCircle },
}

interface Props {
  orderSn: string
  compact?: boolean
}

export default function InlineShippingStatus({ orderSn, compact }: Props) {
  const [shipments, setShipments] = useState<BQShipping[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load(silent = false) {
    if (!silent) setLoading(true)
    setError('')
    try {
      const r = await fetch(`/api/orders/track-bq?order_sn=${encodeURIComponent(orderSn)}`, { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok) {
        if (r.status === 404) { setShipments([]); return }
        throw new Error(d.error)
      }
      setShipments(d.shipments || [])
    } catch (e) { setError((e as Error).message) }
    finally { if (!silent) setLoading(false) }
  }
  useEffect(() => {
    load()
    // Auto-refresh ทุก 90s + เมื่อกลับมาที่แท็บ
    const interval = setInterval(() => {
      if (!document.hidden) load(true)
    }, 90_000)
    function onVisible() { if (!document.hidden) load(true) }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderSn])

  // Loading state
  if (loading) {
    return (
      <div style={{
        padding: 12, borderRadius: 'var(--r-md)',
        background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 12, color: 'var(--ink-mute)',
      }}>
        <RefreshCw size={12} className="animate-spin"/> กำลังตรวจสอบสถานะ…
      </div>
    )
  }

  // No shipping data
  if (shipments.length === 0) {
    return (
      <div style={{
        padding: 12, borderRadius: 'var(--r-md)',
        background: 'var(--bg-soft)', border: '1px solid var(--hair)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={14} color="var(--ink-mute)"/>
          <p style={{ fontSize: 12, margin: 0, color: 'var(--ink-mute)' }}>
            ยังไม่มีข้อมูลการจัดส่ง
          </p>
          <Link href={`/track?order_sn=${orderSn}`} style={{
            marginLeft: 'auto', fontSize: 10.5, color: 'var(--gold-deep)',
            textDecoration: 'none', fontWeight: 700,
          }}>
            ดู / ค้นหาเอง →
          </Link>
        </div>
        {error && (
          <p style={{ fontSize: 10, color: 'var(--ink-faint)', margin: '4px 0 0' }}>
            {error}
          </p>
        )}
      </div>
    )
  }

  // Compact (1 line) — สำหรับ list
  if (compact) {
    const s = shipments[0]
    const meta = s.shipment_status ? STATUS_META[s.shipment_status] : null
    return (
      <Link href={`/track?order_sn=${orderSn}`} style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px', borderRadius: 8,
        background: meta ? `${meta.color}0F` : 'var(--bg-soft)',
        border: `1px solid ${meta ? `${meta.color}33` : 'var(--hair)'}`,
        textDecoration: 'none', color: 'inherit',
        fontSize: 11.5,
      }}>
        {meta && <meta.Icon size={13} color={meta.color}/>}
        <span style={{ fontWeight: 700, color: meta?.color || 'var(--ink)' }}>
          {meta?.label || s.shipment_status}
        </span>
        {s.carrier && (
          <span style={{ color: 'var(--ink-mute)' }}>· {s.carrier}</span>
        )}
        <span style={{ marginLeft: 'auto', color: 'var(--ink-faint)' }}>→</span>
      </Link>
    )
  }

  // Full card
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {shipments.map((s, i) => {
        const meta = s.shipment_status ? STATUS_META[s.shipment_status] : null
        return (
          <div key={i} style={{
            padding: 14, borderRadius: 'var(--r-md)',
            background: 'var(--surface)', border: '1px solid var(--hair)',
            boxShadow: '0 2px 8px rgba(20,18,15,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <div>
                <p style={{ fontSize: 10, color: 'var(--ink-mute)', margin: 0,
                  letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>
                  สถานะการจัดส่ง
                </p>
                {s.carrier && (
                  <p style={{ fontSize: 13, fontWeight: 700, margin: '2px 0 0' }}>
                    {s.carrier}
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
              <p style={{ fontSize: 11.5, margin: '2px 0', fontFamily: 'var(--font-mono)',
                fontWeight: 600, wordBreak: 'break-all' }}>
                {s.tracking_numbers.join(', ')}
              </p>
            )}

            {s.last_event_at && (
              <div style={{
                marginTop: 8, fontSize: 10.5, color: 'var(--ink-mute)',
                display: 'flex', alignItems: 'center', gap: 4, lineHeight: 1.4,
              }}>
                <MapPin size={10}/>
                <span>{s.last_event_status}</span>
                {s.last_event_location && <span>· {s.last_event_location}</span>}
                <span style={{ marginLeft: 'auto', color: 'var(--ink-faint)' }}>
                  {new Date(s.last_event_at).toLocaleString('th-TH', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              {s.tracking_urls.length > 0 && (
                <a href={s.tracking_urls[0]} target="_blank" rel="noopener noreferrer"
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 'var(--r-pill)',
                    background: '#5E8E3E', color: '#fff', textDecoration: 'none',
                    fontSize: 11.5, fontWeight: 700, textAlign: 'center',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}>
                  <ExternalLink size={11}/> ติดตามที่ {s.carrier || 'ผู้ให้บริการ'}
                </a>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
