'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Truck, ChevronRight, Package, Sparkles } from 'lucide-react'

interface ActiveOrder {
  id: number
  name: string
  total_price: string | number
  tracking_number: string | null
  display_status: 'cancelled' | 'delivered' | 'in_transit' | 'partial' | 'paid' | 'processing'
  items_count: number
}

interface Props {
  variant?: 'banner' | 'button'  // banner = full-width card, button = compact
}

export default function TrackOrderBanner({ variant = 'banner' }: Props) {
  const [orders, setOrders] = useState<ActiveOrder[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/orders/me', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setOrders((d.active || []).filter((o: ActiveOrder) =>
        o.display_status === 'in_transit' || o.display_status === 'processing' || o.display_status === 'paid'
      )))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  if (!loaded) return null

  // Compact button version (header / nav)
  if (variant === 'button') {
    return (
      <Link href="/track" className="tap" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 12px', borderRadius: 'var(--r-pill)',
        background: orders.length > 0
          ? 'linear-gradient(135deg, #FAF3DC 0%, #EADBB1 100%)'
          : 'var(--surface)',
        border: orders.length > 0 ? '1px solid var(--gold)' : '1px solid var(--hair)',
        color: orders.length > 0 ? 'var(--gold-deep)' : 'var(--ink-mute)',
        textDecoration: 'none', fontSize: 11.5, fontWeight: 700,
        boxShadow: orders.length > 0 ? '0 2px 8px rgba(160,120,43,0.18)' : 'none',
      }}>
        {orders.length > 0
          ? <><Truck size={12}/> กำลังส่ง {orders.length}</>
          : <><Package size={12}/> ติดตามออเดอร์</>}
      </Link>
    )
  }

  // Banner — only show if has active orders
  if (orders.length === 0) return null

  const first = orders[0]
  const moreCount = orders.length - 1

  return (
    <Link href="/track" className="tap" style={{
      display: 'block', textDecoration: 'none', color: 'inherit',
      margin: '0 16px 16px',
      padding: 14,
      borderRadius: 'var(--r-lg)',
      background: 'linear-gradient(135deg, #FAF3DC 0%, #F0DCAA 100%)',
      border: '1px solid var(--gold)',
      boxShadow: '0 4px 16px rgba(160,120,43,0.18)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Decorative sparkles */}
      <Sparkles size={48} style={{
        position: 'absolute', right: -8, top: -8,
        color: 'rgba(160,120,43,0.12)', pointerEvents: 'none',
      }}/>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
        <div style={{
          flexShrink: 0,
          width: 44, height: 44, borderRadius: 12,
          background: 'var(--ink)', color: '#E8C58C',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 10px rgba(20,18,15,0.20)',
        }}>
          <Truck size={20} strokeWidth={2}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 9.5, fontWeight: 800, letterSpacing: '0.16em',
            textTransform: 'uppercase', color: 'var(--gold-deep)', margin: 0,
          }}>
            {first.display_status === 'in_transit' ? 'กำลังจัดส่ง' :
             first.display_status === 'processing' ? 'กำลังเตรียมส่ง' :
                                                     'พร้อมจัดส่ง'}
          </p>
          <p style={{
            fontSize: 13, fontWeight: 800, margin: '2px 0 0', color: 'var(--ink)',
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as const,
          }}>
            ออเดอร์ <span style={{ fontFamily: 'var(--font-mono)' }}>{first.name}</span>
            {moreCount > 0 && <> + อีก {moreCount}</>}
          </p>
          <p style={{ fontSize: 10.5, color: 'var(--ink-mute)', margin: '2px 0 0' }}>
            {first.items_count} ชิ้น · ฿{Number(first.total_price).toLocaleString()}
            {first.tracking_number && ' · มี tracking แล้ว'}
          </p>
        </div>
        <ChevronRight size={18} color="var(--gold-deep)" strokeWidth={2.4}/>
      </div>
    </Link>
  )
}
