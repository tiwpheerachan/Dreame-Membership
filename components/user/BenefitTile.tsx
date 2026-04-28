'use client'
import { useState } from 'react'

interface Props {
  image: string
  label: string
  sub: string
}

export default function BenefitTile({ image, label, sub }: Props) {
  const [imgOk, setImgOk] = useState(true)

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: 'var(--r-lg)',
      padding: '18px 14px 16px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      boxShadow: '0 4px 24px rgba(14,14,14,0.06)',
      transition: 'transform 0.18s ease',
    }}>
      {/* Image frame — 1:1 white bg, no visible border */}
      <div style={{
        width: '100%',
        aspectRatio: '1 / 1',
        background: '#FFFFFF',
        borderRadius: 'var(--r-md)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        marginBottom: 12,
      }}>
        {imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={`${label} ${sub}`}
            onError={() => setImgOk(false)}
            style={{
              width: '78%', height: '78%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 12px rgba(14,14,14,0.10))',
            }}
          />
        ) : (
          /* fallback placeholder when image not yet uploaded */
          <div style={{
            width: '70%', height: '70%',
            borderRadius: 'var(--r-md)',
            background: 'linear-gradient(135deg, #F5EBD0, #EADBB1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#7A5A1F', fontSize: 28, fontWeight: 800,
          }}>✦</div>
        )}
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 13, fontWeight: 700, margin: 0, lineHeight: 1.3, color: 'var(--ink)' }}>
          {label}
        </p>
        <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '2px 0 0', fontWeight: 600 }}>
          {sub}
        </p>
      </div>
    </div>
  )
}
