// ============================================================
// MemberAvatar — circular avatar with tier-colored background
//
// Uses profile_image_url if available, falls back to initials of full_name.
// Background color encodes tier so it doubles as a quick visual signal.
//
// Usage:
//   <MemberAvatar name={user.full_name} src={user.profile_image_url} tier="GOLD" size={36} />
// ============================================================

import type { CSSProperties } from 'react'

const TIER_BG: Record<string, string> = {
  SILVER:   'linear-gradient(135deg, #C9D9E8, #8DA9BC)',
  GOLD:     'linear-gradient(135deg, #F4C28A, #C46B3A)',
  PLATINUM: 'linear-gradient(135deg, #2A2A2A, #1F1F1F)',
  // Legacy
  PLUS:     'linear-gradient(135deg, #C9D9E8, #8DA9BC)',
  PRO:      'linear-gradient(135deg, #F4C28A, #C46B3A)',
  ULTRA:    'linear-gradient(135deg, #2A2A2A, #1F1F1F)',
  MASTER:   'linear-gradient(135deg, #2A2A2A, #1F1F1F)',
}

const TIER_TEXT: Record<string, string> = {
  SILVER:   '#1F3A5A',
  GOLD:     '#FFFFFF',
  PLATINUM: '#E8C58C',
  PLUS:     '#1F3A5A',
  PRO:      '#FFFFFF',
  ULTRA:    '#E8C58C',
  MASTER:   '#E8C58C',
}

interface Props {
  name?: string | null
  src?: string | null
  tier?: string | null
  size?: number
  className?: string
  style?: CSSProperties
}

export default function MemberAvatar({ name, src, tier, size = 36, className, style }: Props) {
  const initials = (name || '?')
    .split(/\s+/)
    .map(s => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const t = (tier || 'SILVER').toUpperCase()
  const bg = TIER_BG[t] || TIER_BG.SILVER
  const color = TIER_TEXT[t] || TIER_TEXT.SILVER

  const fontSize = Math.max(10, Math.round(size * 0.36))
  const radius = Math.round(size * 0.28)

  return (
    <div className={className}
      style={{
        width: size, height: size,
        borderRadius: radius,
        background: bg,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color, fontSize, fontWeight: 700,
        overflow: 'hidden', flexShrink: 0,
        boxShadow: '0 1px 3px rgba(14,14,14,0.10)',
        ...style,
      }}>
      {src
        ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={src} alt={name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )
        : initials || '?'}
    </div>
  )
}
