import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Tag } from 'lucide-react'
import type { Promotion } from '@/types'
import { PromoHero, PromoFeed } from '@/components/user/PromoCard'
import BannerMarquee from '@/components/user/BannerMarquee'

export default async function PromotionsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Bypass RLS for the promotion fetch — public marketing content,
  // server-side render only. Avoids deployment issues when RLS policies
  // aren't applied on the production DB.
  const service = createServiceClient()
  const { data: promos, error: promosErr } = await service
    .from('promotions')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: false })
    .order('created_at', { ascending: false })

  if (promosErr) console.error('[promotions] query failed:', promosErr)

  const heroPromos   = (promos || []).filter((p: Promotion) => p.layout === 'hero')
  const cardPromos   = (promos || []).filter((p: Promotion) => p.layout === 'card')
  const feedPromos   = (promos || []).filter((p: Promotion) => p.layout === 'feed')
  const bannerPromos = (promos || []).filter((p: Promotion) => p.layout === 'banner')

  const isEmpty = (promos || []).length === 0

  return (
    <div className="page-enter" style={{ paddingTop: 18, background: '#fff', minHeight: '100vh' }}>
      <header style={{ padding: '14px 20px 24px' }}>
        <p className="kicker" style={{ marginBottom: 8 }}>Exclusive Offers</p>
        <h1 className="display" style={{ margin: 0, fontSize: 30, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
          <span style={{ fontWeight: 800 }}>โปรโมชั่น</span>{' '}
          <span className="serif-i" style={{ fontWeight: 400 }}>ทั้งหมด</span>
        </h1>
        {!isEmpty && (
          <p className="serif-i" style={{ fontSize: 12, color: 'var(--ink-mute)', margin: '8px 0 0' }}>
            {(promos || []).length} ข้อเสนอพิเศษสำหรับสมาชิก
          </p>
        )}
      </header>

      {isEmpty ? (
        <div style={{ padding: '0 16px' }}>
          <div className="card-product" style={{ overflow: 'hidden', padding: '60px 28px', textAlign: 'center' }}>
            <div style={{
              width: 72, height: 72, margin: '0 auto 18px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg,var(--gold-glow),var(--gold-pale))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--gold-deep)',
              boxShadow: '0 8px 24px rgba(160,120,43,0.15)',
            }}>
              <Tag size={28} strokeWidth={1.4} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 800 }}>
              ยังไม่มี<span className="serif-i" style={{ fontWeight: 400 }}>โปรโมชั่น</span>
            </h3>
            <p className="serif-i" style={{ fontSize: 12.5, color: 'var(--ink-mute)', margin: 0, lineHeight: 1.7, maxWidth: 280, marginInline: 'auto' }}>
              กลับมาดูใหม่เร็ว ๆ นี้ — มีข้อเสนอพิเศษสำหรับสมาชิกเสมอ
            </p>
          </div>
        </div>
      ) : (
        <div style={{ padding: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 28 }}>
          {/* Brand banners — single horizontally-scrolling row, ignores banner_row */}
          {bannerPromos.length > 0 && (
            <section style={{ padding: '0 16px' }}>
              <BannerMarquee banners={bannerPromos} aspect="12/5" speed={50} />
            </section>
          )}

          {/* Hero promos */}
          {heroPromos.length > 0 && (
            <section style={{ padding: '0 16px' }}>
              <SectionHeader kicker="Featured" title="ดีลเด่น" italic="วันนี้" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {heroPromos.map(p => <PromoHero key={p.id} promo={p} />)}
              </div>
            </section>
          )}

          {/* Card promos — 2-col grid (using small-card style but full-width on grid) */}
          {cardPromos.length > 0 && (
            <section style={{ padding: '0 16px' }}>
              <SectionHeader kicker="Special Offers" title="ข้อเสนอ" italic="พิเศษ" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {cardPromos.map(p => <GridCard key={p.id} promo={p} />)}
              </div>
            </section>
          )}

          {/* Feed promos */}
          {feedPromos.length > 0 && (
            <section style={{ padding: '0 16px' }}>
              <SectionHeader kicker="More Deals" title="ดีล" italic="เพิ่มเติม" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {feedPromos.map(p => <PromoFeed key={p.id} promo={p} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function SectionHeader({ kicker, title, italic }: { kicker: string; title: string; italic: string }) {
  return (
    <div style={{ padding: '0 4px 12px' }}>
      <p className="kicker" style={{ margin: '0 0 6px' }}>{kicker}</p>
      <h2 className="display" style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em' }}>
        {title}
        {' '}
        <span className="serif-i" style={{ fontWeight: 400, color: 'var(--gold-deep)' }}>{italic}</span>
      </h2>
    </div>
  )
}

// Grid card: 1:1 square (matches typical Dreame promo image ratio) with
// smooth bottom gradient fade — no boxed glass panel.
function GridCard({ promo }: { promo: Promotion }) {
  const Wrapper = promo.link_url ? 'a' : 'div'
  return (
    <Wrapper
      {...(promo.link_url ? { href: promo.link_url, target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="tap-down"
      style={{
        position: 'relative', display: 'block',
        textDecoration: 'none', color: '#fff',
        borderRadius: 'var(--r-lg)', overflow: 'hidden',
        background: '#000',
        boxShadow: '0 6px 20px rgba(20,18,15,0.08), 0 1px 2px rgba(20,18,15,0.05)',
        aspectRatio: '1/1',
      }}
    >
      {promo.video_url ? (
        <video src={promo.video_url}
          autoPlay muted loop playsInline preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: '#000' }} />
      ) : promo.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={promo.image_url} alt={promo.title} style={{
          width: '100%', height: '100%', objectFit: 'cover', display: 'block',
        }} />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          background: 'linear-gradient(135deg,#1A1815,#3A2E18,#A0782B)',
        }} />
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

      {/* Smooth gradient + masked blur */}
      <div aria-hidden style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '60%',
        background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.18) 35%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.85) 100%)',
        pointerEvents: 'none',
      }} />
      <div aria-hidden style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '60%',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, transparent 30%, black 100%)',
        maskImage:       'linear-gradient(180deg, transparent 0%, transparent 30%, black 100%)',
        pointerEvents: 'none',
      }} />

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
        {promo.discounted_price ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
            {promo.original_price ? (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textDecoration: 'line-through' }}>
                ฿{Number(promo.original_price).toLocaleString()}
              </span>
            ) : null}
            <span className="display tnum" style={{
              fontSize: 14, fontWeight: 800, lineHeight: 1,
              background: 'linear-gradient(135deg,#FAF3DC,#EADBB1,#A0782B)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
            }}>
              ฿{Number(promo.discounted_price).toLocaleString()}
            </span>
          </div>
        ) : null}
      </div>
    </Wrapper>
  )
}
