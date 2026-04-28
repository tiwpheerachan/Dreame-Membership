'use client'
import { useEffect, useRef, useState } from 'react'
import { TrendingUp } from 'lucide-react'

interface Props {
  currentTier: string
  nextTier: string | null
  progress: number
  pointsNeeded: number
}

const TIER_DOT_COLOR: Record<string, string> = {
  Plus:   '#9CA3AF',
  Pro:    '#1F1F1F',
  Ultra:  '#E07A3C',
  Master: '#A0782B',
}

export default function TierProgress({ currentTier, nextTier, progress, pointsNeeded }: Props) {
  const [animProgress, setAnimProgress] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setAnimProgress(progress), 100)
    return () => clearTimeout(t)
  }, [progress])

  const currentColor = TIER_DOT_COLOR[currentTier] ?? 'var(--ink-mute)'
  const nextColor    = nextTier ? TIER_DOT_COLOR[nextTier] : 'var(--gold)'

  return (
    <div ref={ref} className="shimmer-sweep" style={{
      position: 'relative',
      borderRadius: 'var(--r-lg)',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #FFFFFF 0%, #F8F7F4 100%)',
      border: '1px solid var(--hair)',
      boxShadow: 'var(--shadow-1)',
    }}>
      {/* gold corner star */}
      <span style={{
        position: 'absolute', top: 12, right: 14,
        fontSize: 10, color: 'var(--gold)', opacity: 0.6, zIndex: 3,
      }}>✦</span>

      <div style={{ padding: '16px 18px 14px', position: 'relative', zIndex: 4 }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--gold-glow)', color: 'var(--gold-deep)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <TrendingUp size={13} strokeWidth={2} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: 'var(--ink-mute)', margin: '0 0 2px',
            }}>
              Tier Progress
            </p>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
              {currentTier}{' → '}<span className="display gold-text" style={{ fontWeight: 800 }}>{nextTier ?? currentTier}</span>
            </p>
          </div>
          <p className="display tnum" style={{ fontSize: 22, color: 'var(--ink)', margin: 0, fontWeight: 800 }}>
            {animProgress}<span style={{ fontSize: 10, color: 'var(--ink-mute)' }}>%</span>
          </p>
        </div>

        {/* Bar */}
        <div style={{ position: 'relative' }}>
          {/* track */}
          <div style={{
            height: 8, background: 'var(--ink-ghost)',
            borderRadius: 'var(--r-pill)', overflow: 'hidden', position: 'relative',
          }}>
            {/* fill */}
            <div style={{
              height: '100%', width: `${animProgress}%`,
              background: 'linear-gradient(90deg, var(--gold-deep), var(--gold), var(--gold-soft))',
              borderRadius: 'var(--r-pill)',
              transition: 'width 1s cubic-bezier(0.34,1.1,0.64,1)',
              position: 'relative',
              boxShadow: '0 0 12px rgba(160,120,43,0.5)',
            }}>
              {/* moving sheen on fill */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
                animation: 'card-sweep 2.5s linear infinite',
              }} />
            </div>
          </div>

          {/* tier dots */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginTop: 8, padding: '0 4px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: currentColor, boxShadow: `0 0 8px ${currentColor}80` }} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink)' }}>{currentTier}</span>
            </div>
            {nextTier && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-mute)' }}>{nextTier}</span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: nextColor, opacity: 0.45 }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* black bottom bar */}
      <div style={{
        background: 'var(--black)', color: '#fff',
        padding: '12px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'relative', zIndex: 4,
      }}>
        <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 600 }}>
          {nextTier ? 'อีก' : 'You\'re at the top'}
        </span>
        {nextTier && (
          <span className="display tnum" style={{ fontSize: 16, color: 'var(--gold-soft)', fontWeight: 800 }}>
            {pointsNeeded.toLocaleString()}
            <span style={{ fontSize: 10, marginLeft: 4, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>pts</span>
          </span>
        )}
      </div>
    </div>
  )
}
