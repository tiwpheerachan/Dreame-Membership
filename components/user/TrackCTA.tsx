'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Truck, ChevronRight, Sparkles } from 'lucide-react'

interface ActiveOrder {
  display_status: string
}

export default function TrackCTA() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    function load() {
      if (document.hidden) return
      fetch('/api/orders/me-bq', { cache: 'no-store' })
        .then(r => r.json())
        .then(d => {
          if (cancelled) return
          const items = (d.items || []) as Array<{ shipments?: Array<{ shipment_status?: string }> }>
          const active = items.filter(it => {
            const s = it.shipments?.[0]?.shipment_status
            return s && s !== 'delivered' && s !== 'cancelled' && s !== 'failure'
          }).length
          setCount(active)
        })
        .catch(() => { if (!cancelled) setCount(0) })
    }

    load()
    // Auto-refresh ทุก 90 วินาที (เบากว่า /track เพราะแสดงแค่ count)
    const interval = setInterval(load, 90_000)
    // Refresh เมื่อกลับมาที่แท็บ
    function onVisible() { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', load)
    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', load)
    }
  }, [])

  return (
    <Link href="/track" className="tap" style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 18px',
      borderRadius: 16,
      background: 'linear-gradient(180deg, #FAF3DC 0%, #EADBB1 35%, #C9A063 75%, #A0782B 100%)',
      boxShadow:
        'inset 0 1px 0 rgba(255,250,235,0.95), inset 0 -1px 0 rgba(120,80,20,0.35), 0 6px 18px rgba(160,120,43,0.34)',
      textDecoration: 'none', color: 'inherit',
      overflow: 'hidden',
    }}>
      {/* Decorative sparkles */}
      <Sparkles size={56} aria-hidden style={{
        position: 'absolute', right: -10, top: -10,
        color: 'rgba(255,250,235,0.35)', pointerEvents: 'none',
      }} />

      {/* Icon */}
      <div style={{
        position: 'relative', zIndex: 1, flexShrink: 0,
        width: 42, height: 42, borderRadius: 12,
        background: '#1A1815',
        color: '#E8C58C',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(20,18,15,0.25)',
      }}>
        <Truck size={20} strokeWidth={2.2} />
      </div>

      {/* Body */}
      <div style={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 14.5, fontWeight: 800,
          color: '#1A1815', lineHeight: 1.2,
          textShadow: '0 1px 0 rgba(255,250,235,0.55)',
        }}>
          ติดตามสถานะการจัดส่ง
        </p>
        <p style={{
          margin: '3px 0 0', fontSize: 11, fontWeight: 600,
          color: 'rgba(26,24,21,0.72)', lineHeight: 1.35,
        }}>
          {count === null
            ? 'ดูออเดอร์ทุก platform ที่เดียว'
            : count > 0
              ? `${count} ออเดอร์ กำลังจัดส่ง · ดูสถานะ`
              : 'ดูออเดอร์ทุก platform ที่เดียว'}
        </p>
      </div>

      {/* Live badge — ถ้ามี active */}
      {count !== null && count > 0 && (
        <span style={{
          position: 'relative', zIndex: 1, flexShrink: 0,
          padding: '4px 9px', borderRadius: 999,
          background: '#1A1815', color: '#E8C58C',
          fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: '#3A8E5A',
            boxShadow: '0 0 0 3px rgba(58,142,90,0.35)',
            animation: 'pulse-dot 2s ease-in-out infinite',
          }} />
          LIVE
        </span>
      )}

      {/* Arrow */}
      <ChevronRight size={20} style={{
        position: 'relative', zIndex: 1, flexShrink: 0,
        color: '#1A1815',
      }} />

      <style suppressHydrationWarning>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(1.4); }
        }
      `}</style>
    </Link>
  )
}
