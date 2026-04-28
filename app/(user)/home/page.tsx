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

  // Normalize legacy tier values (SILVER/GOLD/PLATINUM → PLUS/PRO/MASTER)
  function normalize(t: string): UserTier {
    const u = (t || '').toUpperCase()
    if (u === 'PLATINUM') return 'MASTER'
    if (u === 'GOLD')     return 'PRO'
    if (u === 'SILVER')   return 'PLUS'
    if (['PLUS','PRO','ULTRA','MASTER'].includes(u)) return u as UserTier
    return 'PLUS'
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
  const heroPromo  = homePromos.find((p: Promotion) => p.layout === 'hero')
  const cardPromos = homePromos.filter((p: Promotion) => p.layout === 'card')
  const feedPromos = homePromos.filter((p: Promotion) => p.layout === 'feed')

  // capitalised tier label for "Your Tier" badge
  const tierLabel = userTier.charAt(0) + userTier.slice(1).toLowerCase()

  return (
    <div className="page-enter" style={{ paddingTop: 0 }}>
      {/* ============================================================
          DARK HERO — header + member card on dark stage with sparkles
      ============================================================ */}
      <div style={{
        position: 'relative',
        background: 'radial-gradient(ellipse at top, #1F1A14 0%, #0E0E0E 60%, #060606 100%)',
        paddingTop: 18, paddingBottom: 60,
        overflow: 'hidden',
      }}>
        {/* ambient sparkles around the card */}
        <span aria-hidden style={{ position: 'absolute', top: '18%', left: '8%',  fontSize: 14, color: 'rgba(212,185,120,0.65)', animation: 'sparkle-spin 3s ease-in-out infinite' }}>✦</span>
        <span aria-hidden style={{ position: 'absolute', top: '24%', right: '10%', fontSize: 10, color: 'rgba(255,255,255,0.45)', animation: 'sparkle-spin 4s ease-in-out 0.6s infinite' }}>✦</span>
        <span aria-hidden style={{ position: 'absolute', bottom: '28%', left: '12%', fontSize: 11, color: 'rgba(212,185,120,0.55)', animation: 'sparkle-spin 3.5s ease-in-out 1.2s infinite' }}>✦</span>
        <span aria-hidden style={{ position: 'absolute', bottom: '22%', right: '14%', fontSize: 13, color: 'rgba(255,255,255,0.45)', animation: 'sparkle-spin 4.2s ease-in-out 1.8s infinite' }}>✦</span>

        {/* gold radial glow behind card */}
        <div aria-hidden style={{
          position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 320, height: 320, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,168,90,0.20) 0%, transparent 65%)',
          pointerEvents: 'none',
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
              color: 'rgba(255,255,255,0.45)', margin: '0 0 6px',
            }}>{greet}</p>
            <h1 className="display" style={{
              margin: 0, fontSize: 26, lineHeight: 1.05,
              color: '#fff',
            }}>
              {firstName}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button aria-label="Notifications" className="tap" style={{
              width: 42, height: 42, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.9)', cursor: 'pointer', position: 'relative',
              backdropFilter: 'blur(8px)',
            }}>
              <Bell size={16} strokeWidth={1.7} />
              <span className="pulse-dot" style={{
                position: 'absolute', top: 10, right: 10,
                width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)',
              }} />
            </button>
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

        {/* Member card with 3D + sparkles */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <MemberCard user={user as User} />
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

      {/* ─── Stats strip — refined 3 col with depth + accents ─── */}
      <section style={{ padding: '8px 16px 10px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 8,
        }}>
          {/* POINTS — dark with gold radial + sparkle + shimmer */}
          <div className="shimmer-sweep" style={{
            position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(135deg, #0E0E0E 0%, #1F1810 60%, #2A2017 100%)',
            color: '#fff',
            borderRadius: 'var(--r-md)', padding: '14px 16px',
            minHeight: 90,
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            boxShadow: '0 4px 16px rgba(14,14,14,0.10), inset 0 1px 0 rgba(212,185,120,0.18)',
          }}>
            {/* gold radial glow corner */}
            <div aria-hidden style={{
              position: 'absolute', top: -28, right: -28,
              width: 100, height: 100, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(201,168,90,0.30) 0%, transparent 65%)',
              pointerEvents: 'none', zIndex: 0,
            }} />
            <span aria-hidden className="sparkle sparkle-1" style={{ zIndex: 2 }} />
            <span aria-hidden className="sparkle sparkle-3" style={{ zIndex: 2 }} />

            <div style={{ position: 'relative', zIndex: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <p style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.55)', margin: 0,
              }}>Points</p>
              <Sparkles size={12} color="var(--gold-soft)" strokeWidth={1.7} />
            </div>
            <div style={{ position: 'relative', zIndex: 3 }}>
              <p className="display tnum shine-num" style={{ fontSize: 26, lineHeight: 1, margin: 0, fontWeight: 800 }}>
                {user.total_points.toLocaleString()}
              </p>
              <p style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.50)', margin: '3px 0 0', fontWeight: 500, letterSpacing: '0.04em' }}>
                available
              </p>
            </div>
          </div>

          {/* LIFETIME — clean white + gold corner ribbon */}
          <div style={{
            position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(135deg, #FFFFFF 0%, #FAF7F0 100%)',
            border: '1px solid var(--hair)',
            borderRadius: 'var(--r-md)', padding: '14px 16px',
            minHeight: 90,
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(14,14,14,0.04)',
          }}>
            <div aria-hidden style={{
              position: 'absolute', top: 0, right: 0,
              width: 60, height: 60,
              background: 'linear-gradient(225deg, var(--gold-glow) 0%, transparent 65%)',
              zIndex: 0,
            }} />
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <p style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
                color: 'var(--ink-mute)', margin: 0,
              }}>Lifetime</p>
              <TrendingUp size={12} color="var(--gold-deep)" strokeWidth={2} />
            </div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p className="display tnum" style={{
                fontSize: 22, lineHeight: 1, margin: 0, fontWeight: 700, color: 'var(--ink)',
              }}>
                {user.lifetime_points.toLocaleString()}
              </p>
              <p style={{ fontSize: 9.5, color: 'var(--ink-mute)', margin: '3px 0 0', fontWeight: 500, letterSpacing: '0.04em' }}>
                all-time
              </p>
            </div>
          </div>

          {/* TIER — gold gradient + sparkles + award icon */}
          <div className="shimmer-sweep" style={{
            position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(135deg, #EADBB1 0%, #C9A85A 45%, #A0782B 100%)',
            color: '#fff',
            borderRadius: 'var(--r-md)', padding: '14px 16px',
            minHeight: 90,
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            boxShadow: '0 4px 14px rgba(160,120,43,0.30), inset 0 1px 0 rgba(255,255,255,0.30)',
          }}>
            <span aria-hidden className="sparkle sparkle-2" style={{ zIndex: 2 }} />
            <span aria-hidden className="sparkle sparkle-4" style={{ zIndex: 2 }} />

            <div style={{ position: 'relative', zIndex: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <p style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.75)', margin: 0,
              }}>Tier</p>
              <Award size={12} color="#fff" strokeWidth={2} />
            </div>
            <div style={{ position: 'relative', zIndex: 3 }}>
              <p className="display" style={{
                fontSize: 22, lineHeight: 1, margin: 0, fontWeight: 800, color: '#fff',
                textShadow: '0 1px 2px rgba(0,0,0,0.12)',
              }}>
                {tierLabel}
              </p>
              <p style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.75)', margin: '3px 0 0', fontWeight: 500, letterSpacing: '0.04em' }}>
                level
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Tier progress — refined card with tier dots + glowing bar ─── */}
      {tierInfo.nextTier && (() => {
        const nextLabel = tierInfo.nextTier.charAt(0) + tierInfo.nextTier.slice(1).toLowerCase()
        return (
          <section style={{ padding: '4px 16px 12px' }}>
            <div style={{
              position: 'relative', overflow: 'hidden',
              background: 'linear-gradient(135deg, #FFFFFF 0%, #FCFAF4 100%)',
              border: '1px solid var(--hair)',
              borderRadius: 'var(--r-md)', padding: '14px 16px',
              boxShadow: '0 2px 12px rgba(14,14,14,0.04)',
            }}>
              {/* subtle gold corner accent */}
              <div aria-hidden style={{
                position: 'absolute', top: 0, right: 0,
                width: 80, height: 80,
                background: 'radial-gradient(ellipse at top right, rgba(201,168,90,0.12) 0%, transparent 65%)',
                zIndex: 0,
              }} />

              {/* Top row: tier transition + percent */}
              <div style={{
                position: 'relative', zIndex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Current tier dot */}
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #C9A85A, #A0782B)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(160,120,43,0.30)',
                  }}>
                    <Award size={11} color="#fff" strokeWidth={2.2} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{tierLabel}</span>
                  <ArrowRight size={13} color="var(--ink-faint)" strokeWidth={2} />
                  <span className="display gold-text" style={{ fontSize: 14, fontWeight: 800 }}>
                    {nextLabel}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                  <span className="display tnum" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>
                    {tierInfo.progress}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 600 }}>%</span>
                </div>
              </div>

              {/* Bar */}
              <div style={{
                position: 'relative', zIndex: 1,
                height: 8, background: 'var(--ink-ghost)',
                borderRadius: 'var(--r-pill)', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'relative',
                  height: '100%', width: `${tierInfo.progress}%`,
                  background: 'linear-gradient(90deg, var(--gold-deep), var(--gold), var(--gold-soft))',
                  borderRadius: 'var(--r-pill)',
                  transition: 'width 1s cubic-bezier(0.34,1.1,0.64,1)',
                  boxShadow: '0 0 12px rgba(160,120,43,0.45)',
                }}>
                  {/* moving sheen */}
                  <div aria-hidden style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)',
                    animation: 'card-sweep 2.6s linear infinite',
                  }} />
                </div>
              </div>

              {/* Bottom: points needed + range hint */}
              <div style={{
                position: 'relative', zIndex: 1,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: 10,
              }}>
                <span style={{ fontSize: 10, color: 'var(--ink-faint)', fontWeight: 500 }}>
                  {user.lifetime_points.toLocaleString()} pts
                </span>
                <span className="pill pill-gold" style={{ padding: '3px 10px' }}>
                  อีก <span className="tnum" style={{ fontWeight: 800 }}>{tierInfo.pointsNeeded.toLocaleString()}</span> pts
                </span>
                <span style={{ fontSize: 10, color: 'var(--ink-faint)', fontWeight: 500 }}>
                  {tierInfo.toPoints.toLocaleString()} pts
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
          alt="Tiers and Perks: Plus, Pro, Ultra, Master"
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
