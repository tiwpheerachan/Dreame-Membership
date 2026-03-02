'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700;800&family=Sarabun:wght@300;400;500&display=swap');
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; margin: 0; padding: 0; }
  @keyframes fadeUp   { from { opacity:0; transform:translateY(28px) } to { opacity:1; transform:none } }
  @keyframes fadeIn   { from { opacity:0 } to { opacity:1 } }
  @keyframes floatA   { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-20px) rotate(4deg)} }
  @keyframes floatB   { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-14px) rotate(-3deg)} }
  @keyframes floatC   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
  @keyframes shimmer  { 0%{background-position:200% center} 100%{background-position:-200% center} }
  @keyframes spin     { to{transform:rotate(360deg)} }
  @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:0.6} }
  @keyframes scaleIn  { from{transform:scale(0.92);opacity:0} to{transform:scale(1);opacity:1} }
  .dreame-logo {
    font-family: 'Kanit', sans-serif;
    font-weight: 800;
    background: linear-gradient(135deg, #f59e0b, #fde68a, #d97706, #fbbf24);
    background-size: 300% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: shimmer 4s linear infinite;
  }
`

export default function LandingPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [pressed, setPressed] = useState(false)

  useEffect(() => {
    setTimeout(() => setMounted(true), 80)
  }, [])

  const features = [
    { icon: '⭐', title: 'สะสมคะแนน', desc: 'ทุก ฿100 รับ 1 แต้ม' },
    { icon: '🎁', title: 'สิทธิพิเศษ', desc: 'คูปองและโปรโมชันเฉพาะสมาชิก' },
    { icon: '🛡️', title: 'รับประกันสินค้า', desc: 'ติดตามสถานะประกันได้ทันที' },
    { icon: '💎', title: 'อัปเกรด Tier', desc: 'Silver → Gold → Platinum' },
  ]

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />

      <div style={{
        minHeight: '100vh',
        fontFamily: "'Kanit', sans-serif",
        background: '#0a0a0f',
        overflowX: 'hidden',
        position: 'relative',
      }}>

        {/* ── Ambient background ── */}
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {/* Main glow */}
          <div style={{ position: 'absolute', width: 600, height: 600, top: -150, left: '50%', transform: 'translateX(-50%)', background: 'radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)', borderRadius: '50%', animation: 'floatA 12s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', width: 400, height: 400, bottom: '5%', left: '-10%', background: 'radial-gradient(circle, rgba(251,191,36,0.08) 0%, transparent 70%)', borderRadius: '50%', animation: 'floatB 15s ease-in-out infinite 3s' }} />
          <div style={{ position: 'absolute', width: 300, height: 300, bottom: '20%', right: '-5%', background: 'radial-gradient(circle, rgba(217,119,6,0.1) 0%, transparent 70%)', borderRadius: '50%', animation: 'floatC 10s ease-in-out infinite 1s' }} />
          {/* Grid */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(245,158,11,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(245,158,11,0.03) 1px,transparent 1px)', backgroundSize: '60px 60px', maskImage: 'radial-gradient(ellipse 80% 80% at 50% 20%,black,transparent)' }} />
        </div>

        {/* ── Content ── */}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 480, margin: '0 auto', padding: '0 20px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

          {/* Nav */}
          <div style={{ paddingTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: mounted ? 1 : 0, transition: 'opacity 0.6s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#f59e0b,#d97706)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#000', fontSize: 18, boxShadow: '0 4px 16px rgba(245,158,11,0.4)' }}>D</div>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, letterSpacing: '0.02em' }}>Dreame Thailand</span>
            </div>
            <button onClick={() => router.push('/login')} style={{ color: '#f59e0b', fontSize: 13, fontWeight: 500, fontFamily: "'Kanit',sans-serif", background: 'transparent', border: 'none', cursor: 'pointer', letterSpacing: '0.03em' }}>
              เข้าสู่ระบบ →
            </button>
          </div>

          {/* Hero */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: 48, paddingBottom: 32 }}>

            {/* Badge */}
            <div style={{
              opacity: mounted ? 1 : 0, animation: mounted ? 'fadeUp 0.5s ease 0.1s both' : 'none',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 100, padding: '6px 16px', marginBottom: 24,
              width: 'fit-content',
            }}>
              <div style={{ width: 6, height: 6, background: '#f59e0b', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
              <span style={{ color: '#f59e0b', fontSize: 12, fontWeight: 500, letterSpacing: '0.06em' }}>DREAME MEMBERSHIP PROGRAM</span>
            </div>

            {/* Title */}
            <h1 style={{
              opacity: mounted ? 1 : 0, animation: mounted ? 'fadeUp 0.5s ease 0.18s both' : 'none',
              fontSize: 42, fontWeight: 800, lineHeight: 1.15, marginBottom: 20,
              letterSpacing: '-0.02em',
            }}>
              <span style={{ color: '#fff' }}>สมาชิก</span>
              <br />
              <span className="dreame-logo">Dreame</span>
              <br />
              <span style={{ color: '#fff' }}>พิเศษกว่าใคร</span>
            </h1>

            {/* Sub */}
            <p style={{
              opacity: mounted ? 1 : 0, animation: mounted ? 'fadeUp 0.5s ease 0.25s both' : 'none',
              color: '#6b7280', fontSize: 15, lineHeight: 1.7, marginBottom: 40,
              fontFamily: "'Sarabun', sans-serif", fontWeight: 400,
            }}>
              สะสมแต้ม รับสิทธิพิเศษ และติดตาม<br />ประกันสินค้าทุกชิ้นในที่เดียว
            </p>

            {/* CTA Button */}
            <div style={{ opacity: mounted ? 1 : 0, animation: mounted ? 'fadeUp 0.5s ease 0.32s both' : 'none', marginBottom: 16 }}>
              <button
                onClick={() => router.push('/login')}
                onPointerDown={() => setPressed(true)}
                onPointerUp={() => setPressed(false)}
                onPointerLeave={() => setPressed(false)}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                  border: 'none',
                  borderRadius: 18,
                  padding: '18px 0',
                  fontSize: 17,
                  fontWeight: 700,
                  fontFamily: "'Kanit', sans-serif",
                  color: '#000',
                  cursor: 'pointer',
                  letterSpacing: '0.03em',
                  transform: pressed ? 'scale(0.97)' : 'scale(1)',
                  transition: 'transform 0.12s cubic-bezier(0.34,1.56,0.64,1)',
                  boxShadow: pressed ? '0 4px 20px rgba(245,158,11,0.3)' : '0 8px 40px rgba(245,158,11,0.45)',
                }}
              >
                เริ่มต้นเลย →
              </button>
            </div>

            {/* Secondary */}
            <div style={{ opacity: mounted ? 1 : 0, animation: mounted ? 'fadeUp 0.5s ease 0.38s both' : 'none', textAlign: 'center' }}>
              <span style={{ color: '#4b5563', fontSize: 13, fontFamily: "'Sarabun',sans-serif" }}>มีบัญชีอยู่แล้ว? </span>
              <button onClick={() => router.push('/login')} style={{ color: '#f59e0b', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Kanit',sans-serif" }}>เข้าสู่ระบบ</button>
            </div>

            {/* Divider */}
            <div style={{ opacity: mounted ? 1 : 0, animation: mounted ? 'fadeUp 0.5s ease 0.42s both' : 'none', margin: '36px 0 28px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
              <span style={{ color: '#374151', fontSize: 11, letterSpacing: '0.1em', fontFamily: "'Sarabun',sans-serif" }}>สิทธิประโยชน์สมาชิก</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
            </div>

            {/* Feature grid */}
            <div style={{
              opacity: mounted ? 1 : 0, animation: mounted ? 'fadeUp 0.5s ease 0.48s both' : 'none',
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
            }}>
              {features.map((f, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 16, padding: '16px 14px',
                  transition: 'border-color 0.2s, background 0.2s',
                }}>
                  <span style={{ fontSize: 24, display: 'block', marginBottom: 8 }}>{f.icon}</span>
                  <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{f.title}</p>
                  <p style={{ color: '#6b7280', fontSize: 11, fontFamily: "'Sarabun',sans-serif", lineHeight: 1.4 }}>{f.desc}</p>
                </div>
              ))}
            </div>

            {/* Tier badges */}
            <div style={{
              opacity: mounted ? 1 : 0, animation: mounted ? 'fadeUp 0.5s ease 0.54s both' : 'none',
              marginTop: 24, display: 'flex', gap: 8, justifyContent: 'center',
            }}>
              {[
                { name: 'Silver', color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.2)' },
                { name: 'Gold',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)' },
                { name: 'Platinum', color: '#67e8f9', bg: 'rgba(103,232,249,0.1)', border: 'rgba(103,232,249,0.25)' },
              ].map(t => (
                <div key={t.name} style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 100, padding: '5px 14px' }}>
                  <span style={{ color: t.color, fontSize: 12, fontWeight: 600 }}>{t.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ paddingBottom: 28, textAlign: 'center', opacity: 0.4 }}>
            <p style={{ color: '#6b7280', fontSize: 11, fontFamily: "'Sarabun',sans-serif" }}>
              © 2026 Dreame Thailand · <button onClick={() => router.push('/terms')} style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: "'Sarabun',sans-serif", textDecoration: 'underline' }}>นโยบายและเงื่อนไข</button>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}