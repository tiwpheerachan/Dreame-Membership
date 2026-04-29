import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TrendingUp, TrendingDown, RefreshCw, Sparkles, Wand2 } from 'lucide-react'
import type { PointsLog, UserTier } from '@/types'
import { formatDateTime } from '@/lib/utils'
import { getNextTierInfo } from '@/lib/points'

const TYPE_CFG = {
  EARNED:       { label: 'ได้รับ',     Icon: TrendingUp,   tone: 'green' as const },
  REDEEMED:     { label: 'แลก',        Icon: TrendingDown, tone: 'red'   as const },
  EXPIRED:      { label: 'หมดอายุ',    Icon: RefreshCw,    tone: 'mute'  as const },
  ADMIN_ADJUST: { label: 'ปรับโดย Admin', Icon: Wand2,     tone: 'amber' as const },
}

const TONES = {
  green: { color: 'var(--green)',     bg: 'var(--green-soft)' },
  red:   { color: 'var(--red)',       bg: 'var(--red-soft)' },
  mute:  { color: 'var(--ink-mute)',  bg: 'var(--bg-soft)' },
  amber: { color: 'var(--amber)',     bg: 'var(--amber-soft)' },
}

export default async function PointsPage() {
  const supabase = createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: user }, { data: logs }] = await Promise.all([
    supabase.from('users').select('*').eq('id', authUser.id).maybeSingle(),
    supabase.from('points_log').select('*').eq('user_id', authUser.id)
      .order('created_at', { ascending: false }).limit(50),
  ])
  if (!user) redirect('/terms')

  const userTier = (user.tier || 'SILVER') as UserTier
  const tierInfo = getNextTierInfo(userTier, user.lifetime_points)
  const tierLabel = userTier.charAt(0) + userTier.slice(1).toLowerCase()

  return (
    <div className="page-enter" style={{ paddingTop: 18 }}>
      {/* Header */}
      <header style={{ padding: '14px 20px 20px' }}>
        <p className="kicker" style={{ marginBottom: 8 }}>Dreame Rewards</p>
        <h1 className="display" style={{ margin: 0, fontSize: 30, fontWeight: 800 }}>
          คะแนน<span className="gold-text">สะสม</span>
        </h1>
      </header>

      {/* Hero number */}
      <section style={{ padding: '0 16px 16px' }}>
        <div className="card" style={{ padding: '28px 24px', position: 'relative', overflow: 'hidden' }}>
          <p className="kicker" style={{ margin: '0 0 12px' }}>Available Balance</p>
          <p className="display tnum gold-text" style={{
            fontSize: 64, lineHeight: 0.9, margin: 0, fontWeight: 800,
          }}>
            {user.total_points.toLocaleString()}
          </p>
          <p style={{ fontSize: 13, color: 'var(--ink-mute)', margin: '10px 0 0', fontWeight: 500 }}>
            points available
          </p>

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            marginTop: 24, paddingTop: 18,
            borderTop: '1px solid var(--hair)',
          }}>
            <div style={{ borderRight: '1px solid var(--hair)' }}>
              <p className="kicker" style={{ margin: '0 0 6px' }}>Lifetime</p>
              <p className="display tnum" style={{ fontSize: 22, color: 'var(--ink)', margin: 0, fontWeight: 700 }}>
                {user.lifetime_points.toLocaleString()}
              </p>
            </div>
            <div style={{ paddingLeft: 16 }}>
              <p className="kicker" style={{ margin: '0 0 6px' }}>Tier</p>
              <p className="display" style={{ fontSize: 20, margin: 0, fontWeight: 800 }}>
                {userTier.charAt(0)}{userTier.slice(1).toLowerCase()}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tier ladder — 4 tiers (image) */}
      <section style={{ padding: '12px 16px 16px' }}>
        <div style={{ padding: '0 4px 14px', textAlign: 'center' }}>
          <p className="kicker" style={{ margin: '0 0 6px' }}>Tier Ladder</p>
          <h2 className="display" style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800 }}>
            Tiers and <span className="gold-text">Perks</span>
          </h2>
          <span className="pill pill-ink">
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

      {/* Progress to next tier */}
      {tierInfo.nextTier && (
        <section style={{ padding: '0 16px 16px' }}>
          <div className="card-product">
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                  สู่ระดับ <span className="display gold-text" style={{ fontSize: 18, fontWeight: 800 }}>
                    {tierInfo.nextTier.charAt(0)}{tierInfo.nextTier.slice(1).toLowerCase()}
                  </span>
                </p>
                <p className="display tnum" style={{ fontSize: 18, color: 'var(--ink)', margin: 0, fontWeight: 700 }}>
                  {tierInfo.progress}<span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>%</span>
                </p>
              </div>
              <div style={{ height: 6, background: 'var(--ink-ghost)', borderRadius: 'var(--r-pill)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${tierInfo.progress}%`,
                  background: 'linear-gradient(90deg,var(--gold-deep),var(--gold),var(--gold-soft))',
                }} />
              </div>
            </div>
            <div className="bottom-bar">
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.05em' }}>
                ต้องการอีก
              </span>
              <span className="display tnum" style={{ fontSize: 16, color: 'var(--gold-soft)' }}>
                {tierInfo.pointsNeeded.toLocaleString()}<span style={{ fontSize: 11, marginLeft: 4, fontWeight: 500 }}>points</span>
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Activity log */}
      <section style={{ padding: '24px 16px 24px' }}>
        <div style={{ padding: '0 4px 14px' }}>
          <h2 className="display" style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
            ประวัติ<span className="gold-text">แต้ม</span>
          </h2>
        </div>

        {!logs || logs.length === 0 ? (
          <div className="card" style={{ padding: 36, textAlign: 'center' }}>
            <Sparkles size={24} color="var(--ink-faint)" style={{ margin: '0 auto 10px', display: 'block' }} />
            <p style={{ fontSize: 13, color: 'var(--ink-mute)', margin: 0 }}>ยังไม่มีประวัติ</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(logs as PointsLog[]).map(log => {
              const cfg = TYPE_CFG[log.type] || TYPE_CFG.EARNED
              const tone = TONES[cfg.tone]
              const Icon = cfg.Icon
              const isNeg = log.points_delta < 0
              return (
                <article key={log.id} className="card" style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: 14,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 'var(--r-md)',
                    background: tone.bg, color: tone.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon size={16} strokeWidth={1.7} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--ink)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {log.description || cfg.label}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--ink-mute)', margin: '2px 0 0' }}>
                      {formatDateTime(log.created_at)}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p className="display tnum" style={{ fontSize: 18, margin: 0, color: tone.color, fontWeight: 700 }}>
                      {isNeg ? '−' : (log.type === 'EARNED' ? '+' : '')}
                      {Math.abs(log.points_delta).toLocaleString()}
                    </p>
                    <p style={{ fontSize: 9.5, color: 'var(--ink-faint)', margin: '2px 0 0' }}>
                      {log.balance_after.toLocaleString()} pts
                    </p>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
