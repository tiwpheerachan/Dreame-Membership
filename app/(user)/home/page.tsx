import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Bell, Plus, Package,
  ChevronRight, TrendingUp, Sparkles, Award, ArrowRight,
} from 'lucide-react'
import type { User, PurchaseRegistration, Promotion, UserTier, BQOrderData } from '@/types'
import dynamic from 'next/dynamic'
const MemberCard = dynamic(() => import('@/components/user/MemberCard'), { ssr: false })
const TrackOrderBanner = dynamic(() => import('@/components/user/TrackOrderBanner'), { ssr: false })
// Warp uses WebGL — must mount client-side only or the build chokes on `window`.
const WarpShader = dynamic(() => import('@/components/ui/warp-shader'), { ssr: false })
// 'use client' already makes this a Client Component — direct import is the
// safe path. Wrapping a named export with dynamic({ ssr: false }) from a
// Server Component triggers a Next 14 RSC manifest lookup bug
// ("…#MembershipDashboardCard#default").
import { MembershipDashboardCard } from '@/components/ui/animated-dashboard-card'
import QuickActionsBar from '@/components/user/QuickActionsBar'
import { PromoHero, PromoSmall, PromoFeed } from '@/components/user/PromoCard'
import BannerMarquee from '@/components/user/BannerMarquee'
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

  // Promotions: use the service client so RLS configuration on production
  // (or its absence) doesn't accidentally hide active marketing content.
  // The data is public-facing anyway, just filtered by is_active.
  const service = createServiceClient()

  const [{ data: user }, { data: purchases }, { data: promos, error: promosErr }] = await Promise.all([
    supabase.from('users').select('*').eq('id', authUser.id).maybeSingle(),
    supabase.from('purchase_registrations').select('*').eq('user_id', authUser.id)
      .order('created_at', { ascending: false }).limit(3),
    service.from('promotions').select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: false })
      .order('created_at', { ascending: false }).limit(20),
  ])
  if (promosErr) console.error('[home] promotions query failed:', promosErr)
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
      shaderColors: [
        'hsl(220, 55%, 30%)',
        'hsl(210, 70%, 85%)',
        'hsl(225, 45%, 55%)',
        'hsl(235, 35%, 92%)',
      ] as [string, string, string, string],
    },
    GOLD: {
      bg: 'radial-gradient(ellipse at top, #FFF1DD 0%, #FFE0C2 45%, #F8D2A5 100%)',
      glow: 'radial-gradient(circle, rgba(255,166,77,0.32) 0%, transparent 65%)',
      ink: '#3A2410',
      sub: 'rgba(58,36,16,0.55)',
      starColor: '#FF8A3D',
      shaderColors: [
        'hsl(28, 75%, 35%)',
        'hsl(38, 100%, 82%)',
        'hsl(22, 80%, 55%)',
        'hsl(45, 100%, 90%)',
      ] as [string, string, string, string],
    },
    PLATINUM: {
      bg: 'radial-gradient(ellipse at top, #DCFAF3 0%, #B5F0E2 45%, #7DD8C5 100%)',
      glow: 'radial-gradient(circle, rgba(20,184,166,0.30) 0%, transparent 65%)',
      ink: '#053C36',
      sub: 'rgba(5,60,54,0.55)',
      starColor: '#0E9488',
      shaderColors: [
        'hsl(200, 100%, 25%)',
        'hsl(160, 100%, 80%)',
        'hsl(180, 90%, 40%)',
        'hsl(170, 100%, 88%)',
      ] as [string, string, string, string],
    },
  } as const
  const hero = HERO[userTier]

  return (
    <div className="page-enter" style={{ paddingTop: 0 }}>
      {/* ============================================================
          LIGHT HERO — Warp shader background (replaces stars/sparkles).
          Card + topbar are unchanged; they sit on zIndex 2 above the shader.
      ============================================================ */}
      <div style={{
        position: 'relative',
        background: hero.bg,        // tier-tinted base shows during shader mount
        paddingTop: 18, paddingBottom: 60,
        overflow: 'hidden',
      }}>
        {/* Animated Warp shader fills the hero behind the card */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        }}>
          <WarpShader
            colors={hero.shaderColors}
            speed={0.7}
            swirl={0.85}
            swirlIterations={9}
            proportion={0.45}
            softness={1}
            distortion={0.28}
            shapeScale={0.1}
          />
        </div>

        {/* Soft white veil so topbar text stays readable on lighter palettes */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 35%, rgba(255,255,255,0.20) 100%)',
        }} />

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

      {/* Active order tracking banner — เด้งอัตโนมัติเมื่อมี order กำลังส่ง */}
      <div style={{ paddingTop: 16 }}>
        <TrackOrderBanner variant="banner" />
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

      {/* ─── Animated dashboard card — POINTS / LIFETIME / TIER + tier progress ─── */}
      <section style={{ padding: '8px 16px 12px' }}>
        <MembershipDashboardCard
          availablePoints={user.total_points}
          lifetimePoints={user.lifetime_points}
          tierLabel={tierLabel}
          nextTierLabel={tierInfo.nextTier
            ? tierInfo.nextTier.charAt(0) + tierInfo.nextTier.slice(1).toLowerCase()
            : null}
          progressPct={tierInfo.progress}
          pointsNeeded={tierInfo.pointsNeeded}
          toPoints={tierInfo.toPoints}
          detailsHref="/points"
          detailsLabel="ดูรายละเอียดคะแนน"
        />
      </section>

      {/* ─── Quick Actions: gradient-pill bar that slides between buttons ─── */}
      <section style={{ padding: '6px 16px 10px' }}>
        <QuickActionsBar />
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
            {(purchases as PurchaseRegistration[]).map(p => {
              const image = (p.bq_raw_data as BQOrderData | null)?.items?.[0]?.image_url || null
              return (
                <article key={p.id} className="card" style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: 14,
                }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 'var(--r-md)',
                    background: 'var(--bg-soft)',
                    overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--ink-mute)', flexShrink: 0,
                  }}>
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt={p.model_name || 'product'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Package size={20} strokeWidth={1.5} />
                    )}
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
              )
            })}
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
