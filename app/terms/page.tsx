'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  FileText, User, Star, Layers, ShieldCheck,
  Lock, AlertTriangle, RefreshCw, Mail, CheckCircle, ChevronDown
} from 'lucide-react'

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700;800&display=swap');
  * { -webkit-tap-highlight-color:transparent; box-sizing:border-box; margin:0; padding:0; }
  @keyframes spin   { to{transform:rotate(360deg)} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
  .trm { height:100vh; background:#fafaf8; font-family:'Prompt',system-ui,sans-serif;
    display:flex; flex-direction:column; max-width:520px; margin:0 auto; overflow:hidden; }
  .trm-hdr { padding:52px 20px 16px; flex-shrink:0;
    background:#fafaf8; border-bottom:1px solid #f0f0ee; }
  .trm-body { flex:1; overflow-y:auto; padding:20px; min-height:0; }
  .trm-body::-webkit-scrollbar { width:3px; }
  .trm-body::-webkit-scrollbar-thumb { background:#e5e7eb; border-radius:4px; }
  .sec { margin-bottom:20px; background:#fff; border-radius:16px;
    border:1px solid #f0f0ee; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.04); }
  .sec-hdr { display:flex; align-items:center; gap:10px; padding:14px 16px;
    border-bottom:1px solid #f7f7f5; }
  .sec-ico { width:34px; height:34px; border-radius:10px; display:flex;
    align-items:center; justify-content:center; flex-shrink:0; }
  .sec-body { padding:14px 16px; font-size:13px; color:#4b5563; line-height:1.75; }
  .sec-body li { margin-left:16px; margin-bottom:5px; }
  .hi-box { background:#f7f7f5; border-radius:10px; padding:12px 14px; margin:8px 0;
    font-size:13px; color:#374151; line-height:1.7; border:1px solid #f0f0ee; }
  .tier-row { display:flex; flex-direction:column; gap:8px; margin-top:8px; }
  .tier-item { display:flex; align-items:center; gap:12px; padding:10px 12px;
    border-radius:10px; border:1px solid #f0f0ee; background:#fafaf8; }
  .trm-foot { padding:16px 20px 32px; background:#fff; border-top:1px solid #f0f0ee; }
  .chk-row { display:flex; align-items:flex-start; gap:12px; margin-bottom:14px; cursor:pointer; }
  .chk-box { width:22px; height:22px; border-radius:7px; flex-shrink:0; margin-top:2px;
    display:flex; align-items:center; justify-content:center; transition:all 0.15s; }
  .btn-accept { width:100%; padding:15px; background:#0d0d0d; color:#d4af37;
    border:none; border-radius:14px; font-size:15px; font-weight:700; font-family:inherit;
    cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;
    transition:opacity 0.15s; }
  .btn-accept:disabled { opacity:0.35; cursor:not-allowed; }
  .scroll-hint { display:flex; align-items:center; justify-content:center; gap:6px;
    padding:8px; color:#9ca3af; font-size:11px; margin-bottom:8px; }
`

export default function TermsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [mounted, setMounted] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
    async function check() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/'); return }
      // Make sure the profile row exists before we try to read it. Belt-and-
      // suspenders for accounts that predate the auth trigger.
      await fetch('/api/users/ensure-profile', { method: 'POST' }).catch(() => {})
      const { data: user } = await supabase.from('users').select('terms_accepted_at').eq('id', authUser.id).maybeSingle()
      if (user?.terms_accepted_at) { router.push('/home'); return }
      setChecking(false)
    }
    check()
  }, [])

  function onScroll() {
    const el = bodyRef.current
    if (!el) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) setScrolled(true)
  }

  async function handleAccept() {
    if (!accepted) return
    setLoading(true)
    const res = await fetch('/api/users/accept-terms', { method:'POST' })
    if (res.ok) router.push('/home')
    else { setLoading(false); alert('เกิดข้อผิดพลาด กรุณาลองใหม่') }
  }

  if (checking) return (
    <div style={{ minHeight:'100vh', background:'#fafaf8', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:32, height:32, border:'3px solid #f0f0ee', borderTop:'3px solid #d4af37', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const sections = [
    {
      ico: <FileText size={16} color="#6366f1"/>, bg:'#eef2ff',
      title:'1. ข้อมูลทั่วไป',
      content: (
        <p>โปรแกรม <strong>Dreame Thailand Membership Program</strong> บริหารจัดการโดย SHD Technology Co., Ltd. ผู้แทนจำหน่ายอย่างเป็นทางการของ Dreame Technology ในประเทศไทย ออกแบบมาเพื่อมอบสิทธิประโยชน์พิเศษให้ลูกค้าที่ซื้อสินค้า Dreame ผ่านช่องทางที่กำหนด</p>
      )
    },
    {
      ico: <User size={16} color="#0891b2"/>, bg:'#eff6ff',
      title:'2. คุณสมบัติผู้สมัคร',
      content: (
        <ul>
          <li>มีอายุไม่ต่ำกว่า 18 ปีบริบูรณ์</li>
          <li>มีอีเมลหรือหมายเลขโทรศัพท์ที่ใช้งานได้จริงในไทย</li>
          <li>ซื้อสินค้าผ่านช่องทางที่รับรอง (Shopee, Lazada, Website, TikTok Shop)</li>
          <li>ยินยอมให้ข้อมูลส่วนบุคคลตามวัตถุประสงค์ของโปรแกรม</li>
        </ul>
      )
    },
    {
      ico: <Star size={16} color="#d97706"/>, bg:'#fffbeb',
      title:'3. การสะสมคะแนน',
      content: (
        <>
          <div className="hi-box">
            ทุกการซื้อสินค้าที่ผ่านการตรวจสอบ รับ <strong>1 แต้ม ต่อทุก ฿100</strong> (ปัดเศษลง) คะแนนจะเพิ่มภายใน 3–7 วันทำการหลังอนุมัติ
          </div>
          <ul style={{ marginTop:8 }}>
            <li>คะแนนไม่หมดอายุหากมีการใช้งานอย่างน้อย 1 ครั้งต่อปี</li>
            <li>ไม่สามารถโอนหรือแปลงเป็นเงินสดได้</li>
            <li>การคืนสินค้าจะหักคะแนนที่ได้รับตามสัดส่วน</li>
          </ul>
        </>
      )
    },
    {
      ico: <Layers size={16} color="#7c3aed"/>, bg:'#f5f3ff',
      title:'4. ระดับสมาชิก (Tier)',
      content: (
        <div className="tier-row">
          {[
            { label:'Silver', range:'0 – 499 แต้ม', perks:'สิทธิ์พื้นฐาน, ลงทะเบียนสินค้า', color:'#6b7280', bg:'#f9fafb' },
            { label:'Gold',   range:'500 – 1,999 แต้ม', perks:'+ ส่วนลดพิเศษ, คูปองวันเกิด', color:'#92600a', bg:'#fffbeb' },
            { label:'Platinum', range:'2,000 แต้มขึ้นไป', perks:'+ Priority Support, สิทธิ์ทดลองสินค้าใหม่', color:'#0e7490', bg:'#f0fdff' },
          ].map(t => (
            <div key={t.label} className="tier-item" style={{ background:t.bg }}>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:13, fontWeight:700, color:t.color }}>{t.label}</p>
                <p style={{ fontSize:11, color:'#9ca3af' }}>{t.range}</p>
                <p style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{t.perks}</p>
              </div>
            </div>
          ))}
        </div>
      )
    },
    {
      ico: <ShieldCheck size={16} color="#16a34a"/>, bg:'#f0fdf4',
      title:'5. การลงทะเบียนสินค้า',
      content: (
        <ul>
          <li>ลงทะเบียนได้ภายใน <strong>90 วัน</strong> นับจากวันที่ซื้อ</li>
          <li>แนบหลักฐานการซื้อที่ชัดเจนทุกครั้ง</li>
          <li>สินค้า 1 ชิ้น ลงทะเบียนได้เพียง 1 ครั้ง</li>
          <li>ระยะเวลาตรวจสอบ 3–7 วันทำการ</li>
        </ul>
      )
    },
    {
      ico: <Lock size={16} color="#0891b2"/>, bg:'#eff6ff',
      title:'6. นโยบายข้อมูลส่วนบุคคล (PDPA)',
      content: (
        <>
          <div className="hi-box">
            ข้อมูลของท่านถูกเก็บและประมวลผลตาม <strong>พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562</strong> เพื่อการดำเนินโปรแกรมสมาชิกเท่านั้น
          </div>
          <ul style={{ marginTop:8 }}>
            <li>บริษัทไม่ขายหรือเปิดเผยข้อมูลแก่บุคคลภายนอก</li>
            <li>ท่านมีสิทธิ์ขอเข้าถึง แก้ไข หรือลบข้อมูลได้ตลอดเวลา</li>
          </ul>
        </>
      )
    },
    {
      ico: <AlertTriangle size={16} color="#dc2626"/>, bg:'#fef2f2',
      title:'7. การระงับบัญชี',
      content: (
        <ul>
          <li>พบการใช้ข้อมูลเท็จหรือปลอมแปลงหลักฐาน</li>
          <li>ลงทะเบียนสินค้าที่ไม่ได้ซื้อจริง</li>
          <li>บัญชีไม่มีการใช้งานเกิน 2 ปี</li>
          <li>การยกเลิกบัญชีจะส่งผลให้คะแนนสูญเสียทั้งหมด</li>
        </ul>
      )
    },
    {
      ico: <RefreshCw size={16} color="#6366f1"/>, bg:'#eef2ff',
      title:'8. การเปลี่ยนแปลงข้อกำหนด',
      content: (
        <p>บริษัทขอสงวนสิทธิ์เปลี่ยนแปลงข้อกำหนดได้ตลอดเวลา โดยแจ้งล่วงหน้าไม่น้อยกว่า 15 วัน ผ่านแอปหรืออีเมล การใช้งานต่อหลังวันมีผลบังคับใช้ถือว่ายอมรับการเปลี่ยนแปลงนั้น</p>
      )
    },
    {
      ico: <Mail size={16} color="#0891b2"/>, bg:'#eff6ff',
      title:'9. ช่องทางติดต่อ',
      content: (
        <ul>
          <li>อีเมล: <span style={{ color:'#b8860b', fontWeight:600 }}>support@dreame-thailand.com</span></li>
          <li>LINE Official: <span style={{ color:'#b8860b', fontWeight:600 }}>@DreameThailand</span></li>
          <li>จันทร์ – ศุกร์ เวลา 09:00 – 18:00 น.</li>
        </ul>
      )
    },
  ]

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }}/>
      <div className="trm">

        {/* Header */}
        <div className="trm-hdr">
          <div style={{ marginBottom:14 }}>
            <img src="/dreame-logo.png" alt="Dreame Thailand" style={{ height:26, objectFit:'contain' }}/>
          </div>
          <h1 style={{ fontSize:20, fontWeight:800, color:'#111', margin:'0 0 4px' }}>
            นโยบายและเงื่อนไข
          </h1>
          <p style={{ fontSize:12, color:'#9ca3af' }}>
            โปรดอ่านให้ครบก่อนยืนยัน · มีผล 1 มีนาคม 2569
          </p>
        </div>

        {/* Scrollable body */}
        <div className="trm-body" ref={bodyRef} onScroll={onScroll}>
          {sections.map((s, i) => (
            <div key={i} className="sec" style={{ animation: mounted ? `fadeUp 0.3s ease ${i * 0.04}s both` : 'none' }}>
              <div className="sec-hdr">
                <div className="sec-ico" style={{ background: s.bg }}>{s.ico}</div>
                <p style={{ fontSize:13, fontWeight:700, color:'#111' }}>{s.title}</p>
              </div>
              <div className="sec-body">{s.content}</div>
            </div>
          ))}

          <div style={{ padding:'12px 0 8px', textAlign:'center' }}>
            <p style={{ fontSize:11, color:'#c4c4c4' }}>SHD Technology Co., Ltd. · Dreame Thailand</p>
          </div>
        </div>

        {/* Footer */}
        <div className="trm-foot">
          {!scrolled && (
            <div className="scroll-hint">
              <ChevronDown size={14}/>
              เลื่อนอ่านให้ครบก่อนกดยืนยัน
            </div>
          )}

          <div className="chk-row" onClick={() => scrolled && setAccepted(a => !a)}>
            <div className="chk-box" style={{
              background: accepted ? '#0d0d0d' : '#fff',
              border: accepted ? 'none' : '1.5px solid #d1d5db',
              opacity: scrolled ? 1 : 0.4,
            }}>
              {accepted && <span style={{ color:'#d4af37', fontSize:12, fontWeight:900 }}>✓</span>}
            </div>
            <p style={{ fontSize:13, color: scrolled ? '#374151' : '#9ca3af', lineHeight:1.6, transition:'color 0.2s' }}>
              ข้าพเจ้าได้อ่านและยอมรับ <strong style={{ color: accepted ? '#b8860b' : 'inherit' }}>นโยบายและเงื่อนไข</strong> การเป็นสมาชิก Dreame Thailand ทุกข้อ
            </p>
          </div>

          <button className="btn-accept" onClick={handleAccept} disabled={!accepted || loading}>
            {loading
              ? <><div style={{ width:15, height:15, border:'2px solid rgba(212,175,55,0.3)', borderTop:'2px solid #d4af37', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/> กำลังบันทึก...</>
              : <><CheckCircle size={16}/> ยืนยันและเริ่มใช้งาน</>}
          </button>
        </div>
      </div>
    </>
  )
}