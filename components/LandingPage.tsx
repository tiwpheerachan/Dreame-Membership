'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Star, Shield, Gift, TrendingUp, ArrowRight, Sparkles } from 'lucide-react'

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700;800&display=swap');
  * { -webkit-tap-highlight-color:transparent; box-sizing:border-box; margin:0; padding:0; }
  @keyframes fadeUp { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:none} }
  @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.5} }
  .lp { min-height:100vh; background:#fafaf8; font-family:'Prompt',system-ui,sans-serif; overflow-x:hidden; }
  .lp-nav { padding:20px 24px; display:flex; align-items:center; justify-content:space-between; }
  .logo-box { width:36px; height:36px; background:#0d0d0d; border-radius:10px;
    display:flex; align-items:center; justify-content:center; }
  .logo-d { color:#d4af37; font-size:18px; font-weight:900; }
  .lp-hero { padding:40px 24px 32px; }
  .lp-badge { display:inline-flex; align-items:center; gap:7px; padding:6px 14px;
    background:#fff; border:1px solid #e5e7eb; border-radius:100px;
    font-size:11px; font-weight:600; color:#374151; margin-bottom:28px;
    box-shadow:0 1px 4px rgba(0,0,0,0.06); }
  .lp-title { font-size:38px; font-weight:800; line-height:1.15; letter-spacing:-0.02em;
    color:#0d0d0d; margin-bottom:16px; }
  .lp-title-gold { color:#b8860b; }
  .lp-sub { font-size:15px; color:#6b7280; line-height:1.7; margin-bottom:36px; font-weight:400; }
  .btn-primary { width:100%; padding:16px; background:#0d0d0d; color:#d4af37;
    border:none; border-radius:16px; font-size:16px; font-weight:700;
    font-family:inherit; cursor:pointer; display:flex; align-items:center;
    justify-content:center; gap:8px; transition:transform 0.12s; }
  .btn-outline { width:100%; padding:14px; background:#fff; color:#374151;
    border:1.5px solid #e5e7eb; border-radius:16px; font-size:14px; font-weight:600;
    font-family:inherit; cursor:pointer; margin-top:10px; transition:border-color 0.15s; }
  .lp-feats { padding:0 24px 32px; display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .feat-card { background:#fff; border-radius:18px; padding:18px 16px;
    box-shadow:0 1px 4px rgba(0,0,0,0.05); border:1px solid #f0f0ee; }
  .feat-ico { width:38px; height:38px; border-radius:11px; display:flex;
    align-items:center; justify-content:center; margin-bottom:10px; }
  .lp-tiers { padding:0 24px 32px; }
  .tier-row { display:flex; gap:8px; }
  .tier-pill { flex:1; padding:10px 8px; border-radius:12px; text-align:center;
    font-size:11px; font-weight:700; }
  .divider { margin:0 24px 28px; height:1px; background:#f0f0ee; }
  .sec-label { padding:0 24px; font-size:11px; font-weight:700; color:#9ca3af;
    letter-spacing:0.08em; text-transform:uppercase; margin-bottom:14px; }
  .lp-footer { padding:20px 24px 36px; text-align:center; }
`

export default function LandingPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setTimeout(() => setMounted(true), 60) }, [])

  const features = [
    { ico: <Star size={18} color="#b8860b"/>,    bg:'#fffbeb', title:'สะสมคะแนน',     desc:'ทุก ฿100 รับ 1 แต้ม' },
    { ico: <Gift size={18} color="#7c3aed"/>,    bg:'#f5f3ff', title:'สิทธิพิเศษ',    desc:'คูปองและโปรโมชัน' },
    { ico: <Shield size={18} color="#0891b2"/>,  bg:'#eff6ff', title:'รับประกันสินค้า', desc:'ติดตามสถานะประกัน' },
    { ico: <TrendingUp size={18} color="#16a34a"/>, bg:'#f0fdf4', title:'อัปเกรด Tier',  desc:'Silver → Gold → Platinum' },
  ]

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }}/>
      <div className="lp">

        {/* Nav */}
        <div className="lp-nav" style={{ opacity: mounted ? 1 : 0, transition:'opacity 0.5s' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div className="logo-box"><span className="logo-d">D</span></div>
            <span style={{ fontWeight:700, fontSize:15, color:'#0d0d0d' }}>Dreame Thailand</span>
          </div>
          <button onClick={() => router.push('/login')}
            style={{ background:'none', border:'none', cursor:'pointer',
              fontSize:13, fontWeight:600, color:'#6b7280', fontFamily:'inherit' }}>
            เข้าสู่ระบบ
          </button>
        </div>

        {/* Hero */}
        <div className="lp-hero">
          <div className="lp-badge" style={{ opacity: mounted ? 1 : 0, animation: mounted ? 'fadeUp 0.45s ease 0.05s both' : 'none' }}>
            <div style={{ width:6, height:6, background:'#16a34a', borderRadius:'50%', animation:'pulse 2s infinite' }}/>
            DREAME MEMBERSHIP PROGRAM
          </div>

          <h1 className="lp-title" style={{ opacity: mounted ? 1 : 0, animation: mounted ? 'fadeUp 0.45s ease 0.12s both' : 'none' }}>
            ยกระดับ<br/>
            <span className="lp-title-gold">ประสบการณ์</span><br/>
            สมาชิก Dreame
          </h1>

          <p className="lp-sub" style={{ opacity: mounted ? 1 : 0, animation: mounted ? 'fadeUp 0.45s ease 0.18s both' : 'none' }}>
            สะสมแต้ม รับสิทธิพิเศษ และติดตาม<br/>ประกันสินค้าทุกชิ้นในที่เดียว
          </p>

          <div style={{ opacity: mounted ? 1 : 0, animation: mounted ? 'fadeUp 0.45s ease 0.24s both' : 'none' }}>
            <button className="btn-primary" onClick={() => router.push('/login')}>
              เริ่มต้นเลย <ArrowRight size={16}/>
            </button>
            <button className="btn-outline" onClick={() => router.push('/login')}>
              มีบัญชีอยู่แล้ว? เข้าสู่ระบบ
            </button>
          </div>
        </div>

        {/* Tier strip */}
        <div style={{ padding:'0 24px 28px', opacity: mounted ? 1 : 0, animation: mounted ? 'fadeUp 0.45s ease 0.3s both' : 'none' }}>
          <div className="tier-row">
            <div className="tier-pill" style={{ background:'#f7f7f5', color:'#6b7280' }}>Silver</div>
            <div className="tier-pill" style={{ background:'#fffbeb', color:'#92600a' }}>Gold</div>
            <div className="tier-pill" style={{ background:'#f0fdff', color:'#0e7490' }}>Platinum</div>
          </div>
        </div>

        <div className="divider"/>

        {/* Features */}
        <p className="sec-label" style={{ opacity: mounted ? 1 : 0, animation: mounted ? 'fadeUp 0.45s ease 0.34s both' : 'none' }}>
          สิทธิประโยชน์
        </p>
        <div className="lp-feats" style={{ opacity: mounted ? 1 : 0, animation: mounted ? 'fadeUp 0.45s ease 0.38s both' : 'none' }}>
          {features.map((f, i) => (
            <div key={i} className="feat-card">
              <div className="feat-ico" style={{ background: f.bg }}>{f.ico}</div>
              <p style={{ fontSize:13, fontWeight:700, color:'#111', marginBottom:3 }}>{f.title}</p>
              <p style={{ fontSize:11, color:'#9ca3af', lineHeight:1.4 }}>{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="lp-footer" style={{ opacity: mounted ? 1 : 0, animation: mounted ? 'fadeUp 0.45s ease 0.44s both' : 'none' }}>
          <p style={{ color:'#9ca3af', fontSize:11 }}>
            © 2026 Dreame Thailand ·{' '}
            <button onClick={() => router.push('/terms')}
              style={{ color:'#9ca3af', background:'none', border:'none', cursor:'pointer',
                fontSize:11, fontFamily:'inherit', textDecoration:'underline' }}>
              นโยบายและเงื่อนไข
            </button>
          </p>
        </div>
      </div>
    </>
  )
}