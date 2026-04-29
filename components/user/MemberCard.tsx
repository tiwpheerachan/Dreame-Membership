'use client'
import { useRef, useState } from 'react'
import type { User } from '@/types'

interface Props { user: User }

// `bg` is the fallback gradient if the image fails to load — tuned per tier
// to match the dominant tone of each background image.
const TIER = {
  SILVER: {
    label: 'Silver',
    bg: 'linear-gradient(135deg, #C9D9E8 0%, #B8C5DA 50%, #DCD0E0 100%)',
    accent: '#fff',
    sub: 'rgba(255,255,255,0.85)',
    image: '/images/member-card/silver.jpg',
  },
  GOLD: {
    label: 'Gold',
    bg: 'linear-gradient(135deg, #F4C28A 0%, #E89A6B 50%, #C46B3A 100%)',
    accent: '#fff',
    sub: 'rgba(255,255,255,0.85)',
    image: '/images/member-card/gold.jpg',
  },
  PLATINUM: {
    label: 'Platinum',
    bg: 'linear-gradient(135deg, #5EEAD4 0%, #2DD4BF 50%, #14B8A6 100%)',
    accent: '#fff',
    sub: 'rgba(255,255,255,0.85)',
    image: '/images/member-card/platinum.jpg',
  },
  // Legacy values (PLUS/PRO/ULTRA/MASTER) — map to new tiers for safety
  PLUS:   { label: 'Silver',   bg: 'linear-gradient(135deg, #C9D9E8, #B8C5DA 50%, #DCD0E0)', accent: '#fff', sub: 'rgba(255,255,255,0.85)', image: '/images/member-card/silver.jpg' },
  PRO:    { label: 'Gold',     bg: 'linear-gradient(135deg, #F4C28A, #E89A6B 50%, #C46B3A)', accent: '#fff', sub: 'rgba(255,255,255,0.85)', image: '/images/member-card/gold.jpg' },
  ULTRA:  { label: 'Platinum', bg: 'linear-gradient(135deg, #5EEAD4, #2DD4BF 50%, #14B8A6)', accent: '#fff', sub: 'rgba(255,255,255,0.85)', image: '/images/member-card/platinum.jpg' },
  MASTER: { label: 'Platinum', bg: 'linear-gradient(135deg, #5EEAD4, #2DD4BF 50%, #14B8A6)', accent: '#fff', sub: 'rgba(255,255,255,0.85)', image: '/images/member-card/platinum.jpg' },
}

export default function MemberCard({ user }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const tierKey = String(user.tier || 'SILVER').toUpperCase() as keyof typeof TIER
  const t = TIER[tierKey] ?? TIER.SILVER
  const [bgOk, setBgOk] = useState(true)

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = cardRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = e.clientX - r.left, y = e.clientY - r.top
    const rx = ((y / r.height) - 0.5) * -6
    const ry = ((x / r.width) - 0.5) * 6
    el.style.transform = `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg)`
    el.style.setProperty('--mx', `${(x / r.width * 100).toFixed(1)}%`)
    el.style.setProperty('--my', `${(y / r.height * 100).toFixed(1)}%`)
  }
  function onLeave() {
    const el = cardRef.current
    if (!el) return
    el.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg)'
  }

  const memberSince = (() => {
    try {
      const d = new Date(user.created_at)
      return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`
    } catch { return '—' }
  })()

  return (
    <div style={{ padding: '0 16px', perspective: 1200 }}>
      <div
        ref={cardRef}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="shimmer-sweep"
        style={{
          position: 'relative', overflow: 'hidden',
          aspectRatio: '85.6 / 53.98',
          width: '100%', maxWidth: 380, margin: '0 auto',
          borderRadius: 18,
          background: t.bg,
          // Layered shadow + edge highlights for a glassy 3D card feel
          boxShadow: [
            '0 24px 48px rgba(0,0,0,0.32)',         // primary drop shadow
            '0 8px 16px rgba(0,0,0,0.18)',          // tighter contact shadow
            '0 1px 0 rgba(255,255,255,0.30) inset', // top inner highlight
            '0 -1px 0 rgba(0,0,0,0.18) inset',      // bottom inner shade
            '0 0 0 1px rgba(255,255,255,0.10)',     // crisp outer rim
          ].join(', '),
          padding: '24px 26px 22px',
          transition: 'transform 200ms ease, box-shadow 200ms ease',
          willChange: 'transform',
          color: t.accent,
        }}
      >
        {/* ── Background image (optional, falls back to gradient) ── */}
        {bgOk && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={t.image}
            alt=""
            onError={() => setBgOk(false)}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%', objectFit: 'cover',
              zIndex: 0,
            }}
          />
        )}

        {/* ── Soft contrast overlay so text reads, but image still shines through ── */}
        {bgOk && (
          <div aria-hidden style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.28) 100%)',
          }} />
        )}

        {/* ── Top gloss highlight (3D plastic/glass effect) ── */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
          background:
            'linear-gradient(160deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.08) 18%, transparent 42%)',
        }} />

        {/* ── Spotlight gloss following cursor ── */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
          background: 'radial-gradient(circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,0.28) 0%, transparent 32%)',
          mixBlendMode: 'overlay',
        }} />

        {/* ── Sparkles inside card ── */}
        <div className="sparkle sparkle-1" style={{ zIndex: 2 }} />
        <div className="sparkle sparkle-2" style={{ zIndex: 2 }} />
        <div className="sparkle sparkle-3" style={{ zIndex: 2 }} />
        <div className="sparkle sparkle-4" style={{ zIndex: 2 }} />

        {/* ── Content ── */}
        <div style={{
          position: 'relative', zIndex: 3, height: '100%',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          color: t.accent,
        }}>
          {/* Top: brand + tier */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.20em', textTransform: 'uppercase',
                color: t.sub, margin: '0 0 4px',
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
              }}>
                Dreame Membership
              </p>
              <p className="display" style={{
                fontSize: 28, fontWeight: 800, margin: 0, lineHeight: 1, color: t.accent,
                textShadow: '0 2px 8px rgba(0,0,0,0.25)',
              }}>
                {t.label}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{
                fontSize: 14, fontWeight: 800, letterSpacing: '0.08em', color: t.accent, margin: 0,
                textShadow: '0 1px 4px rgba(0,0,0,0.3)',
              }}>
                DREAME
              </p>
            </div>
          </div>

          {/* Mid: chip + member id */}
          <div style={{
            position: 'absolute', left: 0, right: 0, top: '52%', transform: 'translateY(-50%)',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 38, height: 28, borderRadius: 5,
              background: 'linear-gradient(135deg,rgba(255,255,255,0.40),rgba(255,255,255,0.12))',
              border: '1px solid rgba(255,255,255,0.30)',
              position: 'relative', overflow: 'hidden', flexShrink: 0,
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            }}>
              <div style={{
                position: 'absolute', inset: 4, borderRadius: 3,
                backgroundImage:
                  `repeating-linear-gradient(0deg, rgba(255,255,255,0.4) 0 1px, transparent 1px 4px),
                   repeating-linear-gradient(90deg, rgba(255,255,255,0.4) 0 1px, transparent 1px 4px)`,
              }} />
            </div>
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 16, letterSpacing: '0.18em',
              color: t.accent, margin: 0, fontWeight: 600,
              textShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }}>
              {user.member_id || '— — — — — —'}
            </p>
          </div>

          {/* Bottom: holder + since */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
                color: t.sub, margin: '0 0 3px',
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
              }}>
                Cardholder
              </p>
              <p style={{
                fontSize: 14, fontWeight: 700, color: t.accent, margin: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                letterSpacing: '0.02em',
                textShadow: '0 2px 6px rgba(0,0,0,0.3)',
              }}>
                {(user.full_name || 'Dreame Member').toUpperCase()}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
                color: t.sub, margin: '0 0 3px',
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
              }}>
                Member Since
              </p>
              <p style={{
                fontSize: 13, fontWeight: 600, color: t.accent, margin: 0,
                fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
                textShadow: '0 1px 4px rgba(0,0,0,0.3)',
              }}>
                {memberSince}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
