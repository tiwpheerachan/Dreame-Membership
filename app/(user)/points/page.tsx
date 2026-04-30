import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  TrendingUp, TrendingDown, RefreshCw, Sparkles, Wand2,
  ChevronRight, ArrowUpRight, Flame, Calendar,
} from 'lucide-react'
import type { PointsLog, UserTier } from '@/types'
import { formatDateTime } from '@/lib/utils'
import { getNextTierInfo, normalizeTier } from '@/lib/tier'
import dynamic from 'next/dynamic'

const MemberCard = dynamic(() => import('@/components/user/MemberCard'), { ssr: false })

const TYPE_CFG = {
  EARNED:       { label: 'ได้รับ',         Icon: TrendingUp,   tone: 'green' as const },
  REDEEMED:     { label: 'แลก',            Icon: TrendingDown, tone: 'red'   as const },
  EXPIRED:      { label: 'หมดอายุ',        Icon: RefreshCw,    tone: 'mute'  as const },
  ADMIN_ADJUST: { label: 'ปรับโดย Admin',   Icon: Wand2,        tone: 'amber' as const },
}

const TONES = {
  green: { ink: '#1F6B33', bg: '#E8F6EC', border: '#B8DFC2' },
  red:   { ink: '#8B2F2F', bg: '#FBE8E8', border: '#E8B7B7' },
  mute:  { ink: 'var(--ink-mute)', bg: 'var(--bg-soft)', border: 'var(--hair)' },
  amber: { ink: '#8C5A14', bg: '#FFF1DD', border: '#F0D7A4' },
}

const HERO: Record<UserTier, { bg: string; glow: string; ink: string; sub: string; star: string }> = {
  SILVER: {
    bg:   'radial-gradient(ellipse at top, #F1F5FA 0%, #E2E8F2 45%, #DDD0E5 100%)',
    glow: 'radial-gradient(circle, rgba(120,140,200,0.30) 0%, transparent 65%)',
    ink:  '#1B2333', sub: 'rgba(27,35,51,0.55)', star: '#7B8AB8',
  },
  GOLD: {
    bg:   'radial-gradient(ellipse at top, #FFF1DD 0%, #FFE0C2 45%, #F8D2A5 100%)',
    glow: 'radial-gradient(circle, rgba(255,166,77,0.32) 0%, transparent 65%)',
    ink:  '#3A2410', sub: 'rgba(58,36,16,0.55)', star: '#FF8A3D',
  },
  PLATINUM: {
    bg:   'radial-gradient(ellipse at top, #DCFAF3 0%, #B5F0E2 45%, #7DD8C5 100%)',
    glow: 'radial-gradient(circle, rgba(20,184,166,0.30) 0%, transparent 65%)',
    ink:  '#053C36', sub: 'rgba(5,60,54,0.55)', star: '#0E9488',
  },
}

const TIER_LADDER: { key: UserTier; label: string; threshold: number }[] = [
  { key: 'SILVER',   label: 'Silver',   threshold: 0 },
  { key: 'GOLD',     label: 'Gold',     threshold: 80 },
  { key: 'PLATINUM', label: 'Platinum', threshold: 400 },
]

function groupByMonth(logs: PointsLog[]): { month: string; entries: PointsLog[] }[] {
  const map = new Map<string, PointsLog[]>()
  for (const l of logs) {
    const d = new Date(l.created_at)
    const key = d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
    const arr = map.get(key) || []
    arr.push(l)
    map.set(key, arr)
  }
  return Array.from(map.entries()).map(([month, entries]) => ({ month, entries }))
}

export default async function PointsPage() {
  const supabase = createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: user }, { data: logs }] = await Promise.all([
    supabase.from('users').select('*').eq('id', authUser.id).maybeSingle(),
    supabase.from('points_log').select('*').eq('user_id', authUser.id)
      .order('created_at', { ascending: false }).limit(80),
  ])
  if (!user) redirect('/terms')

  const userTier = normalizeTier(user.tier as string)
  const tierInfo = getNextTierInfo(userTier, user.lifetime_points)
  const tierLabel = userTier.charAt(0) + userTier.slice(1).toLowerCase()
  const hero = HERO[userTier]
  const grouped = groupByMonth((logs as PointsLog[]) || [])

  // 30-day insight
  const since30 = Date.now() - 30 * 86400000
  const recent30 = (logs || []).filter(l => new Date(l.created_at).getTime() >= since30)
  const earned30 = recent30.filter(l => l.type === 'EARNED').reduce((s, l) => s + l.points_delta, 0)

  return (
    <div className="page-enter" style={{ paddingTop: 0, paddingBottom: 32 }}>

      {/* ============================================================
          HERO STAGE — sparkles + member card with wake animation
      ============================================================ */}
      <div style={{
        position: 'relative',
        background: hero.bg,
        paddingTop: 18, paddingBottom: 40,
        overflow: 'hidden',
      }}>
        {/* aurora */}
        <div aria-hidden className="aurora" style={{
          top: '-10%', left: '-15%', width: 260, height: 260,
          background: hero.star, opacity: 0.18, animationDelay: '0s',
        }} />
        <div aria-hidden className="aurora" style={{
          bottom: '-12%', right: '-18%', width: 320, height: 320,
          background: hero.star, opacity: 0.14, animationDelay: '4s',
        }} />
        <div aria-hidden className="tech-grid" />

        {/* radial glow behind card */}
        <div aria-hidden style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 380, height: 380, borderRadius: '50%',
          background: hero.glow, pointerEvents: 'none', filter: 'blur(8px)',
        }} />

        {/* pulse rings */}
        {[0, 1.5, 3].map((delay, i) => (
          <div key={`ring-${i}`} aria-hidden className="pulse-ring" style={{
            top: '52%', left: '50%',
            width: 280, height: 280,
            transform: 'translate(-50%, -50%)',
            border: `1.5px solid ${hero.star}`,
            opacity: 0.4, animationDelay: `${delay}s`,
          }} />
        ))}

        {/* twinkles */}
        {[
          { top: '10%', left: '8%',  size: 3,   delay: '0s',   tone: hero.star },
          { top: '14%', left: '46%', size: 4,   delay: '0.4s', tone: hero.star },
          { top: '20%', left: '90%', size: 3,   delay: '0.8s', tone: hero.star },
          { top: '30%', left: '14%', size: 2,   delay: '1.7s', tone: '#fff' },
          { top: '38%', left: '88%', size: 5,   delay: '0.0s', tone: hero.star },
          { top: '46%', left: '4%',  size: 2.5, delay: '1.4s', tone: '#fff' },
          { top: '70%', left: '20%', size: 4,   delay: '0.3s', tone: hero.star },
          { top: '78%', left: '88%', size: 3.5, delay: '1.1s', tone: '#fff' },
          { top: '88%', left: '60%', size: 3,   delay: '0.5s', tone: hero.star },
          { top: '92%', left: '38%', size: 2,   delay: '1.5s', tone: hero.star },
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

        {[
          { top: '16%', left: '18%', delay: '0s',   color: hero.star },
          { top: '40%', left: '92%', delay: '1.4s', color: '#fff' },
          { top: '82%', left: '70%', delay: '0.6s', color: '#fff' },
        ].map((s, i) => (
          <span key={`cr-${i}`} aria-hidden className="spark-cross" style={{
            top: s.top, left: s.left, color: s.color, animationDelay: s.delay,
          }} />
        ))}

        <span aria-hidden className="shooting-star" style={{ top: '6%',  left: '-10%', animationDelay: '0s',   animationDuration: '5.5s' }} />
        <span aria-hidden className="shooting-star" style={{ top: '24%', left: '-15%', animationDelay: '1.8s', animationDuration: '6.5s' }} />
        <span aria-hidden className="shooting-star" style={{ top: '78%', left: '-6%',  animationDelay: '7s',   animationDuration: '5.8s' }} />

        {/* Header — left-aligned for editorial feel */}
        <header style={{
          position: 'relative', zIndex: 2,
          padding: '6px 22px 22px',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14,
        }}>
          <div>
            <p style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase',
              color: hero.sub, margin: '0 0 6px',
            }}>
              Dreame Rewards
            </p>
            <h1 className="display" style={{
              margin: 0, fontSize: 28, lineHeight: 1.0, color: hero.ink, letterSpacing: '-0.015em',
            }}>
              <span style={{ fontWeight: 800 }}>คะแนน</span>{' '}
              <span className="serif-i" style={{ fontWeight: 400 }}>สะสม</span>
            </h1>
          </div>
          <span style={{
            fontSize: 10.5, fontWeight: 700,
            padding: '5px 12px', borderRadius: 'var(--r-pill)',
            background: 'rgba(255,255,255,0.55)',
            border: `1px solid rgba(255,255,255,0.7)`,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            color: hero.ink, letterSpacing: '0.04em',
            display: 'inline-flex', alignItems: 'center', gap: 5,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}>
            <Sparkles size={11} /> {tierLabel}
          </span>
        </header>

        {/* Member card — wakes up + idle sway */}
        <div style={{ position: 'relative', zIndex: 2, padding: '0 22px' }}>
          <div className="card-mount">
            <MemberCard user={user} />
          </div>
        </div>

        {/* Floating balance display */}
        <div className="pop-in-d2" style={{
          position: 'relative', zIndex: 2,
          marginTop: 24, padding: '0 22px',
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.20em', textTransform: 'uppercase',
            color: hero.sub, margin: '0 0 4px',
          }}>
            Available Balance
          </p>
          <h2 className="display tnum balance-display" style={{
            margin: 0, fontSize: 64, lineHeight: 1, fontWeight: 800,
            letterSpacing: '-0.03em',
            filter: 'drop-shadow(0 4px 20px rgba(160,120,43,0.20))',
          }}>
            {user.total_points.toLocaleString()}
          </h2>
          <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 11px', borderRadius: 'var(--r-pill)',
              background: 'rgba(255,255,255,0.55)',
              border: '1px solid rgba(255,255,255,0.7)',
              backdropFilter: 'blur(8px)',
              fontSize: 10.5, fontWeight: 700, color: hero.ink,
            }}>
              <Sparkles size={10} /> Lifetime {user.lifetime_points.toLocaleString()}
            </span>
            {earned30 > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 11px', borderRadius: 'var(--r-pill)',
                background: 'rgba(31,107,51,0.12)',
                border: '1px solid rgba(31,107,51,0.24)',
                fontSize: 10.5, fontWeight: 700, color: '#1F6B33',
              }}>
                <Flame size={10} /> +{earned30.toLocaleString()} ใน 30 วัน
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================
          TIER LADDER — horizontal milestone bar with current tier marker
      ============================================================ */}
      <section className="pop-in-d3" style={{ padding: '20px 16px 4px' }}>
        <div style={{
          position: 'relative', overflow: 'hidden',
          background: '#fff',
          border: '1px solid var(--hair)',
          borderRadius: 'var(--r-lg)',
          boxShadow: '0 4px 20px rgba(20,18,15,0.05)',
        }}>
          {/* Top accent */}
          <div aria-hidden style={{
            height: 2,
            background: 'linear-gradient(90deg, transparent 0%, #EADBB1 25%, #A0782B 50%, #EADBB1 75%, transparent 100%)',
          }} />

          <div style={{ padding: '18px 20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700 }}>
                Tier Ladder
              </p>
              {tierInfo.nextTier && (
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ink-mute)' }}>
                  อีก{' '}
                  <span style={{ fontWeight: 800, color: 'var(--gold-deep)' }}>
                    {tierInfo.pointsNeeded.toLocaleString()}
                  </span>{' '}
                  แต้ม
                </p>
              )}
            </div>

            {/* Track + dots */}
            <div style={{ position: 'relative', padding: '0 8px' }}>
              {/* Background track */}
              <div style={{
                height: 6, borderRadius: 100,
                background: 'rgba(160,120,43,0.10)',
                position: 'relative', overflow: 'hidden',
              }}>
                {/* Filled portion based on lifetime points */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, bottom: 0,
                  width: `${ladderProgressPct(user.lifetime_points)}%`,
                  background: 'linear-gradient(90deg,#A0782B,#EADBB1,#A0782B)',
                  borderRadius: 100,
                  boxShadow: '0 0 12px rgba(160,120,43,0.45)',
                  transition: 'width 0.6s ease',
                }} />
              </div>

              {/* Tier dots positioned along track */}
              {TIER_LADDER.map(t => {
                const left = ladderTierPosition(t.threshold)
                const isCurrent = userTier === t.key
                const isPassed  = user.lifetime_points >= t.threshold
                return (
                  <div key={t.key} style={{
                    position: 'absolute', top: -7, left: `calc(${left}% - 10px)`,
                    width: 20, height: 20, borderRadius: '50%',
                    background: isPassed
                      ? 'linear-gradient(135deg,#FAF3DC,#EADBB1,#A0782B)'
                      : '#fff',
                    border: `2px solid ${isPassed ? '#A0782B' : 'var(--hair)'}`,
                    boxShadow: isPassed ? '0 2px 6px rgba(160,120,43,0.40)' : 'none',
                  }}
                  className={isCurrent ? 'tier-dot-active' : undefined}
                  />
                )
              })}
            </div>

            {/* Tier labels under dots */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, padding: '0 4px' }}>
              {TIER_LADDER.map(t => {
                const isCurrent = userTier === t.key
                const isPassed  = user.lifetime_points >= t.threshold
                return (
                  <div key={t.key} style={{ textAlign: 'center', flex: 1 }}>
                    <p style={{
                      margin: 0, fontSize: 12,
                      fontWeight: isCurrent ? 800 : 600,
                      color: isPassed ? 'var(--ink)' : 'var(--ink-faint)',
                      letterSpacing: '-0.005em',
                    }}>
                      {t.label}
                    </p>
                    <p style={{
                      margin: '2px 0 0', fontSize: 10,
                      color: isPassed ? 'var(--gold-deep)' : 'var(--ink-faint)',
                      fontWeight: 600,
                    }}>
                      {t.threshold === 0 ? 'Start' : `${t.threshold}+ pts`}
                    </p>
                  </div>
                )
              })}
            </div>

            {tierInfo.nextTier && (
              <p style={{
                margin: '18px 0 0', fontSize: 11.5, color: 'var(--ink-mute)',
                textAlign: 'center', lineHeight: 1.55,
              }}>
                สะสมอีกหน่อยเพื่อก้าวสู่{' '}
                <span style={{
                  fontWeight: 800,
                  background: 'linear-gradient(135deg,#A0782B,#EADBB1)',
                  WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                }}>
                  {tierInfo.nextTier.charAt(0)}{tierInfo.nextTier.slice(1).toLowerCase()}
                </span>
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ============================================================
          INSIGHT CHIPS
      ============================================================ */}
      <section className="pop-in-d4" style={{ padding: '14px 16px 4px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <InsightTile
            Icon={Calendar}
            label="กิจกรรม 30 วัน"
            value={`${recent30.length} รายการ`}
            tone={{ bg: '#EEF2FF', ink: '#4F46E5' }}
          />
          <InsightTile
            Icon={ArrowUpRight}
            label="ได้รับ 30 วัน"
            value={`+${earned30.toLocaleString()} pts`}
            tone={{ bg: '#E8F6EC', ink: '#1F6B33' }}
            featured
          />
        </div>
      </section>

      {/* ============================================================
          ACTIVITY TIMELINE
      ============================================================ */}
      <section className="pop-in-d5" style={{ padding: '20px 16px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 4px 14px' }}>
          <h2 className="display" style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
            ประวัติ <span className="serif-i" style={{ fontWeight: 400 }}>การสะสม</span>
          </h2>
          {logs && logs.length > 0 && (
            <span style={{
              fontSize: 10.5, color: 'var(--ink-mute)', fontWeight: 700,
              padding: '3px 10px', borderRadius: 'var(--r-pill)',
              background: 'var(--bg-soft)', border: '1px solid var(--hair)',
              letterSpacing: '0.04em',
            }}>
              {logs.length} รายการ
            </span>
          )}
        </div>

        {!logs || logs.length === 0 ? (
          <div style={{
            padding: 44, textAlign: 'center',
            background: '#fff', border: '1px solid var(--hair)',
            borderRadius: 'var(--r-lg)',
            boxShadow: '0 2px 12px rgba(20,18,15,0.04)',
          }}>
            <div style={{
              width: 56, height: 56, margin: '0 auto 14px',
              borderRadius: 16,
              background: 'linear-gradient(135deg,#FAF3DC,#EADBB1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#A0782B',
              boxShadow: '0 4px 14px rgba(160,120,43,0.18)',
            }}>
              <Sparkles size={22} strokeWidth={1.7} />
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>ยังไม่มีประวัติแต้ม</p>
            <p className="serif-i" style={{ fontSize: 11.5, color: 'var(--ink-mute)', margin: 0, lineHeight: 1.6 }}>
              ลงทะเบียนสินค้าเพื่อเริ่มสะสมแต้มแรก
            </p>
          </div>
        ) : (
          <div style={{
            background: '#fff', border: '1px solid var(--hair)',
            borderRadius: 'var(--r-lg)',
            boxShadow: '0 2px 12px rgba(20,18,15,0.04)',
            overflow: 'hidden',
          }}>
            {grouped.map((group, gi) => (
              <div key={group.month}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: gi === 0 ? '14px 18px 8px' : '18px 18px 8px',
                  background: gi === 0 ? 'transparent' : 'rgba(248,246,242,0.55)',
                  borderTop: gi === 0 ? 'none' : '1px solid var(--hair)',
                }}>
                  <span style={{
                    fontSize: 9.5, fontWeight: 800, letterSpacing: '0.16em',
                    textTransform: 'uppercase', color: 'var(--gold-deep)',
                  }}>
                    {group.month}
                  </span>
                  <span style={{ flex: 1, height: 1, background: 'var(--hair)' }} />
                  <span style={{ fontSize: 10.5, color: 'var(--ink-mute)', fontWeight: 600 }}>
                    {group.entries.length} รายการ
                  </span>
                </div>

                <div style={{ position: 'relative' }}>
                  <div aria-hidden style={{
                    position: 'absolute',
                    top: 18, bottom: 18, left: 36,
                    width: 1, background: 'var(--hair)',
                  }} />

                  {group.entries.map((log, idx) => {
                    const cfg = TYPE_CFG[log.type] || TYPE_CFG.EARNED
                    const tone = TONES[cfg.tone]
                    const Icon = cfg.Icon
                    const isPos = log.points_delta > 0
                    const isLast = idx === group.entries.length - 1
                    return (
                      <article key={log.id} style={{
                        position: 'relative',
                        display: 'flex', alignItems: 'flex-start', gap: 14,
                        padding: '12px 18px',
                        borderBottom: isLast ? 'none' : '1px solid rgba(20,18,15,0.04)',
                      }}>
                        <div style={{
                          position: 'relative', zIndex: 1,
                          width: 38, height: 38, borderRadius: 11,
                          background: tone.bg,
                          border: `1.5px solid ${tone.border}`,
                          color: tone.ink, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 2px 6px rgba(20,18,15,0.05)',
                        }}>
                          <Icon size={15} strokeWidth={2} />
                        </div>

                        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                          <p style={{
                            fontSize: 13, fontWeight: 700, margin: 0, color: 'var(--ink)',
                            lineHeight: 1.4,
                            overflow: 'hidden', display: '-webkit-box',
                            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                          }}>
                            {log.description || cfg.label}
                          </p>
                          <p style={{ fontSize: 10.5, color: 'var(--ink-faint)', margin: '3px 0 0' }}>
                            {formatDateTime(log.created_at)}
                          </p>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0, paddingTop: 2 }}>
                          {isPos ? (
                            <span className="display tnum" style={{
                              fontSize: 17, fontWeight: 800, letterSpacing: '-0.005em',
                              background: 'linear-gradient(135deg,#FAF3DC,#EADBB1,#A0782B)',
                              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                            }}>
                              +{log.points_delta.toLocaleString()}
                            </span>
                          ) : (
                            <span className="display tnum" style={{
                              fontSize: 17, fontWeight: 800, color: tone.ink,
                              letterSpacing: '-0.005em',
                            }}>
                              {log.points_delta.toLocaleString()}
                            </span>
                          )}
                          <p style={{ fontSize: 10, color: 'var(--ink-faint)', margin: '2px 0 0', fontWeight: 600 }}>
                            คงเหลือ {log.balance_after.toLocaleString()}
                          </p>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

// Position the tier dot along the 0-100% track. Map lifetime thresholds to %.
function ladderTierPosition(threshold: number): number {
  if (threshold === 0)   return 4
  if (threshold === 80)  return 50
  if (threshold === 400) return 96
  return 50
}

// How filled the track should be based on lifetime points.
function ladderProgressPct(lifetime: number): number {
  if (lifetime <= 0)   return 4
  if (lifetime >= 400) return 96
  if (lifetime >= 80)  return 50 + ((lifetime - 80) / (400 - 80)) * 46
  return 4 + (lifetime / 80) * 46
}

function InsightTile({
  Icon, label, value, tone, featured,
}: {
  Icon: typeof Sparkles
  label: string
  value: string
  tone: { bg: string; ink: string }
  featured?: boolean
}) {
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      padding: '14px 14px 16px',
      background: '#fff',
      border: '1px solid var(--hair)',
      borderRadius: 'var(--r-md)',
      boxShadow: '0 2px 10px rgba(20,18,15,0.04)',
    }}>
      {featured && (
        <div aria-hidden style={{
          position: 'absolute', top: -20, right: -20,
          width: 80, height: 80, borderRadius: '50%',
          background: `radial-gradient(circle, ${tone.bg} 0%, transparent 70%)`,
        }} />
      )}
      <div style={{
        position: 'relative',
        width: 32, height: 32, borderRadius: 9,
        background: tone.bg, color: tone.ink,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 8,
      }}>
        <Icon size={15} strokeWidth={2} />
      </div>
      <p style={{
        position: 'relative',
        margin: '0 0 4px', fontSize: 10, fontWeight: 700,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: 'var(--ink-mute)',
      }}>
        {label}
      </p>
      <p className="display tnum" style={{
        position: 'relative',
        margin: 0, fontSize: 17, fontWeight: 800, color: tone.ink, letterSpacing: '-0.01em',
      }}>
        {value}
      </p>
    </div>
  )
}
