'use client'
import { useRef, useState } from 'react'
import type { User } from '@/types'

interface Props { user: User }

const TIER = {
  PLUS: {
    label: 'Plus',
    bg: 'linear-gradient(160deg, #BFBFBF 0%, #6B6B6B 100%)',
    accent: '#fff',
    sub: 'rgba(255,255,255,0.75)',
    image: '/images/member-card/plus.jpg',
  },
  PRO: {
    label: 'Pro',
    bg: 'linear-gradient(160deg, #4A4A4A 0%, #0E0E0E 100%)',
    accent: '#fff',
    sub: 'rgba(255,255,255,0.65)',
    image: '/images/member-card/pro.jpg',
  },
  ULTRA: {
    label: 'Ultra',
    bg: 'linear-gradient(160deg, #E89A6B 0%, #B85A2F 100%)',
    accent: '#fff',
    sub: 'rgba(255,255,255,0.85)',
    image: '/images/member-card/ultra.jpg',
  },
  MASTER: {
    label: 'Master',
    bg: 'linear-gradient(160deg, #C99A4D 0%, #5C3F1A 100%)',
    accent: '#fff',
    sub: 'rgba(255,255,255,0.85)',
    image: '/images/member-card/master.jpg',
  },
  // Legacy
  SILVER:   { label: 'Plus',   bg: 'linear-gradient(160deg, #BFBFBF, #6B6B6B)', accent: '#fff', sub: 'rgba(255,255,255,0.75)', image: '/images/member-card/plus.jpg' },
  GOLD:     { label: 'Pro',    bg: 'linear-gradient(160deg, #4A4A4A, #0E0E0E)', accent: '#fff', sub: 'rgba(255,255,255,0.65)', image: '/images/member-card/pro.jpg' },
  PLATINUM: { label: 'Master', bg: 'linear-gradient(160deg, #C99A4D, #5C3F1A)', accent: '#fff', sub: 'rgba(255,255,255,0.85)', image: '/images/member-card/master.jpg' },
}

export default function MemberCard({ user }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const tierKey = String(user.tier || 'PLUS').toUpperCase() as keyof typeof TIER
  const t = TIER[tierKey] ?? TIER.PLUS
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
          borderRadius: 'var(--r-xl)',
          background: t.bg,
          boxShadow:
            '0 32px 80px rgba(0,0,0,0.45), 0 12px 32px rgba(0,0,0,0.35), ' +
            '0 0 0 1px rgba(212,185,120,0.18), inset 0 1px 0 rgba(255,255,255,0.12)',
          padding: '24px 26px 22px',
          transition: 'transform 200ms ease',
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

        {/* ── Dark overlay so text reads on busy images ── */}
        {bgOk && (
          <div aria-hidden style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            background: 'linear-gradient(180deg, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.40) 100%)',
          }} />
        )}

        {/* ── Spotlight gloss following cursor ── */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
          background: 'radial-gradient(circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,0.22) 0%, transparent 28%)',
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
