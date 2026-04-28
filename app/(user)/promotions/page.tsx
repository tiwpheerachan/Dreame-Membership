import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sparkles, ArrowUpRight, Tag } from 'lucide-react'
import type { Promotion } from '@/types'

export default async function PromotionsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: promos } = await supabase
    .from('promotions')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: false })
    .order('created_at', { ascending: false })

  const heroPromos = (promos || []).filter((p: Promotion) => p.layout === 'hero')
  const cardPromos = (promos || []).filter((p: Promotion) => p.layout === 'card')
  const feedPromos = (promos || []).filter((p: Promotion) => p.layout === 'feed')

  const isEmpty = (promos || []).length === 0

  return (
    <div className="page-enter" style={{ paddingTop: 18, background: '#fff', minHeight: '100vh' }}>
      <header style={{ padding: '14px 20px 22px' }}>
        <p className="kicker" style={{ marginBottom: 6 }}>Exclusive Offers</p>
        <h1 className="display" style={{ margin: 0, fontSize: 28, lineHeight: 1.05 }}>
          <span style={{ fontWeight: 800 }}>โปรโมชั่น</span>{' '}
          <span className="serif-i" style={{ fontWeight: 400 }}>ทั้งหมด</span>
        </h1>
        {!isEmpty && (
          <p style={{ fontSize: 12, color: 'var(--ink-mute)', margin: '6px 0 0', fontWeight: 500 }}>
            {(promos || []).length} ข้อเสนอพิเศษสำหรับสมาชิก
          </p>
        )}
      </header>

      {isEmpty ? (
        <div style={{ padding: '0 16px' }}>
          <div className="card-product" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '52px 24px', textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, margin: '0 auto 18px',
                borderRadius: '50%', background: 'var(--gold-glow)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--gold-deep)',
              }}>
                <Tag size={26} strokeWidth={1.4} />
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800 }}>
                ยังไม่มีโปรโมชั่น
              </h3>
              <p style={{ fontSize: 12.5, color: 'var(--ink-mute)', margin: 0, lineHeight: 1.6 }}>
                กลับมาดูใหม่เร็ว ๆ นี้ — มีข้อเสนอพิเศษสำหรับสมาชิกเสมอ
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Hero promos — biggest feature */}
          {heroPromos.length > 0 && (
            <section>
              <div style={{ padding: '0 4px 10px' }}>
                <p className="kicker" style={{ margin: '0 0 4px' }}>Featured</p>
                <h2 className="display" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                  ดีลเด่น<span className="gold-text">วันนี้</span>
                </h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {heroPromos.map(p => <BigPromoCard key={p.id} promo={p} />)}
              </div>
            </section>
          )}

          {/* Card promos — 2-col grid */}
          {cardPromos.length > 0 && (
            <section>
              <div style={{ padding: '0 4px 10px' }}>
                <p className="kicker" style={{ margin: '0 0 4px' }}>Special Offers</p>
                <h2 className="display" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                  ข้อเสนอ<span className="gold-text">พิเศษ</span>
                </h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {cardPromos.map(p => <SmallPromoCard key={p.id} promo={p} />)}
              </div>
            </section>
          )}

          {/* Feed promos — vertical full-width */}
          {feedPromos.length > 0 && (
            <section>
              <div style={{ padding: '0 4px 10px' }}>
                <p className="kicker" style={{ margin: '0 0 4px' }}>More Deals</p>
                <h2 className="display" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                  ดีลเพิ่มเติม
                </h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {feedPromos.map(p => <BigPromoCard key={p.id} promo={p} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

// ── Big card with big image + price + CTA ──
function BigPromoCard({ promo }: { promo: Promotion }) {
  const Wrapper = promo.link_url ? 'a' : 'div'
  return (
    <Wrapper
      {...(promo.link_url ? { href: promo.link_url, target: '_blank', rel: 'noopener noreferrer' } : {})}
      style={{
        position: 'relative', overflow: 'hidden',
        background: '#fff',
        border: '1px solid var(--hair)',
        borderRadius: 'var(--r-lg)',
        boxShadow: '0 4px 20px rgba(14,14,14,0.06)',
        textDecoration: 'none', color: 'var(--ink)',
        display: 'block',
      }}
    >
      <div style={{ position: 'relative' }}>
        {promo.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={promo.image_url} alt={promo.title} style={{
            width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block',
          }} />
        ) : (
          <div style={{
            width: '100%', aspectRatio: '16/9',
            background: 'linear-gradient(135deg,var(--gold-glow),var(--gold-pale))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--gold-deep)',
          }}>
            <Sparkles size={32} />
          </div>
        )}
        {promo.badge_text && (
          <span style={{
            position: 'absolute', top: 14, left: 14,
            padding: '6px 14px', borderRadius: 'var(--r-pill)',
            background: 'var(--gold)', color: '#fff',
            fontSize: 10.5, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase',
            boxShadow: '0 4px 12px rgba(160,120,43,0.4)',
          }}>
            {promo.badge_text}
          </span>
        )}
      </div>

      <div style={{ padding: '16px 20px 12px' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, lineHeight: 1.3,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
        }}>
          {promo.title}
        </h3>
        {promo.description && (
          <p style={{ fontSize: 12, color: 'var(--ink-mute)', margin: 0, lineHeight: 1.55,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
          }}>
            {promo.description}
          </p>
        )}
        {(promo.original_price || promo.discounted_price) && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            {promo.original_price ? (
              <span style={{ fontSize: 13, color: 'var(--ink-faint)', textDecoration: 'line-through' }}>
                ฿{Number(promo.original_price).toLocaleString()}
              </span>
            ) : null}
            {promo.discounted_price ? (
              <span className="display tnum" style={{ fontSize: 24, fontWeight: 800, color: 'var(--gold-deep)' }}>
                ฿{Number(promo.discounted_price).toLocaleString()}
              </span>
            ) : null}
            {promo.discount_label && (
              <span className="pill pill-gold">{promo.discount_label}</span>
            )}
          </div>
        )}
      </div>

      {/* Black bottom bar */}
      <div style={{
        background: 'var(--black)',
        padding: '12px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
          ดูรายละเอียด
        </span>
        <ArrowUpRight size={14} color="var(--gold-soft)" />
      </div>
    </Wrapper>
  )
}

// ── Small grid card ──
function SmallPromoCard({ promo }: { promo: Promotion }) {
  const Wrapper = promo.link_url ? 'a' : 'div'
  return (
    <Wrapper
      {...(promo.link_url ? { href: promo.link_url, target: '_blank', rel: 'noopener noreferrer' } : {})}
      style={{
        position: 'relative', overflow: 'hidden',
        background: '#fff',
        border: '1px solid var(--hair)',
        borderRadius: 'var(--r-lg)',
        boxShadow: '0 2px 12px rgba(14,14,14,0.05)',
        textDecoration: 'none', color: 'var(--ink)',
        display: 'block',
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
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--gold-deep)',
          }}>
            <Sparkles size={24} />
          </div>
        )}
        {promo.badge_text && (
          <span style={{
            position: 'absolute', top: 10, left: 10,
            padding: '4px 10px', borderRadius: 'var(--r-pill)',
            background: 'var(--black)', color: '#fff',
            fontSize: 9.5, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase',
          }}>
            {promo.badge_text}
          </span>
        )}
      </div>
      <div style={{ padding: '12px 14px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px', lineHeight: 1.3,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
        }}>
          {promo.title}
        </p>
        {(promo.original_price || promo.discounted_price) && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {promo.original_price ? (
              <span style={{ fontSize: 11, color: 'var(--ink-faint)', textDecoration: 'line-through' }}>
                ฿{Number(promo.original_price).toLocaleString()}
              </span>
            ) : null}
            {promo.discounted_price ? (
              <span className="display tnum" style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold-deep)' }}>
                ฿{Number(promo.discounted_price).toLocaleString()}
              </span>
            ) : null}
          </div>
        )}
      </div>
      <div style={{
        background: 'var(--black)',
        padding: '8px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
          ดูเพิ่ม
        </span>
        <ArrowUpRight size={12} color="var(--gold-soft)" />
      </div>
    </Wrapper>
  )
}
