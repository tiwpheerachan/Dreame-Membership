'use client'
import type { Promotion } from '@/types'
import { ArrowUpRight, Sparkles } from 'lucide-react'

// Render video (preferred) or image — both at the same natural-aspect sizing
// so the surrounding card chrome (badges, gradient overlay) stays identical.
function MediaFill({
  promo, fit = 'contain', forceFixedAspect,
}: {
  promo: Promotion
  fit?: 'contain' | 'cover'
  forceFixedAspect?: string  // when set, host wants fixed aspect (e.g. 4:5 square)
}) {
  const fillStyle: React.CSSProperties = forceFixedAspect
    ? { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }
    : { width: '100%', height: 'auto', objectFit: fit, display: 'block' }
  if (promo.video_url) {
    return (
      <video
        src={promo.video_url}
        autoPlay muted loop playsInline preload="metadata"
        style={{ ...fillStyle, background: '#000' }}
      />
    )
  }
  if (promo.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={promo.image_url} alt={promo.title} style={fillStyle} />
    )
  }
  return null
}

// Common bottom-fade overlay: a smooth gradient that goes from transparent
// at the top to dark + slightly blurred at the bottom. Mask-image fades the
// blur effect in gradually so the top of the image stays crisp.
function BottomFade({ height = '55%' }: { height?: string }) {
  return (
    <>
      {/* Layer 1 — gradient darkening (no blur) */}
      <div aria-hidden style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height,
        background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.18) 35%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.85) 100%)',
        pointerEvents: 'none',
      }} />
      {/* Layer 2 — backdrop-blur masked to fade in from top to bottom.
          Creates the "premium frosted bottom" look without a hard edge. */}
      <div aria-hidden style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        // Mask makes the blur invisible at the top and full strength at bottom
        WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, transparent 30%, black 100%)',
        maskImage:       'linear-gradient(180deg, transparent 0%, transparent 30%, black 100%)',
        pointerEvents: 'none',
      }} />
    </>
  )
}

// ────────────────────────────────────────────────────────────────
// Hero — image at natural aspect ratio with smooth bottom blur fade.
// Text floats over the gradient (no boxed panel).
// ────────────────────────────────────────────────────────────────

export function PromoHero({ promo }: { promo: Promotion }) {
  const Wrapper = promo.link_url ? 'a' : 'div'
  const hasPrice = promo.original_price || promo.discounted_price

  return (
    <Wrapper
      {...(promo.link_url ? { href: promo.link_url, target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="tap-down"
      style={{
        position: 'relative', display: 'block',
        textDecoration: 'none', color: '#fff',
        borderRadius: 'var(--r-lg)', overflow: 'hidden',
        boxShadow: '0 10px 32px rgba(20,18,15,0.10), 0 1px 3px rgba(20,18,15,0.06)',
        background: '#000',
      }}
    >
      {(promo.image_url || promo.video_url) ? (
        <MediaFill promo={promo} fit="contain" />
      ) : (
        <div style={{
          width: '100%', aspectRatio: '16/10',
          background: 'linear-gradient(135deg,#1A1815 0%,#3A2E18 50%,#A0782B 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--gold-soft)',
        }}>
          <Sparkles size={48} strokeWidth={1.2} />
        </div>
      )}

      {promo.badge_text && (
        <span style={{
          position: 'absolute', top: 12, left: 12,
          padding: '5px 11px', borderRadius: 'var(--r-pill)',
          background: 'linear-gradient(135deg,#EADBB1,#A0782B)',
          color: '#1A1815',
          fontSize: 9.5, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase',
          boxShadow: '0 4px 14px rgba(160,120,43,0.45), inset 0 1px 0 rgba(255,250,235,0.6)',
        }}>
          {promo.badge_text}
        </span>
      )}

      {promo.discount_label && (
        <span className="label-glass" style={{
          position: 'absolute', top: 12, right: 12,
          padding: '5px 11px', borderRadius: 'var(--r-pill)',
          color: '#fff',
          fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
          border: '1px solid rgba(255,255,255,0.22)',
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
        }}>
          {promo.discount_label}
        </span>
      )}

      <BottomFade />

      <div style={{
        position: 'absolute', bottom: 14, left: 14, right: 14,
        display: 'flex', alignItems: 'flex-end', gap: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.3,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: hasPrice ? 1 : 2, WebkitBoxOrient: 'vertical' as const,
            textShadow: '0 1px 4px rgba(0,0,0,0.45)',
          }}>
            {promo.title}
          </h3>
          {hasPrice && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              {promo.original_price ? (
                <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', textDecoration: 'line-through' }}>
                  ฿{Number(promo.original_price).toLocaleString()}
                </span>
              ) : null}
              {promo.discounted_price ? (
                <span className="display tnum" style={{
                  fontSize: 19, fontWeight: 800, lineHeight: 1,
                  background: 'linear-gradient(135deg,#FAF3DC,#EADBB1,#A0782B)',
                  WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                  letterSpacing: '-0.01em',
                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))',
                }}>
                  ฿{Number(promo.discounted_price).toLocaleString()}
                </span>
              ) : null}
            </div>
          )}
        </div>
        <span aria-hidden style={{
          flexShrink: 0,
          width: 30, height: 30, borderRadius: '50%',
          background: 'linear-gradient(135deg,#FAF3DC,#A0782B)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#1A1815',
          boxShadow: '0 3px 10px rgba(160,120,43,0.45), inset 0 1px 0 rgba(255,250,235,0.7)',
        }}>
          <ArrowUpRight size={15} strokeWidth={2.4} />
        </span>
      </div>
    </Wrapper>
  )
}

// ────────────────────────────────────────────────────────────────
// Small — for horizontal carousel; uses fixed 4:5 for consistent height
// ────────────────────────────────────────────────────────────────

export function PromoSmall({ promo }: { promo: Promotion }) {
  const Wrapper = promo.link_url ? 'a' : 'div'
  return (
    <Wrapper
      {...(promo.link_url ? { href: promo.link_url, target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="tap-down"
      style={{
        position: 'relative',
        minWidth: 220, maxWidth: 220, flexShrink: 0,
        textDecoration: 'none', color: '#fff',
        scrollSnapAlign: 'start',
        borderRadius: 'var(--r-lg)', overflow: 'hidden',
        background: '#000',
        boxShadow: '0 6px 20px rgba(20,18,15,0.08), 0 1px 2px rgba(20,18,15,0.05)',
        aspectRatio: '4/5',
      }}
    >
      {(promo.image_url || promo.video_url) ? (
        <MediaFill promo={promo} forceFixedAspect="4/5" />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          background: 'linear-gradient(135deg,#1A1815,#3A2E18,#A0782B)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--gold-soft)',
        }}>
          <Sparkles size={32} strokeWidth={1.4} />
        </div>
      )}

      {promo.badge_text && (
        <span style={{
          position: 'absolute', top: 10, left: 10,
          padding: '3px 9px', borderRadius: 'var(--r-pill)',
          background: 'linear-gradient(135deg,#EADBB1,#A0782B)',
          color: '#1A1815',
          fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
          boxShadow: '0 2px 8px rgba(160,120,43,0.35)',
        }}>
          {promo.badge_text}
        </span>
      )}

      <BottomFade height="60%" />

      <div style={{
        position: 'absolute', bottom: 10, left: 11, right: 11,
      }}>
        <p style={{
          margin: 0, fontSize: 12.5, fontWeight: 700, lineHeight: 1.3,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
          textShadow: '0 1px 4px rgba(0,0,0,0.45)',
        }}>
          {promo.title}
        </p>
        {(promo.original_price || promo.discounted_price) && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
            {promo.original_price ? (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textDecoration: 'line-through' }}>
                ฿{Number(promo.original_price).toLocaleString()}
              </span>
            ) : null}
            {promo.discounted_price ? (
              <span className="display tnum" style={{
                fontSize: 14, fontWeight: 800, lineHeight: 1,
                background: 'linear-gradient(135deg,#FAF3DC,#A0782B)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              }}>
                ฿{Number(promo.discounted_price).toLocaleString()}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </Wrapper>
  )
}

// ────────────────────────────────────────────────────────────────
// Feed — image at natural aspect ratio with smooth bottom blur fade.
// ────────────────────────────────────────────────────────────────

export function PromoFeed({ promo }: { promo: Promotion }) {
  const Wrapper = promo.link_url ? 'a' : 'div'
  const hasPrice = promo.original_price || promo.discounted_price

  return (
    <Wrapper
      {...(promo.link_url ? { href: promo.link_url, target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="tap-down"
      style={{
        position: 'relative', display: 'block',
        textDecoration: 'none', color: '#fff',
        borderRadius: 'var(--r-lg)', overflow: 'hidden',
        background: '#000',
        boxShadow: '0 10px 32px rgba(20,18,15,0.10)',
      }}
    >
      {(promo.image_url || promo.video_url) ? (
        <MediaFill promo={promo} fit="contain" />
      ) : (
        <div style={{
          width: '100%', aspectRatio: '4/5',
          background: 'linear-gradient(135deg,#1A1815,#3A2E18,#A0782B)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--gold-soft)',
        }}>
          <Sparkles size={48} strokeWidth={1.2} />
        </div>
      )}

      {promo.badge_text && (
        <span style={{
          position: 'absolute', top: 14, left: 14,
          padding: '5px 12px', borderRadius: 'var(--r-pill)',
          background: 'linear-gradient(135deg,#EADBB1,#A0782B)',
          color: '#1A1815',
          fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase',
          boxShadow: '0 4px 14px rgba(160,120,43,0.45), inset 0 1px 0 rgba(255,250,235,0.6)',
        }}>
          {promo.badge_text}
        </span>
      )}

      {promo.discount_label && (
        <span className="label-glass" style={{
          position: 'absolute', top: 14, right: 14,
          padding: '5px 12px', borderRadius: 'var(--r-pill)',
          color: '#fff',
          fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
          border: '1px solid rgba(255,255,255,0.22)',
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
        }}>
          {promo.discount_label}
        </span>
      )}

      <BottomFade />

      <div style={{
        position: 'absolute', bottom: 14, left: 14, right: 14,
        display: 'flex', alignItems: 'flex-end', gap: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.3,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: hasPrice ? 1 : 2, WebkitBoxOrient: 'vertical' as const,
            textShadow: '0 1px 4px rgba(0,0,0,0.45)',
          }}>
            {promo.title}
          </h3>
          {hasPrice && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              {promo.original_price ? (
                <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', textDecoration: 'line-through' }}>
                  ฿{Number(promo.original_price).toLocaleString()}
                </span>
              ) : null}
              {promo.discounted_price ? (
                <span className="display tnum" style={{
                  fontSize: 19, fontWeight: 800, lineHeight: 1,
                  background: 'linear-gradient(135deg,#FAF3DC,#EADBB1,#A0782B)',
                  WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))',
                }}>
                  ฿{Number(promo.discounted_price).toLocaleString()}
                </span>
              ) : null}
            </div>
          )}
        </div>
        <span aria-hidden style={{
          flexShrink: 0,
          width: 30, height: 30, borderRadius: '50%',
          background: 'linear-gradient(135deg,#FAF3DC,#A0782B)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#1A1815',
          boxShadow: '0 3px 10px rgba(160,120,43,0.45), inset 0 1px 0 rgba(255,250,235,0.7)',
        }}>
          <ArrowUpRight size={15} strokeWidth={2.4} />
        </span>
      </div>
    </Wrapper>
  )
}
