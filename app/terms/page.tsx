'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function TermsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [mounted, setMounted] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
    // ตรวจสอบว่า user นี้ยอมรับ terms แล้วหรือยัง
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }
      const { data: user } = await supabase.from('users').select('terms_accepted_at').eq('id', session.user.id).single()
      if (user?.terms_accepted_at) {
        // ยอมรับแล้ว → ไปหน้าหลักเลย
        router.push('/home')
        return
      }
      setChecking(false)
    }
    check()
  }, [])

  function onScroll() {
    const el = scrollRef.current
    if (!el) return
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 60
    if (nearBottom) setScrolled(true)
  }

  async function handleAccept() {
    if (!accepted) return
    setLoading(true)
    const res = await fetch('/api/users/accept-terms', { method: 'POST' })
    if (res.ok) {
      router.push('/home')
    } else {
      setLoading(false)
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่')
    }
  }

  if (checking) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: '3px solid rgba(245,158,11,0.2)', borderTop: '3px solid #f59e0b', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700;800&family=Sarabun:wght@300;400;500;600&display=swap');
        * { -webkit-tap-highlight-color:transparent; box-sizing:border-box; margin:0; padding:0; }
        @keyframes spin     { to{transform:rotate(360deg)} }
        @keyframes fadeUp   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
        @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
        @keyframes shimmer  { 0%{background-position:200% center} 100%{background-position:-200% center} }
        .terms-scroll::-webkit-scrollbar { width: 4px }
        .terms-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.03) }
        .terms-scroll::-webkit-scrollbar-thumb { background: rgba(245,158,11,0.3); border-radius: 4px }
        .section-title {
          font-family:'Kanit',sans-serif; font-weight:700; font-size:15px;
          color:#f59e0b; margin-bottom:10px; margin-top:28px;
          display:flex; align-items:center; gap:8px;
        }
        .section-body {
          font-family:'Sarabun',sans-serif; font-size:14px;
          color:#9ca3af; line-height:1.85;
        }
        .section-body li { margin-left:18px; margin-bottom:6px; }
        .highlight-box {
          background: rgba(245,158,11,0.07);
          border: 1px solid rgba(245,158,11,0.18);
          border-radius:12px; padding:14px 16px;
          margin:12px 0;
        }
      `}</style>

      <div style={{ minHeight:'100vh', background:'#0a0a0f', fontFamily:"'Kanit',sans-serif", display:'flex', flexDirection:'column', maxWidth:520, margin:'0 auto', padding:'0 0 0 0' }}>

        {/* Header */}
        <div style={{ padding:'20px 20px 0', animation: mounted ? 'fadeUp 0.4s ease' : 'none', opacity: mounted ? 1 : 0 }}>
          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:24 }}>
            <div style={{ width:34, height:34, background:'linear-gradient(135deg,#f59e0b,#d97706)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'#000', fontSize:16, boxShadow:'0 4px 16px rgba(245,158,11,0.35)' }}>D</div>
            <span style={{ color:'#fff', fontWeight:700, fontSize:15 }}>Dreame Thailand</span>
          </div>

          {/* Title */}
          <div style={{ background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.15)', borderRadius:16, padding:'20px 18px', marginBottom:16 }}>
            <p style={{ color:'#f59e0b', fontSize:11, fontWeight:600, letterSpacing:'0.1em', marginBottom:8 }}>ก่อนเริ่มต้นใช้งาน</p>
            <h1 style={{ color:'#fff', fontSize:22, fontWeight:800, lineHeight:1.3, marginBottom:6 }}>
              นโยบายและเงื่อนไข<br />การเป็นสมาชิก
            </h1>
            <p style={{ color:'#6b7280', fontSize:13, fontFamily:"'Sarabun',sans-serif", lineHeight:1.6 }}>
              โปรดอ่านและยอมรับข้อกำหนดเหล่านี้<br />เพื่อเริ่มใช้งาน Dreame Membership
            </p>
          </div>

          {/* Scroll hint */}
          {!scrolled && (
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8, opacity:0.6 }}>
              <div style={{ width:16, height:16, borderRadius:'50%', background:'rgba(245,158,11,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9 }}>↓</div>
              <p style={{ color:'#6b7280', fontSize:11, fontFamily:"'Sarabun',sans-serif" }}>เลื่อนอ่านให้ครบก่อนกดยอมรับ</p>
            </div>
          )}
        </div>

        {/* Scrollable Terms */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="terms-scroll"
          style={{ flex:1, overflowY:'auto', padding:'0 20px 16px', maxHeight:'calc(100vh - 280px)' }}
        >
          <div style={{ paddingTop:4, paddingBottom:8 }}>

            {/* ── 1. ข้อมูลทั่วไป ── */}
            <p className="section-title">📋 1. ข้อมูลทั่วไปเกี่ยวกับโปรแกรม</p>
            <p className="section-body">
              โปรแกรม <strong style={{color:'#e5e7eb'}}>Dreame Thailand Membership Program</strong> ("โปรแกรม") บริหารจัดการโดย SHD Technology Co., Ltd. ผู้แทนจำหน่ายอย่างเป็นทางการของ Dreame Technology ในประเทศไทย โปรแกรมนี้ออกแบบมาเพื่อมอบสิทธิประโยชน์พิเศษให้กับลูกค้าที่ซื้อสินค้า Dreame ผ่านช่องทางที่กำหนด
            </p>

            {/* ── 2. สิทธิ์การสมัคร ── */}
            <p className="section-title">👤 2. คุณสมบัติผู้สมัคร</p>
            <p className="section-body">
              เพื่อสมัครเป็นสมาชิก ท่านต้อง:
              <ul style={{marginTop:8}}>
                <li>มีอายุไม่ต่ำกว่า 18 ปีบริบูรณ์</li>
                <li>มีหมายเลขโทรศัพท์มือถือหรืออีเมลที่ใช้งานได้จริงในประเทศไทย</li>
                <li>ซื้อสินค้า Dreame ผ่านช่องทางที่รับรอง ได้แก่ Shopee, Lazada, Website, TikTok Shop หรือร้านค้าที่เข้าร่วมโครงการ</li>
                <li>ยินยอมให้ข้อมูลส่วนบุคคลเพื่อการดำเนินการตามวัตถุประสงค์ของโปรแกรม</li>
              </ul>
            </p>

            {/* ── 3. การสะสมแต้ม ── */}
            <p className="section-title">⭐ 3. การสะสมคะแนน (Points)</p>
            <div className="highlight-box">
              <p style={{color:'#f59e0b', fontSize:13, fontFamily:"'Sarabun',sans-serif", fontWeight:600, marginBottom:6}}>อัตราการสะสมคะแนน</p>
              <p style={{color:'#d1d5db', fontSize:13, fontFamily:"'Sarabun',sans-serif", lineHeight:1.7}}>
                ทุกการซื้อสินค้า Dreame ที่ผ่านการตรวจสอบ ท่านจะได้รับคะแนน <strong>1 แต้ม ต่อทุกการใช้จ่าย 100 บาท</strong> (ปัดเศษลง) โดยคะแนนจะถูกเพิ่มเข้าบัญชีภายใน 3-7 วันทำการหลังจากได้รับการอนุมัติ
              </p>
            </div>
            <p className="section-body">
              <ul>
                <li>คะแนนจะไม่หมดอายุตราบใดที่บัญชีมีการใช้งานอย่างน้อย 1 ครั้งต่อปี</li>
                <li>คะแนนไม่สามารถโอนให้ผู้อื่นหรือแปลงเป็นเงินสดได้</li>
                <li>การยกเลิกหรือคืนสินค้าจะส่งผลให้คะแนนที่ได้รับถูกหักออกตามสัดส่วน</li>
                <li>บริษัทขอสงวนสิทธิ์ในการปรับเปลี่ยนอัตราการสะสมคะแนนโดยแจ้งล่วงหน้า</li>
              </ul>
            </p>

            {/* ── 4. ระดับสมาชิก ── */}
            <p className="section-title">💎 4. ระดับสมาชิก (Tier)</p>
            <p className="section-body" style={{marginBottom:10}}>ระดับสมาชิกกำหนดจากคะแนนสะสมตลอดการเป็นสมาชิก (Lifetime Points):</p>
            {[
              { tier:'🥈 Silver', range:'0 – 499 แต้ม', perks:'สิทธิ์พื้นฐาน, ลงทะเบียนสินค้า' },
              { tier:'🥇 Gold',   range:'500 – 1,999 แต้ม', perks:'+ ส่วนลดพิเศษ, คูปองวันเกิด' },
              { tier:'💎 Platinum', range:'2,000 แต้มขึ้นไป', perks:'+ Priority Support, สิทธิ์ทดลองสินค้าใหม่' },
            ].map(t => (
              <div key={t.tier} style={{ display:'flex', gap:10, marginBottom:8, background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'10px 12px', border:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ flex:1 }}>
                  <p style={{ color:'#e5e7eb', fontSize:13, fontWeight:600, fontFamily:"'Kanit',sans-serif" }}>{t.tier}</p>
                  <p style={{ color:'#f59e0b', fontSize:11, fontFamily:"'Sarabun',sans-serif" }}>{t.range}</p>
                  <p style={{ color:'#9ca3af', fontSize:11, fontFamily:"'Sarabun',sans-serif", marginTop:2 }}>{t.perks}</p>
                </div>
              </div>
            ))}

            {/* ── 5. การตรวจสอบสินค้า ── */}
            <p className="section-title">🛡️ 5. การลงทะเบียนและตรวจสอบสินค้า</p>
            <p className="section-body">
              <ul>
                <li>ท่านสามารถลงทะเบียนสินค้าได้ภายใน <strong style={{color:'#e5e7eb'}}>90 วัน</strong> นับจากวันที่ซื้อ</li>
                <li>กรุณาแนบหลักฐานการซื้อ (ใบเสร็จ / Order Confirmation) ที่ชัดเจนทุกครั้ง</li>
                <li>สินค้า 1 ชิ้นสามารถลงทะเบียนได้เพียง 1 ครั้งเท่านั้น</li>
                <li>บริษัทขอสงวนสิทธิ์ปฏิเสธการลงทะเบียนที่ไม่เป็นไปตามเงื่อนไข</li>
                <li>ระยะเวลาการตรวจสอบ 3–7 วันทำการ</li>
              </ul>
            </p>

            {/* ── 6. ข้อมูลส่วนบุคคล ── */}
            <p className="section-title">🔒 6. นโยบายความเป็นส่วนตัวและข้อมูลส่วนบุคคล</p>
            <div className="highlight-box">
              <p style={{color:'#9ca3af', fontSize:13, fontFamily:"'Sarabun',sans-serif", lineHeight:1.7}}>
                ข้อมูลของท่านจะถูกเก็บรวบรวมและประมวลผลตาม <strong style={{color:'#e5e7eb'}}>พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)</strong> เพื่อวัตถุประสงค์ในการดำเนินโปรแกรมสมาชิก การสื่อสาร และการให้บริการเท่านั้น
              </p>
            </div>
            <p className="section-body">
              ข้อมูลที่เก็บรวบรวม ได้แก่:
              <ul style={{marginTop:8}}>
                <li>ชื่อ-นามสกุล, อีเมล, เบอร์โทรศัพท์</li>
                <li>ประวัติการซื้อและลงทะเบียนสินค้า</li>
                <li>พฤติกรรมการใช้งานแอปพลิเคชัน</li>
              </ul>
            </p>
            <p className="section-body" style={{marginTop:8}}>
              บริษัทจะไม่ขายหรือเปิดเผยข้อมูลส่วนบุคคลแก่บุคคลภายนอก ยกเว้นในกรณีที่กฎหมายกำหนดหรือได้รับความยินยอมจากท่าน ท่านมีสิทธิ์ขอเข้าถึง แก้ไข หรือลบข้อมูลได้ตลอดเวลาผ่านการติดต่อทีมงาน
            </p>

            {/* ── 7. การระงับบัญชี ── */}
            <p className="section-title">⚠️ 7. การระงับหรือยกเลิกบัญชีสมาชิก</p>
            <p className="section-body">
              บริษัทขอสงวนสิทธิ์ระงับหรือยกเลิกบัญชีสมาชิกโดยไม่ต้องแจ้งล่วงหน้าในกรณี:
              <ul style={{marginTop:8}}>
                <li>พบการใช้ข้อมูลเท็จหรือปลอมแปลงหลักฐาน</li>
                <li>ลงทะเบียนสินค้าที่ไม่ได้ซื้อจริงหรือซื้อจากช่องทางที่ไม่รับรอง</li>
                <li>ละเมิดข้อกำหนดและเงื่อนไขของโปรแกรม</li>
                <li>บัญชีไม่มีการใช้งานเกิน 2 ปีติดต่อกัน</li>
              </ul>
              การยกเลิกบัญชีจะส่งผลให้คะแนนสะสมทั้งหมดสูญเสียโดยไม่สามารถเรียกคืนได้
            </p>

            {/* ── 8. การเปลี่ยนแปลงเงื่อนไข ── */}
            <p className="section-title">📢 8. การเปลี่ยนแปลงข้อกำหนด</p>
            <p className="section-body">
              บริษัทขอสงวนสิทธิ์เปลี่ยนแปลง แก้ไข หรือยกเลิกข้อกำหนดและเงื่อนไขได้ตลอดเวลา โดยจะแจ้งให้สมาชิกทราบผ่านแอปพลิเคชันหรืออีเมลที่ลงทะเบียนไว้ล่วงหน้าไม่น้อยกว่า 15 วัน การใช้งานต่อหลังจากวันมีผลบังคับใช้ถือว่าท่านยอมรับการเปลี่ยนแปลงนั้น
            </p>

            {/* ── 9. ติดต่อ ── */}
            <p className="section-title">📬 9. ช่องทางติดต่อ</p>
            <p className="section-body">
              หากมีข้อสงสัยหรือต้องการความช่วยเหลือ สามารถติดต่อเราได้ที่:
              <ul style={{marginTop:8}}>
                <li>อีเมล: <span style={{color:'#f59e0b'}}>support@dreame-thailand.com</span></li>
                <li>LINE Official: <span style={{color:'#f59e0b'}}>@DreameThailand</span></li>
                <li>วันจันทร์ – ศุกร์ เวลา 09:00 – 18:00 น.</li>
              </ul>
            </p>

            <div style={{ marginTop:28, padding:'16px', background:'rgba(245,158,11,0.05)', border:'1px solid rgba(245,158,11,0.12)', borderRadius:14 }}>
              <p style={{ color:'#9ca3af', fontSize:12, fontFamily:"'Sarabun',sans-serif", lineHeight:1.7, textAlign:'center' }}>
                ข้อกำหนดนี้มีผลบังคับใช้ตั้งแต่วันที่ 1 มีนาคม พ.ศ. 2569<br />
                <span style={{color:'#6b7280', fontSize:11}}>SHD Technology Co., Ltd. · Dreame Thailand</span>
              </p>
            </div>

            <div style={{height:16}} />
          </div>
        </div>

        {/* ── Fixed Bottom ── */}
        <div style={{ padding:'12px 20px 32px', borderTop:'1px solid rgba(255,255,255,0.06)', background:'rgba(10,10,15,0.95)', backdropFilter:'blur(20px)' }}>

          {/* Checkbox */}
          <label style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:14, cursor:'pointer' }}
            onClick={() => scrolled && setAccepted(a => !a)}>
            <div style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
              background: accepted ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'rgba(255,255,255,0.05)',
              border: accepted ? 'none' : '1.5px solid rgba(255,255,255,0.15)',
              display:'flex', alignItems:'center', justifyContent:'center',
              transition:'all 0.2s ease',
              opacity: scrolled ? 1 : 0.4,
              boxShadow: accepted ? '0 4px 12px rgba(245,158,11,0.35)' : 'none',
            }}>
              {accepted && <span style={{color:'#000', fontSize:13, fontWeight:700}}>✓</span>}
            </div>
            <p style={{ color: scrolled ? '#d1d5db' : '#6b7280', fontSize:13, fontFamily:"'Sarabun',sans-serif", lineHeight:1.6, transition:'color 0.2s' }}>
              ข้าพเจ้าได้อ่านและยอมรับ<strong style={{color: accepted ? '#f59e0b' : 'inherit'}}>นโยบายและเงื่อนไข</strong>การเป็นสมาชิก Dreame Thailand Membership Program ทุกข้อ
            </p>
          </label>

          {!scrolled && (
            <p style={{ textAlign:'center', color:'#f59e0b', fontSize:11, fontFamily:"'Sarabun',sans-serif", marginBottom:10, opacity:0.8 }}>
              ↑ กรุณาเลื่อนอ่านให้ครบก่อน
            </p>
          )}

          {/* Accept Button */}
          <button
            onClick={handleAccept}
            disabled={!accepted || loading}
            style={{
              width:'100%',
              background: accepted ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'rgba(255,255,255,0.05)',
              border: accepted ? 'none' : '1px solid rgba(255,255,255,0.1)',
              borderRadius:16, padding:'16px 0',
              fontSize:16, fontWeight:700,
              fontFamily:"'Kanit',sans-serif",
              color: accepted ? '#000' : '#4b5563',
              cursor: accepted ? 'pointer' : 'not-allowed',
              transition:'all 0.25s ease',
              boxShadow: accepted ? '0 6px 28px rgba(245,158,11,0.4)' : 'none',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            }}
          >
            {loading
              ? <><div style={{width:18,height:18,border:'2.5px solid rgba(0,0,0,0.2)',borderTop:'2.5px solid #000',borderRadius:'50%',animation:'spin 0.8s linear infinite'}} /> กำลังบันทึก...</>
              : <> ยอมรับและเริ่มใช้งาน →</>}
          </button>
        </div>
      </div>
    </>
  )
}