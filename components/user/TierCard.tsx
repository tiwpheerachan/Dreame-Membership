'use client'
import type { UserTier } from '@/types'

interface Props {
  tier: UserTier
  isCurrent?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const TIERS: Record<UserTier, { label: string; range: string; image: string; cls: string }> = {
  SILVER:   { label: 'Silver',   range: '0 – 79 Points',    image: '/images/tiers/silver.png',   cls: 'tier-silver' },
  GOLD:     { label: 'Gold',     range: '80 – 399 Points',  image: '/images/tiers/gold.png',     cls: 'tier-gold' },
  PLATINUM: { label: 'Platinum', range: '400+ Points',      image: '/images/tiers/platinum.png', cls: 'tier-platinum' },
}

export default function TierCard({ tier, isCurrent }: Props) {
  const t = TIERS[tier] ?? TIERS.SILVER
  return (
    <div className={`tier-card ${t.cls}`} style={{
      boxShadow: isCurrent ? '0 0 0 3px var(--gold), var(--shadow-2)' : 'var(--shadow-1)',
      transition: 'transform 0.25s ease',
    }}>
      {/* Top: label + points range */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <p className="display" style={{
          fontSize: 28, fontWeight: 800, margin: 0, lineHeight: 1,
          color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          {t.label}
        </p>
        <p style={{
          fontSize: 12, fontWeight: 500, margin: '6px 0 0',
          color: 'rgba(255,255,255,0.85)',
        }}>
          {t.range}
        </p>
        {isCurrent && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            padding: '4px 10px', borderRadius: 'var(--r-pill)',
            background: 'var(--gold)', color: '#0E0E0E',
            fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
          }}>
            Current
          </span>
        )}
      </div>

      {/* Center: mascot image */}
      <div style={{
        flex: 1, position: 'relative', zIndex: 2,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        marginTop: 12,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={t.image}
          alt={t.label}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          style={{
            maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
            filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.3))',
          }}
        />
      </div>
    </div>
  )
}
