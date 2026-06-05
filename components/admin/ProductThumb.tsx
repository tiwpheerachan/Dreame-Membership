// ============================================================
// ProductThumb — square thumbnail for purchased product
//
// Tries (in order):
//   1) explicit `src` prop (admin-uploaded image)
//   2) first item image_url inside `bqRaw.items[0].image_url`
//   3) fallback to PlatformLogo (so it's never blank)
//
// Falls back gracefully on broken URLs via onError.
// ============================================================

'use client'
import { useState } from 'react'
import PlatformLogo from './PlatformLogo'

type BQItem = { image_url?: string | null }
type BQ = { items?: BQItem[] | null } | null | undefined

interface Props {
  src?: string | null
  bqRaw?: BQ | Record<string, unknown> | null
  channel: string
  size?: number
  className?: string
}

function pickImage(src: Props['src'], bqRaw: Props['bqRaw']): string | null {
  if (src && src.trim()) return src
  const raw = bqRaw as { items?: BQItem[] } | null | undefined
  const items = raw?.items
  if (Array.isArray(items)) {
    for (const it of items) {
      if (it?.image_url && it.image_url.trim()) return it.image_url
    }
  }
  return null
}

export default function ProductThumb({ src, bqRaw, channel, size = 48, className }: Props) {
  const initial = pickImage(src, bqRaw)
  const [failed, setFailed] = useState(false)
  const imgSrc = !failed ? initial : null

  if (!imgSrc) {
    return (
      <div className={className}
        style={{
          width: size, height: size,
          borderRadius: Math.max(8, Math.round(size * 0.18)),
          background: 'var(--admin-bg)',
          border: '1px solid var(--admin-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
        <PlatformLogo channel={channel} size={Math.round(size * 0.55)} />
      </div>
    )
  }

  return (
    <div className={className}
      style={{
        position: 'relative',
        width: size, height: size,
        borderRadius: Math.max(8, Math.round(size * 0.18)),
        background: '#fff',
        border: '1px solid var(--admin-border)',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgSrc} alt=""
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onError={() => setFailed(true)} />
      {/* tiny platform badge overlay bottom-right */}
      <div style={{
        position: 'absolute',
        bottom: -2, right: -2,
        padding: 2,
        background: '#fff',
        borderRadius: '50%',
        border: '1px solid var(--admin-border)',
        lineHeight: 0,
      }}>
        <PlatformLogo channel={channel} size={Math.max(14, Math.round(size * 0.30))} />
      </div>
    </div>
  )
}
