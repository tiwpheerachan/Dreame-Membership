'use client'
import { useRef } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Plus, ShieldCheck, Ticket, Gift, Sparkles, Star } from 'lucide-react'

const ICONS = { Plus, ShieldCheck, Ticket, Gift, Sparkles, Star } as const
type IconKey = keyof typeof ICONS

interface Props {
  href: string
  icon: IconKey
  label: string
  sub: string
  /** gradient for card background */
  gradient: string
  /** secondary accent color (used in icon ring) */
  accent?: string
  /** delay sweep animation for stagger */
  delay?: number
}

export default function ActionCard({ href, icon, label, sub, gradient, accent = '#EADBB1', delay = 0 }: Props) {
  const Icon = ICONS[icon]
  const cardRef = useRef<HTMLAnchorElement>(null)

  function onMove(e: React.MouseEvent<HTMLAnchorElement>) {
    const el = cardRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = e.clientX - r.left, y = e.clientY - r.top
    const rx = ((y / r.height) - 0.5) * -8
    const ry = ((x / r.width)  - 0.5) *  8
    el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.02)`
    el.style.setProperty('--mx', `${(x / r.width * 100).toFixed(1)}%`)
    el.style.setProperty('--my', `${(y / r.height * 100).toFixed(1)}%`)
  }
  function onLeave() {
    const el = cardRef.current
    if (!el) return
    el.style.transform = 'perspective(900px) rotateX(0) rotateY(0) scale(1)'
  }

  return (
    <Link
      ref={cardRef}
      href={href}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="shimmer-sweep"
      style={{
        position: 'relative', overflow: 'hidden',
        textDecoration: 'none', color: '#fff',
        borderRadius: 'var(--r-lg)',
        aspectRatio: '4 / 5',
        transition: 'transform 0.3s cubic-bezier(0.34,1.1,0.64,1)',
        willChange: 'transform',
        animationDelay: `${delay}s`,
        boxShadow: 'var(--shadow-2)',
        background: gradient,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: 18,
      }}
    >
      {/* spotlight gloss */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: 'radial-gradient(circle at var(--mx,50%) var(--my,30%), rgba(255,255,255,0.22) 0%, transparent 35%)',
        mixBlendMode: 'overlay',
      }} />

      {/* sparkles */}
      <div className="sparkle sparkle-1" style={{ zIndex: 2 }} />
      <div className="sparkle sparkle-3" style={{ zIndex: 2 }} />

      {/* gold corner */}
      <span aria-hidden style={{
        position: 'absolute', top: 12, right: 14, zIndex: 3,
        fontSize: 11, color: accent, opacity: 0.85,
      }}>✦</span>

      {/* TOP: big icon in bordered ring */}
      <div style={{ position: 'relative', zIndex: 3 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 18,
          background: 'rgba(255,255,255,0.10)',
          border: '1px solid rgba(255,255,255,0.22)',
          backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
          boxShadow: '0 8px 20px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.20)',
        }}>
          <Icon size={26} strokeWidth={1.7} />
        </div>
      </div>

      {/* BOTTOM: label + arrow */}
      <div style={{ position: 'relative', zIndex: 3, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.65)',
            margin: '0 0 4px',
          }}>
            {sub}
          </p>
          <p className="display" style={{
            fontSize: 16, fontWeight: 800, color: '#fff', margin: 0,
            lineHeight: 1.15, letterSpacing: '-0.01em',
            textShadow: '0 2px 6px rgba(0,0,0,0.25)',
            whiteSpace: 'pre-line',
          }}>
            {label}
          </p>
        </div>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'var(--gold)', color: '#0E0E0E',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 4px 14px rgba(160,120,43,0.55)',
        }}>
          <ArrowUpRight size={14} strokeWidth={2.4} />
        </div>
      </div>
    </Link>
  )
}
