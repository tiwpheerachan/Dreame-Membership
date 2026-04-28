'use client'
import { Sparkles, TrendingUp, Award } from 'lucide-react'

interface Props {
  totalPoints: number
  lifetimePoints: number
  tier: string
}

export default function StatsHero({ totalPoints, lifetimePoints, tier }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10 }}>
      {/* ── BIG: Your Points — black + gold w/ shimmer ── */}
      <div className="shimmer-sweep" style={{
        position: 'relative',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
        aspectRatio: '5 / 6',
        background: 'linear-gradient(160deg, #1A1815 0%, #2A2017 50%, #4A3318 100%)',
        boxShadow: 'var(--shadow-2)',
      }}>
        {/* gold radial spotlight */}
        <div aria-hidden style={{
          position: 'absolute', top: '-30%', right: '-20%',
          width: '80%', height: '80%',
          background: 'radial-gradient(circle, rgba(201,168,90,0.30) 0%, transparent 60%)',
          zIndex: 1, pointerEvents: 'none',
        }} />

        {/* sparkles */}
        <div className="sparkle sparkle-1" style={{ zIndex: 3 }} />
        <div className="sparkle sparkle-2" style={{ zIndex: 3 }} />
        <div className="sparkle sparkle-3" style={{ zIndex: 3 }} />
        <div className="sparkle sparkle-4" style={{ zIndex: 3 }} />

        <div style={{
          position: 'relative', zIndex: 4, height: '100%',
          padding: 22,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.20em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.55)', margin: 0,
              }}>
                Your Points
              </p>
              <p style={{
                fontSize: 11, color: 'rgba(255,255,255,0.40)', margin: '4px 0 0',
                fontWeight: 500,
              }}>
                Available balance
              </p>
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--r-md)',
              background: 'rgba(212,185,120,0.18)',
              border: '1px solid rgba(212,185,120,0.40)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)',
            }}>
              <Sparkles size={16} color="#EADBB1" strokeWidth={1.7} />
            </div>
          </div>

          <div>
            <p className="display tnum shine-num" style={{
              fontSize: 56, lineHeight: 0.9, margin: 0, fontWeight: 800,
            }}>
              {totalPoints.toLocaleString()}
            </p>
            <p style={{
              fontSize: 11, color: 'rgba(255,255,255,0.55)',
              margin: '8px 0 0', fontWeight: 500, letterSpacing: '0.04em',
            }}>
              points
            </p>
          </div>
        </div>
      </div>

      {/* ── 2 small stats stacked ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Lifetime — clean white with gold corner */}
        <div className="shimmer-sweep" style={{
          position: 'relative',
          borderRadius: 'var(--r-lg)',
          overflow: 'hidden',
          flex: 1,
          background: '#FFFFFF',
          border: '1px solid var(--hair)',
          boxShadow: 'var(--shadow-1)',
        }}>
          {/* gold corner ribbon */}
          <div aria-hidden style={{
            position: 'absolute', top: 0, right: 0, width: 60, height: 60,
            background: 'linear-gradient(225deg, var(--gold-glow) 0%, transparent 70%)',
            zIndex: 1,
          }} />

          <div style={{
            position: 'relative', zIndex: 2,
            padding: '14px 16px', height: '100%',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
                color: 'var(--ink-mute)', margin: 0,
              }}>
                Lifetime
              </p>
              <TrendingUp size={13} color="var(--gold-deep)" strokeWidth={2} />
            </div>
            <p className="display tnum" style={{
              fontSize: 22, lineHeight: 1, margin: 0, fontWeight: 700, color: 'var(--ink)',
            }}>
              {lifetimePoints.toLocaleString()}
              <span style={{ fontSize: 10, color: 'var(--ink-mute)', marginLeft: 4, fontWeight: 500 }}>pts</span>
            </p>
          </div>
        </div>

        {/* Tier — gold gradient with sparkle */}
        <div className="shimmer-sweep" style={{
          position: 'relative',
          borderRadius: 'var(--r-lg)',
          overflow: 'hidden',
          flex: 1,
          background: 'linear-gradient(135deg, #C9A85A 0%, #A0782B 50%, #7A5A1F 100%)',
          boxShadow: 'var(--shadow-1)',
        }}>
          <div className="sparkle sparkle-2" style={{ zIndex: 3 }} />
          <div className="sparkle sparkle-3" style={{ zIndex: 3 }} />

          <div style={{
            position: 'relative', zIndex: 4,
            padding: '14px 16px', height: '100%',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.70)', margin: 0,
              }}>
                Tier
              </p>
              <Award size={13} color="#fff" strokeWidth={2} />
            </div>
            <p className="display" style={{
              fontSize: 22, lineHeight: 1, margin: 0, fontWeight: 800, color: '#fff',
              textShadow: '0 1px 2px rgba(0,0,0,0.15)',
            }}>
              {tier}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
