// ============================================================
// PlatformLogo — official brand marks for sales channels
//
// Strategy:
//   • Shopee / Lazada / TikTok → simpleicons.org CDN (official SVGs,
//     brand-color-tinted, no API key, used by Vercel/GitHub in prod)
//   • Website (Dreame storefront) → bundled /website-logo.png (square "D" mark)
//   • Store / OTHER → Lucide icon on tier-tinted square
//
// All marks rendered with rounded square plate so list rows stay tidy
// even when brand SVG has its own background. `<img>` fallback handled
// via onError swap to lucide icon.
// ============================================================

'use client'
import { useState, type CSSProperties } from 'react'
import { Globe, Store, Building2 } from 'lucide-react'

type Channel = 'SHOPEE' | 'LAZADA' | 'TIKTOK' | 'WEBSITE' | 'BRANDSHOP' | 'STORE' | 'OTHER' | string

const LABELS: Record<string, string> = {
  SHOPEE:    'Shopee',
  LAZADA:    'Lazada',
  TIKTOK:    'TikTok',
  WEBSITE:   'Website',
  BRANDSHOP: 'Brand Shop',
  STORE:     'หน้าร้าน',
  OTHER:     'อื่นๆ',
}

// Brand metadata
const BRAND: Record<string, { color: string; bg: string; logo?: string; logoColor?: string }> = {
  SHOPEE:    { color: '#EE4D2D', bg: '#FFF4F1', logo: 'shopee',  logoColor: 'EE4D2D' },
  LAZADA:    { color: '#0F146D', bg: '#EEEEF6', logo: 'lazada',  logoColor: '0F146D' },
  TIKTOK:    { color: '#000000', bg: '#F4F4F4', logo: 'tiktok',  logoColor: '000000' },
  WEBSITE:   { color: '#A0782B', bg: '#F8F2E5' },  // Dreame brand
  BRANDSHOP: { color: '#9A6E1F', bg: '#F6EFDC' },  // Dreame Brand Shop (official retail)
  STORE:     { color: '#6B5A48', bg: '#F3EBDB' },
  OTHER:     { color: '#A0907A', bg: '#F3EBDB' },
}

interface Props {
  channel: Channel
  size?: number
  withLabel?: boolean
  className?: string
  style?: CSSProperties
}

function BrandImage({ slug, color, alt, size }: {
  slug: string; color: string; alt: string; size: number
}) {
  const [failed, setFailed] = useState(false)
  const url = `https://cdn.simpleicons.org/${slug}/${color}`
  if (failed) {
    return (
      <span style={{
        fontSize: Math.round(size * 0.5),
        fontWeight: 800,
        color: `#${color}`,
      }}>{slug[0].toUpperCase()}</span>
    )
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={url} alt={alt} width={size} height={size}
      style={{ width: size, height: size, objectFit: 'contain' }}
      onError={() => setFailed(true)} />
  )
}

export default function PlatformLogo({ channel, size = 20, withLabel, className, style }: Props) {
  const c = (channel || '').toUpperCase()
  const label = LABELS[c] || channel
  const brand = BRAND[c] || BRAND.OTHER
  const innerSize = Math.round(size * 0.7)

  let inner: React.ReactNode
  if (brand.logo) {
    inner = <BrandImage slug={brand.logo} color={brand.logoColor!} alt={label} size={innerSize} />
  } else if (c === 'WEBSITE') {
    // Dreame storefront — square "D" brand mark (th.dreametech.com favicon),
    // fits the square plate cleanly (the old wide wordmark got squished)
    inner = (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src="/website-logo.png" alt="Dreame"
        style={{ width: '78%', height: '78%', objectFit: 'contain' }} />
    )
  } else if (c === 'BRANDSHOP') {
    inner = <Building2 size={innerSize} strokeWidth={1.8} style={{ color: brand.color }} />
  } else if (c === 'STORE') {
    inner = <Store size={innerSize} strokeWidth={1.8} style={{ color: brand.color }} />
  } else {
    inner = <Globe size={innerSize} strokeWidth={1.8} style={{ color: brand.color }} />
  }

  const plate = (
    <span
      className={className}
      style={{
        width: size, height: size, borderRadius: Math.max(6, Math.round(size * 0.22)),
        background: brand.bg,
        border: '1px solid rgba(14,14,14,0.06)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, overflow: 'hidden',
        verticalAlign: 'middle',
        ...style,
      }}
      title={label}>
      {inner}
    </span>
  )

  if (!withLabel) return plate

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, ...style }}>
      {plate}
      <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
    </span>
  )
}

export { LABELS as CHANNEL_LABELS, BRAND as CHANNEL_BRAND }
