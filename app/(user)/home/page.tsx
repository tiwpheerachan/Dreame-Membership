import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Bell, Plus, ShieldCheck, Ticket, Gift, Package,
  ChevronRight, TrendingUp, Sparkles, Award, ArrowRight,
} from 'lucide-react'
import type { User, PurchaseRegistration, Promotion, UserTier } from '@/types'
import dynamic from 'next/dynamic'
const MemberCard = dynamic(() => import('@/components/user/MemberCard'), { ssr: false })
import { PromoHero, PromoSmall, PromoFeed } from '@/components/user/PromoCard'
import BannerMarquee from '@/components/user/BannerMarquee'
import TechStatCard from '@/components/user/TechStatCard'
import { formatDate } from '@/lib/utils'
import { getNextTierInfo } from '@/lib/points'

function StatusPill({ status }: { status: string }) {
  if (status === 'ADMIN_APPROVED' || status === 'BQ_VERIFIED')
    return <span className="pill pill-green">Verified</span>
  if (status === 'PENDING')
    return <span className="pill pill-amber">Pending</span>
  if (status === 'REJECTED')
    return <span className="pill pill-red">Rejected</span>
  return <span className="pill">{status}</span>
}

export default async function HomePage() {
  const supabase = createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: user }, { data: purchases }, { data: promos }] = await Promise.all([
    supabase.from('users').select('*').eq('id', authUser.id).maybeSingle(),
    supabase.from('purchase_registrations').select('*').eq('user_id', authUser.id)
      .order('created_at', { ascending: false }).limit(3),
    // Fetch all active promos; filter by show_on_home in JS so the query
    // still works even if the column hasn't been added to the DB yet.
    supabase.from('promotions').select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: false })
      .order('created_at', { ascending: false }).limit(20),
  ])
  if (!user) redirect('/terms')

  // Normalize any tier value (legacy PLUS/PRO/ULTRA/MASTER) to the current
  // 3-tier system: SILVER / GOLD / PLATINUM.
  function normalize(t: string): UserTier {
    const u = (t || '').toUpperCase()
    if (u === 'SILVER' || u === 'PLUS')   return 'SILVER'
    if (u === 'GOLD'   || u === 'PRO')    return 'GOLD'
    if (u === 'PLATINUM' || u === 'ULTRA' || u === 'MASTER') return 'PLATINUM'
    return 'SILVER'
  }
  const userTier = normalize(user.tier as string)
  const tierInfo = getNextTierInfo(userTier, user.lifetime_points)
  const initials = (user.full_name || 'D').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const firstName = (user.full_name || 'สมาชิก').split(' ')[0]
  const greet = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'สวัสดีตอนเช้า'
    if (h < 17) return 'สวัสดีตอนบ่าย'
    return 'สวัสดีตอนเย็น'
  })()

  // show_on_home defaults to true if undefined (column doesn't exist yet)
  const homePromos = (promos || []).filter((p: Promotion) =>
    p.show_on_home === undefined || p.show_on_home === null || p.show_on_home === true
  )
  const heroPromo    = homePromos.find((p: Promotion) => p.layout === 'hero')
  const cardPromos   = homePromos.filter((p: Promotion) => p.layout === 'card')
  const feedPromos   = homePromos.filter((p: Promotion) => p.layout === 'feed')
  const bannerPromos = homePromos.filter((p: Promotion) => p.layout === 'banner')
  // Split into 2 marquee rows. Default unset/null/1 to row 1.
  const bannerRow1 = bannerPromos.filter(p => (p.banner_row ?? 1) === 1)
  const bannerRow2 = bannerPromos.filter(p => p.banner_row === 2)

  // capitalised tier label for "Your Tier" badge
  const tierLabel = userTier.charAt(0) + userTier.slice(1).toLowerCase()

  // Tier-aware light hero palette. Each tier gets a soft tinted background
  // matching its card so the stage feels coherent. Topbar text colour adapts.
  const HERO = {
    SILVER: {
      bg: 'radial-gradient(ellipse at top, #F1F5FA 0%, #E2E8F2 45%, #DDD0E5 100%)',
      glow: 'radial-gradient(circle, rgba(120,140,200,0.30) 0%, transparent 65%)',
      ink: '#1B2333',
      sub: 'rgba(27,35,51,0.55)',
      starColor: '#7B8AB8',
    },
    GOLD: {
      bg: 'radial-gradient(ellipse at top, #FFF1DD 0%, #FFE0C2 45%, #F8D2A5 100%)',
      glow: 'radial-gradient(circle, rgba(255,166,77,0.32) 0%, transparent 65%)',
      ink: '#3A2410',
      sub: 'rgba(58,36,16,0.55)',
      starColor: '#FF8A3D',
    },
    PLATINUM: {
      bg: 'radial-gradient(ellipse at top, #DCFAF3 0%, #B5F0E2 45%, #7DD8C5 100%)',
      glow: 'radial-gradient(circle, rgba(20,184,166,0.30) 0%, transparent 65%)',
      ink: '#053C36',
      sub: 'rgba(5,60,54,0.55)',
      starColor: '#0E9488',
    },
  } as const
  const hero = HERO[userTier]

  return (
    <div className="page-enter" style={{ paddingTop: 0 }}>
      {/* ============================================================
          LIGHT HERO — tier-tinted gradient with sparkles + shooting stars
      ============================================================ */}
      <div style={{
        position: 'relative',
        background: hero.bg,
        paddingTop: 18, paddingBottom: 60,
        overflow: 'hidden',
      }}>
        {/* aurora blobs (slow background drift) */}
        <div aria-hidden className="aurora" style={{
          top: '-10%', left: '-15%', width: 260, height: 260,
          background: hero.starColor, opacity: 0.18,
          animationDelay: '0s',
        }} />
        <div aria-hidden className="aurora" style={{
          bottom: '-12%', right: '-18%', width: 320, height: 320,
          background: hero.starColor, opacity: 0.14,
          animationDelay: '4s',
        }} />

        {/* faint tech grid for "futuristic" feel */}
        <div aria-hidden className="tech-grid" />

        {/* tier-tinted radial glow behind card */}
        <div aria-hidden style={{
          position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 380, height: 380, borderRadius: '50%',
          background: hero.glow,
          pointerEvents: 'none',
          filter: 'blur(8px)',
        }} />

        {/* concentric pulse rings around the card */}
        {[0, 1.5, 3].map((delay, i) => (
          <div key={`ring-${i}`} aria-hidden className="pulse-ring" style={{
            top: '50%', left: '50%',
            width: 280, height: 280,
            transform: 'translate(-50%, -50%)',
            border: `1.5px solid ${hero.starColor}`,
            opacity: 0.4,
            animationDelay: `${delay}s`,
          }} />
        ))}

        {/* dense twinkle dots — 18 across the hero, mixed tier + white */}
        {[
          { top: '8%',  left: '6%',  size: 3,   delay: '0s',   tone: hero.starColor },
          { top: '12%', left: '24%', size: 2,   delay: '1.2s', tone: '#fff' },
          { top: '14%', left: '46%', size: 4,   delay: '0.4s', tone: hero.starColor },
          { top: '18%', left: '72%', size: 2.5, delay: '2.1s', tone: '#fff' },
          { top: '20%', left: '90%', size: 3,   delay: '0.8s', tone: hero.starColor },
          { top: '32%', left: '14%', size: 2,   delay: '1.7s', tone: '#fff' },
          { top: '34%', left: '38%', size: 1.5, delay: '0.6s', tone: hero.starColor },
          { top: '38%', left: '88%', size: 5,   delay: '0.0s', tone: hero.starColor },
          { top: '46%', left: '4%',  size: 2.5, delay: '1.4s', tone: '#fff' },
          { top: '52%', left: '94%', size: 2,   delay: '2.4s', tone: '#fff' },
          { top: '58%', left: '8%',  size: 3,   delay: '0.9s', tone: hero.starColor },
          { top: '64%', left: '76%', size: 2,   delay: '1.9s', tone: hero.starColor },
          { top: '70%', left: '20%', size: 4,   delay: '0.3s', tone: hero.starColor },
          { top: '74%', left: '50%', size: 1.5, delay: '2.7s', tone: '#fff' },
          { top: '78%', left: '88%', size: 3.5, delay: '1.1s', tone: '#fff' },
          { top: '84%', left: '12%', size: 2,   delay: '2.0s', tone: '#fff' },
          { top: '88%', left: '60%', size: 3,   delay: '0.5s', tone: hero.starColor },
          { top: '92%', left: '38%', size: 2,   delay: '1.5s', tone: hero.starColor },
        ].map((s, i) => (
          <span key={`tw-${i}`} aria-hidden className="twinkle" style={{
            top: s.top, left: s.left,
            width: s.size, height: s.size,
            background: `radial-gradient(circle, ${s.tone} 0%, transparent 70%)`,
            boxShadow: `0 0 ${s.size * 4}px ${s.tone}`,
            animationDelay: s.delay,
            animationDuration: `${2.4 + (i % 4) * 0.6}s`,
          }} />
        ))}

        {/* cross-shaped sparkle bursts — sharper, ray-like */}
        {[
          { top: '16%', left: '18%', delay: '0s',   color: hero.starColor },
          { top: '40%', left: '92%', delay: '1.4s', color: '#fff' },
          { top: '66%', left: '10%', delay: '2.2s', color: hero.starColor },
          { top: '82%', left: '70%', delay: '0.6s', color: '#fff' },
          { top: '28%', left: '50%', delay: '1.8s', color: hero.starColor },
        ].map((s, i) => (
          <span key={`cr-${i}`} aria-hidden className="spark-cross" style={{
            top: s.top, left: s.left,
            color: s.color,
            animationDelay: s.delay,
          }} />
        ))}

        {/* drifting particles (rise upward with slight sway) */}
        {[
          { top: '88%', left: '12%', size: 3, delay: '0s',   tone: hero.starColor },
          { top: '90%', left: '36%', size: 2, delay: '2s',   tone: '#fff' },
          { top: '85%', left: '60%', size: 4, delay: '4s',   tone: hero.starColor },
          { top: '92%', left: '78%', size: 2, delay: '1s',   tone: '#fff' },
          { top: '86%', left: '92%', size: 3, delay: '3.5s', tone: hero.starColor },
        ].map((s, i) => (
          <span key={`dr-${i}`} aria-hidden className="drift" style={{
            top: s.top, left: s.left,
            width: s.size, height: s.size,
            background: s.tone,
            boxShadow: `0 0 ${s.size * 4}px ${s.tone}`,
            animationDelay: s.delay,
          }} />
        ))}

        {/* ambient star glyphs (✦) — multiple sizes/positions */}
        {[
          { top: '14%', left: '12%', size: 14, delay: '0s',   opacity: 0.75 },
          { top: '20%', left: '78%', size: 10, delay: '0.7s', opacity: 0.55 },
          { top: '54%', left: '94%', size: 12, delay: '1.4s', opacity: 0.6 },
          { top: '76%', left: '6%',  size: 16, delay: '2.1s', opacity: 0.7 },
          { top: '82%', left: '44%', size: 11, delay: '1.0s', opacity: 0.55 },
          { top: '40%', left: '8%',  size: 9,  delay: '2.8s', opacity: 0.5 },
        ].map((s, i) => (
          <span key={`gl-${i}`} aria-hidden style={{
            position: 'absolute', top: s.top, left: s.left,
            fontSize: s.size, color: hero.starColor, opacity: s.opacity,
            animation: `sparkle-spin ${3.2 + (i % 3) * 0.6}s ease-in-out ${s.delay} infinite`,
            textShadow: `0 0 8px ${hero.starColor}`,
          }}>✦</span>
        ))}

        {/* shooting stars — 5 across, varied speeds + angles */}
        <span aria-hidden className="shooting-star" style={{ top: '6%',  left: '-10%', animationDelay: '0s',   animationDuration: '5.5s' }} />
        <span aria-hidden className="shooting-star" style={{ top: '24%', left: '-15%', animationDelay: '1.8s', animationDuration: '6.5s' }} />
        <span aria-hidden className="shooting-star" style={{ top: '46%', left: '-8%',  animationDelay: '3.4s', animationDuration: '5s'   }} />
        <span aria-hidden className="shooting-star" style={{ top: '62%', left: '-12%', animationDelay: '5.2s', animationDuration: '7s'   }} />
        <span aria-hidden className="shooting-star" style={{ top: '78%', left: '-6%',  animationDelay: '7s',   animationDuration: '5.8s' }} />

        {/* Topbar */}
        <header style={{
          position: 'relative', zIndex: 2,
          padding: '14px 20px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <p style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: hero.sub, margin: '0 0 6px',
            }}>{greet}</p>
            <h1 className="display" style={{
              margin: 0, fontSize: 26, lineHeight: 1.05,
              color: hero.ink,
            }}>
              {firstName}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/notifications" aria-label="Notifications" className="tap" style={{
              width: 42, height: 42, borderRadius: '50%',
              background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: hero.ink, cursor: 'pointer', position: 'relative',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              textDecoration: 'none',
            }}>
              <Bell size={16} strokeWidth={1.7} />
              <span className="pulse-dot" style={{
                position: 'absolute', top: 10, right: 10,
                width: 6, height: 6, borderRadius: '50%', background: hero.starColor,
              }} />
            </Link>
            <Link href="/profile" className="tap" style={{ display: 'block' }}>
              {user.profile_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.profile_image_url} alt="" style={{
                  width: 42, height: 42, borderRadius: '50%', objectFit: 'cover',
                  border: '1px solid rgba(212,185,120,0.4)',
                }} />
              ) : (
                <div style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#C9A85A,#A0782B)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 800, fontSize: 12,
                }}>{initials}</div>
              )}
            </Link>
          </div>
        </header>

        {/* Member card with 3D + sparkles + wake/sway animation */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div className="card-mount">
            <MemberCard user={user as User} />
          </div>
        </div>
      </div>

      {/* ============================================================
          LIGHT SHEET — curved over the dark hero, all content below
      ============================================================ */}
      <div style={{
        position: 'relative',
        background: '#fff',
        borderRadius: '28px 28px 0 0',
        marginTop: -32,
        paddingTop: 18,
        zIndex: 3,
        boxShadow: '0 -8px 32px rgba(14,14,14,0.08)',
      }}>
        {/* sheet handle */}
        <div aria-hidden style={{
          width: 36, height: 4, background: 'var(--ink-ghost)',
          borderRadius: 'var(--r-pill)', margin: '0 auto 10px',
        }} />

      {/* ─── Stats strip — 3 pill cards with solid pastel backgrounds ─── */}
      <section style={{ padding: '8px 16px 10px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
        }}>
          {/* POINTS — soft sky blue */}
          <TechStatCard
            label="POINTS" subLabel="available"
            value={user.total_points.toLocaleString()}
            bgColor="#C2DBF5"
          />

          {/* LIFETIME — warm light gray */}
          <TechStatCard
            label="LIFETIME" subLabel="all-time"
            value={user.lifetime_points.toLocaleString()}
            bgColor="#D8D4CD"
          />

          {/* TIER — warm yellow */}
          <TechStatCard
            label="TIER" subLabel="level"
            value={tierLabel}
            bgColor="#FFDB71"
          />
        </div>
      </section>

      {/* ─── Tier progress — orange-dashed pill card with trophy + gradient bar ─── */}
      {tierInfo.nextTier && (() => {
        const nextLabel = tierInfo.nextTier.charAt(0) + tierInfo.nextTier.slice(1).toLowerCase()
        return (
          <section style={{ padding: '4px 16px 12px' }}>
            <div style={{
              background: '#fff',
              border: '2px dashed #FFB04C',
              borderRadius: 24,
              padding: '14px 18px 13px',
            }}>
              {/* Top row — trophy + tier transition + percent */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 11, gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/trophy.png" alt=""
                    style={{ width: 38, height: 38, objectFit: 'contain', flexShrink: 0 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 800 }}>
                    <span style={{ color: '#0E0E0E' }}>{tierLabel}</span>
                    <span style={{ color: '#0E0E0E', fontSize: 16 }}>→</span>
                    <span style={{ color: '#5DADE2' }}>{nextLabel}</span>
                  </div>
                </div>
                <div className="tnum" style={{ fontSize: 18, fontWeight: 800, color: '#FF8A3D', flexShrink: 0 }}>
                  {tierInfo.progress}%
                </div>
              </div>

              {/* Bar — yellow → orange gradient on grey track */}
              <div style={{
                position: 'relative',
                height: 8, background: '#E0E0E0',
                borderRadius: 999, overflow: 'hidden',
              }}>
                <div style={{
                  position: 'relative',
                  height: '100%', width: `${tierInfo.progress}%`,
                  background: 'linear-gradient(90deg, #FFD43B 0%, #FF8A3D 100%)',
                  borderRadius: 999,
                  transition: 'width 1s cubic-bezier(0.34,1.1,0.64,1)',
                }} />
              </div>

              {/* Bottom — start (orange), "อีก X pts" dashed pill, end (black) */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: 11,
              }}>
                <span className="tnum" style={{ fontSize: 13, fontWeight: 700 }}>
                  <span style={{ color: '#FF8A3D' }}>{user.lifetime_points.toLocaleString()}</span>{' '}
                  <span style={{ color: '#0E0E0E' }}>pts</span>
                </span>
                <span style={{
                  display: 'inline-flex', alignItems: 'baseline', gap: 5,
                  padding: '4px 14px', borderRadius: 999,
                  background: '#FFE5C0',
                  border: '1.5px dashed #FF8A3D',
                  fontSize: 13, fontWeight: 700,
                }}>
                  <span style={{ color: '#FF8A3D' }}>อีก</span>
                  <span className="tnum" style={{ color: '#FF8A3D', fontWeight: 800 }}>
                    {tierInfo.pointsNeeded.toLocaleString()}
                  </span>
                  <span style={{ color: '#FF8A3D' }}>pts</span>
                </span>
                <span className="tnum" style={{ fontSize: 13, fontWeight: 700, color: '#0E0E0E' }}>
                  {tierInfo.toPoints.toLocaleString()}{' '}
                  <span style={{ color: '#5C5C5C' }}>pts</span>
                </span>
              </div>
            </div>
          </section>
        )
      })()}

      {/* ─── Quick Actions: simple 4-icon row ─── */}
      <section style={{ padding: '4px 16px 8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[
            { href: '/purchases/register', Icon: Plus,        label: 'ลงทะเบียน', accent: true  },
            { href: '/purchases',          Icon: ShieldCheck, label: 'ประกัน' },
            { href: '/coupons',            Icon: Ticket,      label: 'คูปอง' },
            { href: '/points',             Icon: Gift,        label: 'แลกของ' },
          ].map(a => (
            <Link key={a.href} href={a.href} className="tap" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              textDecoration: 'none',
              padding: '10px 4px',
              borderRadius: 'var(--r-md)',
              background: 'transparent',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 'var(--r-md)',
                background: a.accent ? 'var(--black)' : '#fff',
                border: a.accent ? 'none' : '1px solid var(--line)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: a.accent ? 'var(--gold-soft)' : 'var(--ink)',
                boxShadow: a.accent ? '0 4px 14px rgba(14,14,14,0.15)' : 'none',
              }}>
                <a.Icon size={20} strokeWidth={1.8} />
              </div>
              <p style={{ fontSize: 11, fontWeight: 600, margin: 0, color: 'var(--ink-soft)' }}>
                {a.label}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── BRAND BANNERS — 2 horizontally-scrolling marquee rows ─── */}
      {(bannerRow1.length > 0 || bannerRow2.length > 0) && (
        <section style={{ padding: '14px 16px 4px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {bannerRow1.length > 0 && (
            <BannerMarquee banners={bannerRow1} aspect="12/5" speed={50} />
          )}
          {bannerRow2.length > 0 && (
            <BannerMarquee banners={bannerRow2} aspect="12/5" speed={55} />
          )}
        </section>
      )}

      {/* ─── HERO PROMOTION ─── */}
      {heroPromo && (
        <section style={{ padding: '20px 16px 8px' }}>
          <PromoHero promo={heroPromo} />
        </section>
      )}

      {/* ─── Tiers and Perks ─── */}
      <section style={{ padding: '28px 16px 16px' }}>
        <div style={{ padding: '0 4px 14px', textAlign: 'center' }}>
          <p className="kicker" style={{ margin: '0 0 8px' }}>Membership Tiers</p>
          <h2 className="display" style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800 }}>
            Tiers and <span className="gold-text">Perks</span>
          </h2>
          <p style={{ fontSize: 12, color: 'var(--ink-mute)', margin: '0 0 6px', lineHeight: 1.6 }}>
            สะสมคะแนนเพื่อก้าวสู่ระดับที่สูงขึ้น และรับสิทธิประโยชน์มากขึ้น
          </p>
          <span className="pill pill-ink" style={{ marginTop: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              Your Tier
            </span>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--gold-soft)', marginLeft: 4 }}>
              {tierLabel}
            </span>
          </span>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/tiers/tiers-all.png"
          alt="Tiers and Perks: Silver, Gold, Platinum"
          style={{
            width: '100%', height: 'auto',
            display: 'block',
            borderRadius: 'var(--r-lg)',
          }}
        />
      </section>

      {/* ─── VIP Treatments / Benefits ─── */}
      <section style={{ padding: '12px 16px 8px' }}>
        <div style={{ padding: '0 4px 14px', textAlign: 'center' }}>
          <p className="kicker" style={{ margin: '0 0 6px' }}>What you get</p>
          <h2 className="display" style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
            Your VIP <span className="gold-text">Treatments</span>
          </h2>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/benefits/vip-treatments.png"
          alt="Your VIP Treatments"
          style={{
            width: '100%', height: 'auto',
            display: 'block',
            borderRadius: 'var(--r-lg)',
          }}
        />
      </section>

      {/* ─── Card promotions carousel ─── */}
      {cardPromos.length > 0 && (
        <section style={{ padding: '24px 0 8px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 16px 14px 4px' }}>
            <h2 className="display" style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
              ข้อเสนอ<span className="gold-text">พิเศษ</span>
            </h2>
            <Link href="/promotions" style={{
              fontSize: 11, color: 'var(--ink)', textDecoration: 'none',
              fontWeight: 700, letterSpacing: '0.06em',
              display: 'flex', alignItems: 'center', gap: 2, textTransform: 'uppercase',
            }}>
              ดูทั้งหมด <ChevronRight size={13} />
            </Link>
          </div>
          <div style={{
            display: 'flex', gap: 10, overflowX: 'auto',
            paddingBottom: 4, paddingRight: 16,
            scrollSnapType: 'x mandatory',
          }}>
            {cardPromos.map((p: Promotion) => <PromoSmall key={p.id} promo={p} />)}
          </div>
        </section>
      )}

      {/* ─── Recent purchases ─── */}
      <section style={{ padding: '24px 16px 8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 4px 14px' }}>
          <h2 className="display" style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
            สินค้า<span className="gold-text">ล่าสุด</span>
          </h2>
          <Link href="/purchases" style={{
            fontSize: 11, color: 'var(--ink)', textDecoration: 'none',
            fontWeight: 700, letterSpacing: '0.06em',
            display: 'flex', alignItems: 'center', gap: 2, textTransform: 'uppercase',
          }}>
            ดูทั้งหมด <ChevronRight size={13} />
          </Link>
        </div>

        {purchases && purchases.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(purchases as PurchaseRegistration[]).map(p => (
              <article key={p.id} className="card" style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: 14,
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 'var(--r-md)',
                  background: 'var(--bg-soft)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--ink-mute)', flexShrink: 0,
                }}>
                  <Package size={20} strokeWidth={1.5} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: 13.5, fontWeight: 700, margin: 0, color: 'var(--ink)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {p.model_name || p.order_sn}
                  </p>
                  <p style={{ fontSize: 11.5, color: 'var(--ink-mute)', margin: '2px 0 0' }}>
                    {formatDate(p.purchase_date || p.created_at)}
                  </p>
                </div>
                <StatusPill status={p.status} />
              </article>
            ))}
          </div>
        ) : (
          <div className="card-product" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '32px 24px', textAlign: 'center' }}>
              <div style={{
                width: 60, height: 60, margin: '0 auto 16px',
                borderRadius: '50%', background: 'var(--gold-glow)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--gold-deep)',
              }}>
                <Package size={24} strokeWidth={1.5} />
              </div>
              <h3 className="display" style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>
                ยังไม่มีสินค้าที่ลงทะเบียน
              </h3>
              <p style={{ fontSize: 12, color: 'var(--ink-mute)', margin: '0 0 18px' }}>
                เริ่มต้นด้วยการลงทะเบียนสินค้า Dreame ของคุณ
              </p>
            </div>
            <Link href="/purchases/register" className="bottom-bar tap" style={{
              textDecoration: 'none', justifyContent: 'center', gap: 6, padding: '14px 18px',
            }}>
              <Plus size={14} color="var(--gold-soft)" />
              <span style={{ color: 'var(--gold-soft)', fontSize: 13, fontWeight: 700, letterSpacing: '0.04em' }}>
                ลงทะเบียนสินค้า
              </span>
            </Link>
          </div>
        )}
      </section>

      {/* ─── Feed (vertical Instagram-style) ─── */}
      {feedPromos.length > 0 && (
        <section style={{ padding: '24px 16px 8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 4px 14px' }}>
            <h2 className="display" style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
              ฟีด<span className="gold-text">โปรโมชั่น</span>
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {feedPromos.map((p: Promotion) => <PromoFeed key={p.id} promo={p} />)}
          </div>
        </section>
      )}

      {/* ─── Footer ─── */}
      <div style={{ textAlign: 'center', padding: '24px 0 28px' }}>
        <div style={{
          width: 24, height: 1, background: 'var(--gold)',
          margin: '0 auto 12px',
        }} />
        <p style={{
          fontSize: 11, color: 'var(--ink-faint)', margin: 0,
          letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700,
        }}>
          Dreame · Membership
        </p>
      </div>

      </div>{/* end light sheet */}
    </div>
  )
}
