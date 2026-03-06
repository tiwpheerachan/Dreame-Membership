'use client'
import { useRef } from 'react'
import type { User } from '@/types'
import { formatDate } from '@/lib/utils'

interface Props { user: User }

const tierCfg = {
  GOLD: {
    label: 'GOLD MEMBER',
    gradient: 'linear-gradient(135deg, #78480a 0%, #b8860b 35%, #d4af37 60%, #f5d060 100%)',
    shadow1: 'rgba(212,175,55,0.32)', shadow2: 'rgba(184,134,11,0.2)',
    accent: '#f5d060',
    line1: 'rgba(255,245,200,0.18)',
    line2: 'rgba(255,240,180,0.12)',
    glow: 'rgba(255,235,150,0.22)',
  },
  SILVER: {
    label: 'SILVER MEMBER',
    gradient: 'linear-gradient(135deg, #374151 0%, #6b7280 40%, #9ca3af 70%, #d1d5db 100%)',
    shadow1: 'rgba(156,163,175,0.32)', shadow2: 'rgba(107,114,128,0.2)',
    accent: '#e5e7eb',
    line1: 'rgba(255,255,255,0.18)',
    line2: 'rgba(255,255,255,0.11)',
    glow: 'rgba(255,255,255,0.18)',
  },
  PLATINUM: {
    label: 'PLATINUM MEMBER',
    gradient: 'linear-gradient(135deg, #0b0b0c 0%, #161617 32%, #4d3a12 62%, #d4af37 100%)',
    shadow1: 'rgba(212,175,55,0.28)', shadow2: 'rgba(0,0,0,0.28)',
    accent: '#f3d989',
    line1: 'rgba(255,232,170,0.16)',
    line2: 'rgba(255,255,255,0.08)',
    glow: 'rgba(212,175,55,0.18)',
  },
}

const CARD_CSS = `
@keyframes cardWave {
  0%   { transform: translateX(-120%) rotate(16deg); opacity: 0; }
  28%  { opacity: 0.32; }
  72%  { opacity: 0.1; }
  100% { transform: translateX(240%) rotate(16deg); opacity: 0; }
}
@keyframes sparkle {
  0%,100% { opacity:0.2; transform:scale(0.7); }
  50%      { opacity:1;   transform:scale(1.45); }
}
@keyframes floatLines {
  0%,100% { transform: translate3d(0,0,0) scale(1); }
  50%     { transform: translate3d(0,-3px,0) scale(1.01); }
}
@keyframes breathe-gold     {
  0%,100%{
    box-shadow:
      0 22px 48px rgba(212,175,55,0.28),
      0 10px 24px rgba(184,134,11,0.18),
      inset 0 1px 0 rgba(255,255,255,0.18);
  }
  50%{
    box-shadow:
      0 28px 62px rgba(212,175,55,0.40),
      0 14px 32px rgba(184,134,11,0.24),
      inset 0 1px 0 rgba(255,255,255,0.24);
  }
}
@keyframes breathe-silver   {
  0%,100%{
    box-shadow:
      0 22px 48px rgba(156,163,175,0.22),
      0 10px 24px rgba(107,114,128,0.14),
      inset 0 1px 0 rgba(255,255,255,0.16);
  }
  50%{
    box-shadow:
      0 28px 62px rgba(156,163,175,0.30),
      0 14px 32px rgba(107,114,128,0.20),
      inset 0 1px 0 rgba(255,255,255,0.22);
  }
}
@keyframes breathe-platinum {
  0%,100%{
    box-shadow:
      0 22px 48px rgba(212,175,55,0.18),
      0 10px 24px rgba(0,0,0,0.24),
      inset 0 1px 0 rgba(255,255,255,0.14);
  }
  50%{
    box-shadow:
      0 28px 62px rgba(212,175,55,0.26),
      0 14px 32px rgba(0,0,0,0.32),
      inset 0 1px 0 rgba(255,255,255,0.20);
  }
}

.mcard-wrap {
  perspective: 980px;
  padding: 0 16px;
  display: flex;
  justify-content: center;
}

.mcard-inner {
  position: relative;
  overflow: hidden;
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,0.18);
  transform-style: preserve-3d;
  transition: transform 160ms ease-out, box-shadow 200ms ease-out;
  will-change: transform;

  width: min(100%, 360px);
  aspect-ratio: 85.6 / 53.98;
}
.mcard-inner.tier-gold     { animation: breathe-gold     5.2s ease-in-out infinite; }
.mcard-inner.tier-silver   { animation: breathe-silver   5.2s ease-in-out infinite; }
.mcard-inner.tier-platinum { animation: breathe-platinum 5.2s ease-in-out infinite; }

.mcard-bg-lines {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  animation: floatLines 8s ease-in-out infinite;
}

.mcard-gloss {
  position:absolute; inset:0; pointer-events:none;
  background:
    radial-gradient(circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,0.22), transparent 16%),
    linear-gradient(110deg,rgba(255,255,255,0.18),rgba(255,255,255,0.04) 34%,rgba(255,255,255,0.16) 58%,rgba(255,255,255,0.02));
  mix-blend-mode:screen;
  z-index: 1;
}
.mcard-wave {
  position:absolute; top:-40%; bottom:-40%; left:-35%; width:42%;
  background:rgba(255,255,255,0.26); filter:blur(18px);
  transform:rotate(16deg);
  animation:cardWave 5.2s ease-in-out infinite;
  pointer-events:none;
  z-index: 2;
}
.spark { position:absolute; z-index:3; width:5px; height:5px; border-radius:9999px; background:white; box-shadow:0 0 10px rgba(255,255,255,0.9); animation:sparkle 3.2s infinite ease-in-out; pointer-events:none; }
.spark.s1 { top:14%; left:12%; }
.spark.s2 { top:26%; right:16%; animation-delay:0.7s; }
.spark.s3 { bottom:20%; left:26%; animation-delay:1.3s; }
.spark.s4 { bottom:28%; right:20%; animation-delay:1.9s; }

.mcard-chip-wrap {
  position:relative;
  flex-shrink:0;
  width:40px;
  height:30px;
  border-radius:8px;
  background:linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.08));
  border:1px solid rgba(255,255,255,0.18);
  backdrop-filter:blur(8px);
}
.mcard-chip {
  position:absolute;
  inset:5px;
  border-radius:6px;
  background:
    linear-gradient(90deg,rgba(255,255,255,0.18) 0 1px,transparent 1px 100%),
    linear-gradient(rgba(255,255,255,0.16) 0 1px,transparent 1px 100%),
    linear-gradient(135deg,rgba(255,255,255,0.24),rgba(255,255,255,0.08));
  background-size:7px 100%,100% 7px,100% 100%;
  border:1px solid rgba(255,255,255,0.14);
}

.mcard-shell {
  position: relative;
  z-index: 4;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.mcard-top {
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  margin-bottom:20px;
}

.mcard-brand {
  display:flex;
  align-items:center;
  gap:10px;
}

.mcard-brand-meta {
  color:rgba(255,255,255,0.52);
  font-size:9px;
  margin:0 0 2px;
  letter-spacing:0.1em;
  text-transform:uppercase;
}

.mcard-brand-label {
  color:rgba(255,255,255,0.95);
  font-size:11px;
  font-weight:700;
  margin:0;
  letter-spacing:0.08em;
}

.mcard-points {
  text-align:right;
}

.mcard-points-label {
  color:rgba(255,255,255,0.52);
  font-size:9px;
  margin:0 0 2px;
  letter-spacing:0.08em;
  text-transform:uppercase;
}

.mcard-points-value {
  color:#fff;
  font-size:22px;
  font-weight:800;
  margin:0;
  line-height:1;
  text-shadow:0 2px 8px rgba(0,0,0,0.2);
}

.mcard-user {
  display:flex;
  align-items:center;
  gap:12px;
}

.mcard-avatar {
  width:38px;
  height:38px;
  border-radius:12px;
  background:rgba(255,255,255,0.18);
  border:1px solid rgba(255,255,255,0.25);
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:14px;
  font-weight:800;
  color:#fff;
  flex-shrink:0;
  backdrop-filter:blur(6px);
}

.mcard-name {
  color:#fff;
  font-size:16px;
  font-weight:700;
  margin:0 0 3px;
  text-shadow:0 1px 4px rgba(0,0,0,0.2);
}

.mcard-meta {
  display:flex;
  align-items:center;
  gap:8px;
  flex-wrap:wrap;
}

.mcard-id {
  color:rgba(255,255,255,0.52);
  font-size:10px;
  font-family:monospace;
  letter-spacing:0.1em;
}

.mcard-dot {
  color:rgba(255,255,255,0.25);
}

.mcard-since {
  color:rgba(255,255,255,0.52);
  font-size:10px;
}

.mcard-curves {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.mcard-curves svg {
  width: 100%;
  height: 100%;
  display: block;
}
`

function CardCurves({ line1, line2 }: { line1: string; line2: string }) {
  return (
    <div className="mcard-curves" aria-hidden="true">
      <svg viewBox="0 0 800 500" preserveAspectRatio="none">
        <path
          d="M0 110 C130 92, 245 135, 360 122 C510 104, 610 56, 800 92 L800 0 L0 0 Z"
          fill={line1}
        />
        <path
          d="M0 172 C128 154, 246 192, 392 176 C540 160, 642 118, 800 144 L800 92 C634 65, 520 106, 372 124 C236 142 126 98, 0 114 Z"
          fill={line2}
        />
        <path
          d="M0 246 C120 226, 238 262, 380 244 C532 225, 640 182, 800 202 L800 144 C644 118, 536 160, 388 178 C246 196 126 157, 0 174 Z"
          fill={line1}
          opacity="0.82"
        />
        <path
          d="M0 324 C132 310, 248 340, 398 322 C554 302, 664 260, 800 280 L800 204 C656 182, 544 224, 392 246 C244 266 128 230, 0 248 Z"
          fill={line2}
          opacity="0.8"
        />
        <path
          d="M20 140 C156 114, 292 154, 460 136 C590 122, 686 98, 780 110"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M18 222 C160 198, 302 232, 470 214 C598 198, 686 174, 780 184"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

export default function MemberCard({ user }: Props) {
  const tierKey = String(user.tier || 'SILVER').toUpperCase()
  const tc = tierCfg[tierKey as keyof typeof tierCfg] || tierCfg.SILVER
  const cardRef = useRef<HTMLDivElement>(null)

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = cardRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    const rx = ((y / r.height) - 0.5) * -14
    const ry = ((x / r.width)  - 0.5) *  14
    el.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) scale(1.02)`
    el.style.setProperty('--mx', `${(x/r.width*100).toFixed(1)}%`)
    el.style.setProperty('--my', `${(y/r.height*100).toFixed(1)}%`)
  }

  function onLeave() {
    const el = cardRef.current
    if (!el) return
    el.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1)'
    el.style.setProperty('--mx', '50%')
    el.style.setProperty('--my', '50%')
  }

  const initials = (user.full_name || 'D').split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase()

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CARD_CSS }} />
      <div className="mcard-wrap">
        <div
          ref={cardRef}
          className={`mcard-inner tier-${user.tier.toLowerCase()}`}
          style={{ background: tc.gradient, padding:'20px 18px 18px' }}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
        >
          {/* Effects */}
          <CardCurves line1={tc.line1} line2={tc.line2} />
          <div className="mcard-gloss" />
          <div className="mcard-wave" />
          <div className="spark s1" />
          <div className="spark s2" />
          <div className="spark s3" />
          <div className="spark s4" />

          {/* Content */}
          <div className="mcard-shell">
            {/* Top row */}
            <div className="mcard-top">
              <div className="mcard-brand">
                <div className="mcard-chip-wrap"><div className="mcard-chip"/></div>
                <div>
                  <p className="mcard-brand-meta">Dreame Thailand</p>
                  <p className="mcard-brand-label">{tc.label}</p>
                </div>
              </div>

              {/* Points */}
              <div className="mcard-points">
                <p className="mcard-points-label">Points</p>
                <p className="mcard-points-value">
                  {user.total_points.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Avatar + Name */}
            <div className="mcard-user">
              <div className="mcard-avatar">
                {initials}
              </div>
              <div>
                <p className="mcard-name">
                  {user.full_name || 'Dreame Member'}
                </p>
                <div className="mcard-meta">
                  <span className="mcard-id">{user.member_id}</span>
                  <span className="mcard-dot">·</span>
                  <span className="mcard-since">ตั้งแต่ {formatDate(user.created_at)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}