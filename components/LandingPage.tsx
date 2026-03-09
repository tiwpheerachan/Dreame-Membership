'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// ── วางรูปพื้นหลังที่ public/images/landing-bg.jpg ──
const BG_IMAGE = '/images/landing-bg.jpg'
const LOGO_URL = 'https://mlvtgiqzoszz.i.optimole.com/cb:QxkM.102a3/w:134/h:40/q:mauto/dpr:2.6/f:best/https://www.appliancecity.co.uk/wp-content/uploads/2025/09/dreame-main-logo-1000x300-1.png'

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700;800&display=swap');
  *, *::before, *::after { -webkit-tap-highlight-color:transparent; box-sizing:border-box; margin:0; padding:0; }

  @keyframes arrowBounce {
    0%   { transform:translateY(0);   opacity:0.3; }
    40%  { transform:translateY(-10px); opacity:1;   }
    80%  { transform:translateY(0);   opacity:0.3; }
    100% { transform:translateY(0);   opacity:0.3; }
  }
  @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes glow {
    0%,100% { text-shadow: 0 0 20px rgba(212,175,55,0.4); }
    50%     { text-shadow: 0 0 40px rgba(212,175,55,0.9), 0 0 80px rgba(212,175,55,0.3); }
  }
  @keyframes slideUp {
    from { transform:translateY(100%); }
    to   { transform:translateY(0); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }

  .lp-root {
    position: fixed; inset: 0;
    font-family: 'Prompt', system-ui, sans-serif;
    overflow: hidden;
    max-width: 768px;
    margin: 0 auto;
  }

  /* BG image fills entire screen */
  .lp-bg {
    position: absolute; inset: 0; z-index: 0;
  }
  .lp-bg img {
    width: 100%; height: 100%;
    object-fit: cover; object-position: center;
    transition: transform 0.6s cubic-bezier(0.4,0,0.2,1);
  }
  .lp-bg img.lift {
    transform: translateY(-8%);
  }
  .lp-gradient {
    position: absolute; inset: 0;
    background: linear-gradient(
      to bottom,
      rgba(0,0,0,0.15) 0%,
      rgba(0,0,0,0.0)  35%,
      rgba(0,0,0,0.0)  55%,
      rgba(0,0,0,0.65) 80%,
      rgba(0,0,0,0.88) 100%
    );
  }

  /* Logo top center */
  .lp-logo {
    position: absolute; top: 0; left: 0; right: 0; z-index: 2;
    padding: 52px 0 0;
    display: flex; justify-content: center;
    animation: fadeIn 0.8s ease 0.3s both;
  }

  /* Bottom hint area */
  .lp-bottom {
    position: absolute; bottom: 0; left: 0; right: 0; z-index: 2;
    padding: 0 0 max(env(safe-area-inset-bottom, 32px), 36px);
    display: flex; flex-direction: column; align-items: center; gap: 0;
    cursor: pointer; user-select: none;
  }

  /* Swipe hint text */
  .lp-hint {
    font-size: 11px; font-weight: 600;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: rgba(255,255,255,0.55);
    margin-bottom: 10px;
    animation: fadeIn 1s ease 0.8s both;
  }

  /* Arrows container */
  .lp-arrows {
    display: flex; flex-direction: column; align-items: center;
    gap: 2px; margin-bottom: 8px;
  }

  /* Each arrow chevron */
  .lp-arrow {
    width: 22px; height: 13px;
    display: flex; align-items: center; justify-content: center;
  }
  .lp-arrow svg {
    width: 22px; height: 13px;
    stroke: #d4af37; stroke-width: 2.5px;
    fill: none; stroke-linecap: round; stroke-linejoin: round;
  }
  .lp-arrow:nth-child(1) { animation: arrowBounce 1.6s ease-in-out infinite 0.0s; }
  .lp-arrow:nth-child(2) { animation: arrowBounce 1.6s ease-in-out infinite 0.2s; }
  .lp-arrow:nth-child(3) { animation: arrowBounce 1.6s ease-in-out infinite 0.4s; }

  /* Swipe up label */
  .lp-swipe-label {
    font-size: 13px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    background: linear-gradient(90deg, #b8860b, #f0d060, #d4af37, #f0d060, #b8860b);
    background-size: 300% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: shimmer 3s linear infinite, fadeIn 1s ease 0.8s both;
    margin-bottom: 6px;
  }

  /* Thin gold line at very bottom */
  .lp-line {
    width: 40px; height: 4px; border-radius: 4px;
    background: rgba(212,175,55,0.45);
    animation: fadeIn 1s ease 1s both;
  }

  /* Transition overlay when navigating */
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
        {/* Background image */}
        <div className="lp-bg">
          <img
            src={BG_IMAGE}
            alt=""
            draggable={false}
            className={lifting ? 'lift' : ''}
          />
          <div className="lp-gradient" />
        </div>

        {/* Logo */}
        <div className="lp-logo" style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.6s' }}>
          <img
            src={LOGO_URL}
            alt="Dreame"
            style={{ height: 36, objectFit: 'contain', filter: 'brightness(0) invert(1)', maxWidth: 200 }}
            draggable={false}
          />
        </div>

        {/* Bottom swipe hint */}
        <div
          className="lp-bottom"
          onClick={goToLogin}
          style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.6s 0.4s' }}
        >
          <p className="lp-hint">เลื่อนขึ้นหรือแตะเพื่อเข้าสู่ระบบ</p>

          <div className="lp-arrows">
            <div className="lp-arrow"><ArrowUp /></div>
            <div className="lp-arrow"><ArrowUp /></div>
            <div className="lp-arrow"><ArrowUp /></div>
          </div>

          <p className="lp-swipe-label">Swipe Up</p>
          <div className="lp-line" />
        </div>

        {/* Slide-up transition overlay */}
        <div className={`lp-transition ${transitioning ? 'active' : ''}`} />
      </div>
    </>
  )
}