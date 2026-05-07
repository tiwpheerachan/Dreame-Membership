'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// Landing-specific key visual. Already carries the DREAME wordmark, so we
// no longer overlay a separate logo. Sized 1:2-ish (tall portrait) to fit
// the mobile splash without cropping the models or the hero products.
const BG_IMAGE = '/images/landing-bg.png'

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700;800&display=swap');
  *, *::before, *::after { -webkit-tap-highlight-color:transparent; box-sizing:border-box; margin:0; padding:0; }

  @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  /* Cascading chevrons: each arrow rises, fades, repeats.
     Three of them with offset delays makes a continuous gold-ribbon stream. */
  @keyframes chevronRise {
    0%   { opacity: 0; transform: translate(-50%, 22px) scale(0.85); }
    18%  { opacity: 1; transform: translate(-50%, 10px) scale(1); }
    55%  { opacity: 0.55; transform: translate(-50%, -12px) scale(1); }
    100% { opacity: 0; transform: translate(-50%, -34px) scale(0.92); }
  }
  /* Hand grabber bar — subtle pulse so the "swipe me" affordance is alive */
  @keyframes grabberPulse {
    0%, 100% { opacity: 0.35; transform: translateX(-50%) scaleX(1); }
    50%      { opacity: 0.85; transform: translateX(-50%) scaleX(1.15); }
  }

  .lp-root {
    position: fixed; inset: 0;
    font-family: 'Prompt', system-ui, sans-serif;
    overflow: hidden;
    max-width: 768px;
    margin: 0 auto;
    background: #ECE0CC;
  }

  /* BG image — same key visual as the login page, anchored top so the
     mascot/wordmark stays clear and the soft cream lower portion gets
     the blur fade for the swipe-up area. */
  .lp-bg {
    position: absolute; inset: 0; z-index: 0;
  }
  .lp-bg img {
    width: 100%; height: 100%;
    object-fit: cover; object-position: center top;
    transition: transform 0.6s cubic-bezier(0.4,0,0.2,1);
  }
  .lp-bg img.lift { transform: translateY(-8%); }

  /* Gradient-masked backdrop blur — most of the image stays clear, only
     the bottom strip frosts so the swipe-up text reads. Lighter blur and
     a much later mask start so the models and products aren't covered. */
  .lp-blur-veil {
    position: absolute; inset: 0; z-index: 1;
    backdrop-filter: blur(14px) saturate(1.15);
    -webkit-backdrop-filter: blur(14px) saturate(1.15);
    mask-image: linear-gradient(to bottom,
      transparent 0%,
      transparent 78%,
      rgba(0,0,0,0.5) 88%,
      black 96%);
    -webkit-mask-image: linear-gradient(to bottom,
      transparent 0%,
      transparent 78%,
      rgba(0,0,0,0.5) 88%,
      black 96%);
  }
  /* Cream wash — only over the small frosted strip, kept light */
  .lp-tint {
    position: absolute; inset: 0; z-index: 2; pointer-events: none;
    background: linear-gradient(to bottom,
      rgba(255,250,240,0) 76%,
      rgba(255,250,240,0.20) 86%,
      rgba(255,250,240,0.55) 94%,
      rgba(255,250,240,0.78) 100%);
  }

  /* Bottom swipe-up indicator */
  .lp-bottom {
    position: absolute; bottom: 0; left: 0; right: 0; z-index: 3;
    padding: 0 0 max(env(safe-area-inset-bottom, 28px), 32px);
    display: flex; flex-direction: column; align-items: center; gap: 0;
    cursor: pointer; user-select: none;
  }

  /* Top grabber — small gold bar that pulses, signals "drag-up affordance" */
  .lp-grabber {
    width: 44px; height: 4px; border-radius: 4px;
    background: linear-gradient(90deg, transparent, #A0782B, transparent);
    margin-bottom: 22px;
    animation: grabberPulse 2.4s ease-in-out infinite, fadeIn 1s ease 0.6s both;
    transform-origin: center;
  }

  /* Cascading rising chevrons — 3 stacked arrows that each rise + fade */
  .lp-rise-stack {
    position: relative;
    width: 26px; height: 38px;
    margin-bottom: 14px;
    animation: fadeIn 0.8s ease 0.7s both;
  }
  .lp-rise-arrow {
    position: absolute; top: 0; left: 50%;
    width: 24px; height: 13px;
    animation: chevronRise 2.4s ease-in-out infinite;
  }
  .lp-rise-arrow svg {
    width: 24px; height: 13px;
    stroke: #A0782B; stroke-width: 2.4;
    fill: none; stroke-linecap: round; stroke-linejoin: round;
    filter: drop-shadow(0 1px 2px rgba(160,120,43,0.30));
  }
  .lp-rise-arrow:nth-child(1) { animation-delay: 0s;   }
  .lp-rise-arrow:nth-child(2) { animation-delay: 0.8s; }
  .lp-rise-arrow:nth-child(3) { animation-delay: 1.6s; }

  /* "SWIPE UP" gold-shimmer label */
  .lp-swipe-label {
    font-size: 11px; font-weight: 800;
    letter-spacing: 0.32em; text-transform: uppercase;
    background: linear-gradient(90deg, #8C5A14, #C9A063, #FAF3DC, #C9A063, #8C5A14);
    background-size: 300% auto;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    animation: shimmer 3.2s linear infinite, fadeIn 1s ease 0.85s both;
    margin-bottom: 6px;
  }

  /* Thai hint text */
  .lp-hint {
    font-size: 12px; font-weight: 500;
    letter-spacing: 0.04em;
    color: rgba(40,38,32,0.62);
    animation: fadeIn 1s ease 1s both;
  }

  /* Slide-up transition overlay when navigating to /login */
  .lp-transition {
    position: absolute; inset: 0; z-index: 10;
    background: #0d0d0d;
    transform: translateY(100%);
    transition: transform 0.55s cubic-bezier(0.4,0,0.2,1);
  }
  .lp-transition.active {
    transform: translateY(0);
  }
`

function ArrowUp() {
  return (
    <svg viewBox="0 0 22 13">
      <polyline points="1,12 11,2 21,12" />
    </svg>
  )
}

export default function LandingPage() {
  const router = useRouter()
  const [mounted, setMounted]     = useState(false)
  const [lifting, setLifting]     = useState(false)
  const [transitioning, setTrans] = useState(false)

  // Touch / drag tracking
  const touchStartY = useRef<number | null>(null)
  const isDragging  = useRef(false)

  useEffect(() => {
    setTimeout(() => setMounted(true), 60)
  }, [])

  function goToLogin() {
    if (transitioning) return
    setLifting(true)
    setTrans(true)
    setTimeout(() => router.push('/login'), 520)
  }

  // Touch swipe up
  function onTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY
    isDragging.current = false
  }
  function onTouchMove(e: React.TouchEvent) {
    if (touchStartY.current === null) return
    const dy = touchStartY.current - e.changedTouches[0].clientY
    if (dy > 8) isDragging.current = true
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartY.current === null) return
    const dy = touchStartY.current - e.changedTouches[0].clientY
    touchStartY.current = null
    if (dy > 50) goToLogin()   // swipe up threshold 50px
    isDragging.current = false
  }

  // Mouse drag (desktop/tablet)
  const mouseStartY = useRef<number | null>(null)
  function onMouseDown(e: React.MouseEvent) {
    mouseStartY.current = e.clientY
  }
  function onMouseUp(e: React.MouseEvent) {
    if (mouseStartY.current === null) return
    const dy = mouseStartY.current - e.clientY
    mouseStartY.current = null
    if (dy > 40) goToLogin()
  }

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />

      <div
        className="lp-root"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
      >
        {/* Layer 1 — Background image (same key visual as the login page) */}
        <div className="lp-bg">
          <img
            src={BG_IMAGE}
            alt=""
            draggable={false}
            className={lifting ? 'lift' : ''}
          />
        </div>

        {/* Layer 2 — Gradient-masked backdrop blur (top sharp, bottom frosted) */}
        <div aria-hidden className="lp-blur-veil" />
        {/* Layer 3 — Cream wash for legibility on the blurred lower half */}
        <div aria-hidden className="lp-tint" />

        {/* Bottom swipe-up indicator */}
        <div
          className="lp-bottom"
          onClick={goToLogin}
          style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.6s 0.4s' }}
        >
          {/* Pulsing grabber — signals drag affordance */}
          <div aria-hidden className="lp-grabber" />

          {/* Three rising chevrons (cascading delays) */}
          <div className="lp-rise-stack" aria-hidden>
            <div className="lp-rise-arrow"><ArrowUp /></div>
            <div className="lp-rise-arrow"><ArrowUp /></div>
            <div className="lp-rise-arrow"><ArrowUp /></div>
          </div>

          <p className="lp-swipe-label">Swipe Up</p>
          <p className="lp-hint">เลื่อนขึ้นหรือแตะเพื่อเข้าสู่ระบบ</p>
        </div>

        {/* Slide-up transition overlay */}
        <div className={`lp-transition ${transitioning ? 'active' : ''}`} />
      </div>
    </>
  )
}