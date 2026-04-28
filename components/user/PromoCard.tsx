'use client'
import type { Promotion } from '@/types'
import { ArrowUpRight } from 'lucide-react'

export function PromoHero({ promo }: { promo: Promotion }) {
  const Wrapper = promo.link_url ? 'a' : 'div'
  return (
    <Wrapper
      {...(promo.link_url ? { href: promo.link_url, target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="card-product tap"
      style={{
        display: 'block', textDecoration: 'none', color: 'var(--ink)',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'relative' }}>
        {promo.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={promo.image_url} alt={promo.title} style={{
            width: '100%', aspectRatio: '2/1', objectFit: 'cover', display: 'block',
          }} />
        ) : (
          <div style={{
            width: '100%', aspectRatio: '2/1',
            background: 'linear-gradient(135deg,var(--gold-glow),var(--gold-pale))',
          }} />
        )}
        {promo.badge_text && (
          <span style={{
            position: 'absolute', top: 12, left: 12,
            padding: '5px 12px', borderRadius: 'var(--r-pill)',
            background: 'var(--gold)', color: '#fff',
            fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase',
          }}>
            {promo.badge_text}
          </span>
        )}
      </div>
      <div style={{ padding: '14px 18px 8px' }}>
        <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', lineHeight: 1.3,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
          {promo.title}
        </p>
        {promo.description && (
          <p style={{ fontSize: 12, color: 'var(--ink-mute)', margin: 0, lineHeight: 1.5,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
            {promo.description}
          </p>
        )}
        {(promo.original_price || promo.discounted_price) && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10 }}>
            {promo.original_price ? (
              <span style={{ fontSize: 13, color: 'var(--ink-faint)', textDecoration: 'line-through' }}>
                ฿{Number(promo.original_price).toLocaleString()}
              </span>
            ) : null}
            {promo.discounted_price ? (
              <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--gold-deep)' }} className="display tnum">
                ฿{Number(promo.discounted_price).toLocaleString()}
              </span>
            ) : null}
          </div>
        )}
      </div>
      {/* Black bottom bar — Dreame website pattern */}
      <div className="bottom-bar">
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.05em' }}>
          {promo.discount_label || 'ข้อเสนอพิเศษ'}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--gold-soft)' }}>
          {promo.discounted_price ? `เหลือเพียง ฿${Number(promo.discounted_price).toLocaleString()}` : 'ดูเพิ่มเติม'}
          <ArrowUpRight size={12} />
        </span>
      </div>
    </Wrapper>
  )
}

export function PromoSmall({ promo }: { promo: Promotion }) {
  const Wrapper = promo.link_url ? 'a' : 'div'
  return (
    <Wrapper
      {...(promo.link_url ? { href: promo.link_url, target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="card-product tap"
      style={{
        minWidth: 260, maxWidth: 260, flexShrink: 0,
        textDecoration: 'none', color: 'var(--ink)',
        scrollSnapAlign: 'start',
      }}
    >
      <div style={{ position: 'relative' }}>
        {promo.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={promo.image_url} alt={promo.title} style={{
            width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block',
          }} />
        ) : (
          <div style={{
            width: '100%', aspectRatio: '4/3',
            background: 'linear-gradient(135deg,var(--gold-glow),var(--gold-pale))',
          }} />
        )}
        {promo.badge_text && (
          <span style={{
            position: 'absolute', top: 10, left: 10,
            padding: '4px 10px', borderRadius: 'var(--r-pill)',
            background: 'var(--black)', color: '#fff',
            fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
          }}>
            {promo.badge_text}
          </span>
        )}
      </div>
      <div style={{ padding: '12px 14px' }}>
        <p style={{ fontSize: 13.5, fontWeight: 700, margin: '0 0 4px', lineHeight: 1.3,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
          {promo.title}
        </p>
        {(promo.original_price || promo.discounted_price) && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
            {promo.original_price ? (
              <span style={{ fontSize: 11, color: 'var(--ink-faint)', textDecoration: 'line-through' }}>
                ฿{Number(promo.original_price).toLocaleString()}
              </span>
            ) : null}
            {promo.discounted_price ? (
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold-deep)' }} className="display tnum">
                ฿{Number(promo.discounted_price).toLocaleString()}
              </span>
            ) : null}
          </div>
        )}
      </div>
      <div className="bottom-bar" style={{ padding: '10px 14px' }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
          เหลือเพียง
        </span>
        <span className="display tnum" style={{ fontSize: 14, color: 'var(--gold-soft)' }}>
          ฿{Number(promo.discounted_price || 0).toLocaleString()}
        </span>
      </div>
    </Wrapper>
  )
}

export function PromoFeed({ promo }: { promo: Promotion }) {
  const Wrapper = promo.link_url ? 'a' : 'div'
  return (
    <Wrapper
      {...(promo.link_url ? { href: promo.link_url, target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="card-product tap"
      style={{ display: 'block', textDecoration: 'none', color: 'var(--ink)' }}
    >
      <div style={{ position: 'relative' }}>
        {promo.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={promo.image_url} alt={promo.title} style={{
            width: '100%', aspectRatio: '4/5', objectFit: 'cover', display: 'block',
          }} />
        ) : (
          <div style={{
            width: '100%', aspectRatio: '4/5',
            background: 'linear-gradient(135deg,var(--gold-glow),var(--gold-pale))',
          }} />
        )}
        {promo.badge_text && (
          <span style={{
            position: 'absolute', top: 14, left: 14,
            padding: '6px 12px', borderRadius: 'var(--r-pill)',
            background: 'var(--gold)', color: '#fff',
            fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase',
          }}>
            {promo.badge_text}
          </span>
        )}
      </div>
      <div style={{ padding: '16px 20px 8px' }}>
        <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px', lineHeight: 1.3 }}>
          {promo.title}
        </p>
        {promo.description && (
          <p style={{ fontSize: 12.5, color: 'var(--ink-mute)', margin: 0, lineHeight: 1.6 }}>
            {promo.description}
          </p>
        )}
        {(promo.original_price || promo.discounted_price) && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 12 }}>
            {promo.original_price ? (
              <span style={{ fontSize: 13, color: 'var(--ink-faint)', textDecoration: 'line-through' }}>
                ฿{Number(promo.original_price).toLocaleString()}
              </span>
            ) : null}
            {promo.discounted_price ? (
              <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--gold-deep)' }} className="display tnum">
                ฿{Number(promo.discounted_price).toLocaleString()}
              </span>
            ) : null}
            {promo.discount_label && (
              <span className="pill pill-gold">{promo.discount_label}</span>
            )}
          </div>
        )}
      </div>
      <div className="bottom-bar">
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.05em' }}>
          ดูรายละเอียด
        </span>
        <ArrowUpRight size={14} color="var(--gold-soft)" />
      </div>
    </Wrapper>
  )
}
