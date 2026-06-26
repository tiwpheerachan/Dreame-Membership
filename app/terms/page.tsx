'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  FileText, User, Star, Layers, ShieldCheck,
  Lock, AlertTriangle, RefreshCw, Mail, CheckCircle, ChevronDown,
  Sparkles, Award, Phone,
} from 'lucide-react'

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700;800&display=swap');
  *, *::before, *::after { -webkit-tap-highlight-color:transparent; box-sizing:border-box; margin:0; padding:0; }
  @keyframes spin   { to{transform:rotate(360deg)} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }

  .trm-wrap {
    min-height:100vh;
    background:
      radial-gradient(ellipse at top,    rgba(234,219,177,0.45) 0%, transparent 55%),
      radial-gradient(ellipse at bottom, rgba(160,120,43,0.10)  0%, transparent 55%),
      #FAF7F2;
    font-family:'Prompt',system-ui,sans-serif;
    display:flex; flex-direction:column;
  }
  .trm {
    flex:1; display:flex; flex-direction:column;
    max-width:520px; margin:0 auto; width:100%;
    min-height:100vh;
  }

  /* Hero header — gold-on-black with brand wordmark */
  .trm-hero {
    position:relative;
    background:linear-gradient(160deg,#1A1815 0%,#2A2419 60%,#3A2E18 100%);
    color:#FAF3DC;
    padding:36px 22px 30px;
    overflow:hidden;
    border-radius:0 0 28px 28px;
    box-shadow:0 8px 32px rgba(20,18,15,0.20);
  }
  .trm-hero::before {
    content:''; position:absolute; top:-60px; right:-40px;
    width:220px; height:220px; border-radius:50%;
    background:radial-gradient(circle, rgba(234,219,177,0.30) 0%, transparent 65%);
    pointer-events:none;
  }
  .trm-hero-rule {
    width:32px; height:1.5px; margin:0 0 14px;
    background:linear-gradient(90deg,#FAF3DC,#A0782B,transparent);
  }
  .trm-hero-eyebrow {
    font-size:10px; font-weight:700; letter-spacing:0.22em; text-transform:uppercase;
    color:rgba(234,219,177,0.65); margin:0 0 6px;
  }
  .trm-hero-title {
    font-size:24px; font-weight:800; letter-spacing:-0.01em;
    color:#FAF3DC; margin:0 0 10px;
  }
  .trm-hero-title .it { font-style:italic; font-weight:400; color:rgba(234,219,177,0.85); }
  .trm-hero-meta {
    display:inline-flex; align-items:center; gap:6px;
    font-size:11px; padding:5px 12px; border-radius:100px;
    background:rgba(255,255,255,0.08); border:1px solid rgba(234,219,177,0.18);
    color:rgba(234,219,177,0.78); backdrop-filter:blur(6px);
  }
  .trm-hero-logo {
    position:absolute; top:22px; right:22px;
    height:18px; opacity:0.85;
    filter:brightness(0) invert(1);
  }

  /* Body */
  .trm-body {
    flex:1; padding:18px 16px 0;
    -webkit-overflow-scrolling:touch;
  }
  .sec {
    margin-bottom:14px; background:#fff; border-radius:18px;
    border:1px solid rgba(20,18,15,0.06);
    box-shadow:0 1px 4px rgba(20,18,15,0.04);
    overflow:hidden;
  }
  .sec-hdr {
    display:flex; align-items:center; gap:12px;
    padding:14px 18px;
  }
  .sec-ico {
    width:36px; height:36px; border-radius:11px;
    display:flex; align-items:center; justify-content:center; flex-shrink:0;
    box-shadow:inset 0 1px 0 rgba(255,255,255,0.65);
  }
  .sec-no {
    font-size:9px; font-weight:800; letter-spacing:0.14em; color:#A0782B;
    background:linear-gradient(135deg,#FAF3DC,#EADBB1);
    padding:2px 8px; border-radius:6px; flex-shrink:0;
  }
  .sec-title { font-size:14px; font-weight:800; color:#1A1815; letter-spacing:-0.005em; flex:1; }
  .sec-body {
    padding:0 18px 16px; font-size:13px; color:#4A4337; line-height:1.7;
  }
  .sec-body li { margin-left:18px; margin-bottom:5px; }
  .sec-body li::marker { color:#A0782B; }

  .hi-box {
    background:linear-gradient(135deg, rgba(234,219,177,0.18), rgba(234,219,177,0.06));
    border:1px solid rgba(160,120,43,0.18);
    border-radius:12px; padding:12px 14px; margin:8px 0;
    font-size:13px; color:#3A2E18; line-height:1.7;
  }
  .hi-box strong { color:#1A1815; }

  /* Tier cards */
  .tier-row { display:flex; flex-direction:column; gap:8px; margin-top:8px; }
  .tier-item {
    display:flex; align-items:center; gap:14px;
    padding:12px 14px; border-radius:12px;
    border:1px solid rgba(20,18,15,0.05);
  }
  .tier-badge {
    width:38px; height:38px; border-radius:10px;
    display:flex; align-items:center; justify-content:center; flex-shrink:0;
    color:#fff; box-shadow:inset 0 1px 0 rgba(255,255,255,0.30), 0 2px 6px rgba(20,18,15,0.10);
  }

  /* Footer card with checkbox + accept */
  .trm-foot {
    position:sticky; bottom:0;
    padding:16px 16px 28px;
    background:linear-gradient(to top, #FAF7F2 60%, rgba(250,247,242,0.80) 100%);
  }
  .foot-card {
    background:#fff; border-radius:20px;
    border:1px solid rgba(20,18,15,0.06);
    box-shadow:0 8px 28px rgba(20,18,15,0.10);
    padding:16px 16px 16px;
  }
  .chk-row { display:flex; align-items:flex-start; gap:12px; margin-bottom:12px; cursor:pointer; }
  .chk-box {
    width:22px; height:22px; border-radius:7px; flex-shrink:0; margin-top:2px;
    display:flex; align-items:center; justify-content:center;
    transition:all 0.15s;
  }
  .btn-accept {
    width:100%; padding:14px;
    background:linear-gradient(180deg,#1A1815,#0E0E0E);
    color:#EADBB1;
    border:none; border-radius:14px; font-size:14.5px; font-weight:700; font-family:inherit;
    cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;
    transition:opacity 0.15s, transform 0.1s;
    box-shadow:inset 0 1px 0 rgba(255,250,235,0.10), 0 6px 20px rgba(20,18,15,0.20);
  }
  .btn-accept:disabled { opacity:0.35; cursor:not-allowed; box-shadow:none; }
  .btn-accept:not(:disabled):active { transform:scale(0.98); }
  .scroll-hint {
    display:flex; align-items:center; justify-content:center; gap:6px;
    padding:6px 0 10px; color:#A0782B; font-size:11px; font-weight:600;
    animation:fadeUp 0.4s ease;
  }
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
      await fetch('/api/users/ensure-profile', { method: 'POST' }).catch(() => {})
      const { data: user } = await supabase.from('users').select('terms_accepted_at').eq('id', authUser.id).maybeSingle()
      if (user?.terms_accepted_at) { router.push('/home'); return }
      setChecking(false)
    }
    check()
  }, [])

  // Detect scroll-to-bottom on the page (not inner container) since the
  // hero is now in document flow, not above a fixed scroll area.
  useEffect(() => {
    function onScroll() {
      const fullScroll = window.scrollY + window.innerHeight
      if (fullScroll >= document.body.scrollHeight - 120) setScrolled(true)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  async function handleAccept() {
    if (!accepted) return
    setLoading(true)
    const res = await fetch('/api/users/accept-terms', { method:'POST' })
    if (res.ok) router.push('/home')
    else { setLoading(false); alert('เกิดข้อผิดพลาด กรุณาลองใหม่') }
  }

  if (checking) return (
    <div style={{ minHeight:'100vh', background:'#FAF7F2', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:32, height:32, border:'3px solid rgba(160,120,43,0.20)', borderTop:'3px solid #A0782B', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  type Section = {
    no: string
    Icon: typeof FileText
    iconBg: string
    iconColor: string
    title: string
    content: React.ReactNode
  }

  const sections: Section[] = [
    {
      no:'01', Icon: User, iconBg:'#ECFDF5', iconColor:'#059669',
      title:'คุณสมบัติผู้สมัครและการสร้างบัญชี',
      content: (
        <ul>
          <li>เป็นบุคคลธรรมดา อายุไม่ต่ำกว่า <strong>18 ปีบริบูรณ์</strong> ณ วันที่สมัคร และมีถิ่นพำนักในประเทศไทย</li>
          <li>ให้ข้อมูลที่ถูกต้อง เป็นจริง และเป็นปัจจุบัน (ชื่อ-นามสกุล, เบอร์โทร, อีเมล) — หากพบว่าเป็นเท็จ บริษัทฯ ขอสงวนสิทธิ์ระงับหรือยกเลิกสมาชิกภาพทันที</li>
          <li>บัญชีเป็นสิทธิ์เฉพาะบุคคล ไม่สามารถโอน จำหน่าย หรือยกสิทธิ์/คะแนนให้ผู้อื่นได้</li>
          <li>1 ท่าน (อ้างอิงบัตรประชาชน หรือเบอร์โทร หรืออีเมล) มีได้เพียง <strong>1 บัญชี</strong></li>
        </ul>
      ),
    },
    {
      no:'02', Icon: Star, iconBg:'#FFFBEB', iconColor:'#D97706',
      title:'ช่องทางที่รองรับ & การสะสมคะแนน',
      content: (
        <>
          <div className="hi-box">
            อัตราคะแนน (คำนวณจากยอดหลังหักส่วนลด ไม่รวมค่าจัดส่ง)
            <ul style={{ marginTop:6 }}>
              <li><strong>D2C ของแบรนด์</strong> (เว็บไซต์ทางการ / หน้าร้านทางการ) — <strong>500 บาท = 2 คะแนน</strong></li>
              <li><strong>Marketplace &amp; ตัวแทน</strong> (Shopee / Lazada / TikTok Official, ห้าง CDS, ตัวแทนที่ได้รับอนุญาต) — <strong>500 บาท = 1 คะแนน</strong></li>
            </ul>
          </div>
          <ul style={{ marginTop:8 }}>
            <li>เศษของยอดที่ไม่ถึง 500 บาท จะไม่ถูกคำนวณ และปัดเศษ/รวมบิลไม่ได้</li>
            <li>การซื้อผ่าน Marketplace/ตัวแทน อาจต้องเชื่อมบัญชีหรือส่งหลักฐานภายในเวลาที่กำหนด เพื่อรับคะแนน</li>
          </ul>
        </>
      ),
    },
    {
      no:'03', Icon: CheckCircle, iconBg:'#F0FDF4', iconColor:'#16A34A',
      title:'เงื่อนไขการอนุมัติคะแนน',
      content: (
        <ul>
          <li>คะแนนเข้าระบบภายใน <strong>3–7 วันทำการ</strong> หลังตรวจสอบเสร็จ และพ้นกำหนดการคืนสินค้า/คืนเงินของแต่ละช่องทาง</li>
          <li>คะแนนเป็นสิทธิประโยชน์ของโปรแกรม มิใช่ทรัพย์สิน เงินตรา หรือสิทธิเรียกร้อง — โอน แลกเปลี่ยน แลกเงินสด หรือชำระหนี้ไม่ได้</li>
          <li><strong>การคืน/ยกเลิกออเดอร์:</strong> บริษัทฯ มีสิทธิ์หักคะแนนที่ได้รับคืนตามสัดส่วน หากคะแนนไม่พอ ยอดอาจ<strong>ติดลบ</strong> และนำคะแนนในอนาคตมาหักจนเป็นศูนย์ (ไม่เรียกเก็บเงิน)</li>
        </ul>
      ),
    },
    {
      no:'04', Icon: RefreshCw, iconBg:'#EEF2FF', iconColor:'#6366F1',
      title:'อายุและการหมดอายุของคะแนน',
      content: (
        <>
          <div className="hi-box">
            คะแนนที่ได้รับในแต่ละปีปฏิทิน มีอายุถึง <strong>31 ธันวาคมของปีถัดไป</strong><br/>
            <span style={{ fontSize:12, opacity:0.85 }}>ตัวอย่าง: คะแนนที่ได้รับปี 2569 จะหมดอายุทั้งหมดวันที่ 31 ธ.ค. 2570</span>
          </div>
          <ul style={{ marginTop:8 }}>
            <li>คะแนนที่หมดอายุจะถูกลบอัตโนมัติ ขอต่ออายุ คืน หรือชดเชยไม่ได้</li>
            <li>บริษัทฯ อาจแจ้งเตือนคะแนนใกล้หมดอายุผ่านเว็บไซต์ อีเมล หรือ LINE Official</li>
          </ul>
        </>
      ),
    },
    {
      no:'05', Icon: Layers, iconBg:'#F5F3FF', iconColor:'#7C3AED',
      title:'ระดับสมาชิก (Membership Tiers)',
      content: (
        <div className="tier-row">
          {[
            { label:'Silver',   range:'0 – 63 คะแนน',     perks:'ลงทะเบียน/รับประกัน · Welcome Voucher 10%', from:'#C9D9E8', to:'#8DA9BC', ink:'#0F1B2D', bg:'#F4F6FB' },
            { label:'Gold',     range:'64 – 319 คะแนน',   perks:'+ Upgrade Voucher เมื่อเลื่อนระดับ',          from:'#F4C28A', to:'#C46B3A', ink:'#3A1F0A', bg:'#FFF8EE' },
            { label:'Platinum', range:'320 คะแนนขึ้นไป',  perks:'+ Voucher ฿1,000 (ขั้นต่ำ 10,000/บิล) · 1.2× · Quarterly Voucher', from:'#5EEAD4', to:'#14B8A6', ink:'#053C36', bg:'#EBFCF7' },
          ].map(t => (
            <div key={t.label} className="tier-item" style={{ background: t.bg }}>
              <div className="tier-badge" style={{ background:`linear-gradient(135deg,${t.from},${t.to})` }}>
                <Award size={16} strokeWidth={2} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:13.5, fontWeight:800, color:t.ink, margin:0, letterSpacing:'-0.005em' }}>{t.label}</p>
                <p style={{ fontSize:11, color:'rgba(20,18,15,0.55)', margin:'1px 0 0' }}>{t.range}</p>
                <p style={{ fontSize:11, color:'rgba(20,18,15,0.70)', marginTop:3 }}>{t.perks}</p>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      no:'06', Icon: Sparkles, iconBg:'#FFFBEB', iconColor:'#C99B3E',
      title:'การใช้คะแนนแลกรับรางวัล',
      content: (
        <>
          <div className="hi-box">
            อัตราแลกมาตรฐาน <strong>1 คะแนน = ส่วนลด 2 บาท</strong>
          </div>
          <ul style={{ marginTop:8 }}>
            <li>เมื่อกดยืนยันการแลกแล้วถือว่าสมบูรณ์ ยกเลิก เปลี่ยนแปลง หรือขอคืนคะแนนไม่ได้ (เว้นแต่เกิดจากความผิดพลาดของระบบ)</li>
            <li>คูปองจากการแลกแต้มมีอายุ <strong>90 วัน</strong> นับจากวันรับสิทธิ์ หากไม่ใช้จะสิ้นสุดอัตโนมัติและไม่คืนคะแนน</li>
            <li>1 คำสั่งซื้อใช้คูปองแลกแต้มได้ <strong>1 ใบเท่านั้น</strong> ห้ามใช้ซ้อนหลายใบในบิลเดียว และยอดในตะกร้าต้องมากกว่ามูลค่าคูปองอย่างน้อย 1 บาท</li>
            <li>คูปองทุกประเภท: ทอน/แลกเงินสด หรือโอนให้ผู้อื่นไม่ได้ · ใช้ครั้งเดียว · เฉพาะสินค้าที่ร่วมรายการ · ใช้ย้อนหลังไม่ได้ · ไม่ลดค่าจัดส่ง (เว้นแต่กำหนดเป็นอย่างอื่น)</li>
          </ul>
        </>
      ),
    },
    {
      no:'07', Icon: ShieldCheck, iconBg:'#F0FDF4', iconColor:'#16A34A',
      title:'การลงทะเบียนสินค้า & การรับประกัน',
      content: (
        <>
          <div className="hi-box">
            ลงทะเบียนสินค้าภายใน <strong>15 วัน</strong> นับจากวันที่ซื้อ เพื่อรับสิทธิประโยชน์
          </div>
          <ul style={{ marginTop:8 }}>
            <li>การรับประกันเป็นไปตามเงื่อนไข/ระยะเวลาของสินค้าแต่ละรุ่น (โครงสร้าง แบตเตอรี่ มอเตอร์ หรืออะไหล่ อาจต่างกัน) เริ่มนับจากวันที่ในหลักฐานการซื้อ หรือวันรับสินค้า</li>
            <li>แนบหลักฐานการซื้อที่ชัดเจน (ใบเสร็จ / ใบกำกับภาษี / ภาพหน้าจอคำสั่งซื้อที่มีหมายเลขออเดอร์)</li>
            <li>สินค้า 1 ชิ้น (อ้างอิง Serial Number) ลงทะเบียนได้ <strong>1 ครั้ง</strong></li>
            <li>ระยะเวลาตรวจสอบและอนุมัติ 3–7 วันทำการ</li>
          </ul>
        </>
      ),
    },
    {
      no:'08', Icon: Lock, iconBg:'#EFF6FF', iconColor:'#0284C7',
      title:'ความเป็นส่วนตัว (PDPA)',
      content: (
        <>
          <div className="hi-box">
            ข้อมูลของท่านถูกเก็บ ใช้ และเปิดเผยตาม <strong>พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562</strong> เพื่อดำเนินโปรแกรมสมาชิก
          </div>
          <ul style={{ marginTop:8 }}>
            <li>บริษัทฯ ไม่เปิดเผยข้อมูลแก่บุคคลภายนอก เว้นแต่ได้รับความยินยอม หรือเป็นไปตามกฎหมาย</li>
            <li>ท่านมีสิทธิ์ขอเข้าถึง แก้ไข ลบ ระงับ คัดค้าน ถอนความยินยอม และโอนย้ายข้อมูลได้</li>
            <li>การถอนความยินยอมหรือขอลบข้อมูลบางรายการ อาจกระทบต่อการให้บริการและสิทธิประโยชน์ของสมาชิก</li>
          </ul>
        </>
      ),
    },
    {
      no:'09', Icon: AlertTriangle, iconBg:'#FEF2F2', iconColor:'#DC2626',
      title:'การระงับ / ยกเลิกสมาชิกภาพ',
      content: (
        <ul>
          <li>ให้ข้อมูลเท็จ ปลอมแปลงเอกสาร หรือละเมิดข้อกำหนด</li>
          <li>มีพฤติการณ์ทุจริตในการสะสมคะแนน หรือลงทะเบียนสินค้าที่ไม่ได้ซื้อจริง</li>
          <li>บัญชีไม่มีการเคลื่อนไหวหรือไม่มีประวัติการซื้อติดต่อกันเกิน <strong>2 ปี</strong></li>
          <li>หากตรวจสอบพบการฝ่าฝืน บริษัทฯ มีสิทธิ์ยกเลิกสมาชิกภาพ ระงับคะแนน และเพิกถอนสิทธิประโยชน์ — เมื่อสมาชิกภาพสิ้นสุด คะแนน/สิทธิ์ที่ยังไม่ใช้จะสิ้นสุดทันที</li>
        </ul>
      ),
    },
    {
      no:'10', Icon: FileText, iconBg:'#EEF2FF', iconColor:'#6366F1',
      title:'การเปลี่ยนแปลงข้อกำหนด · ภาษี',
      content: (
        <ul>
          <li>บริษัทฯ สงวนสิทธิ์แก้ไข/ยกเลิกข้อกำหนด อัตราคะแนน หรือสิทธิประโยชน์ โดยแจ้งล่วงหน้าไม่น้อยกว่า <strong>15 วัน</strong> — การเปลี่ยนแปลงไม่มีผลย้อนหลังต่อคะแนนที่ได้รับไปแล้ว</li>
          <li>การใช้สิทธิ์ต่อหลังประกาศ ถือว่ายอมรับข้อกำหนดฉบับใหม่</li>
          <li>บริษัทฯ ไม่รับผิดต่อความล่าช้า/ขัดข้องอันเกิดจากเหตุสุดวิสัย (ภัยธรรมชาติ โรคระบาด ระบบของผู้ให้บริการภายนอก ฯลฯ)</li>
          <li>สมาชิกรับผิดชอบภาษีหรือค่าธรรมเนียมที่อาจเกิดจากของรางวัล/การแลกคะแนน (หากมี)</li>
        </ul>
      ),
    },
    {
      no:'11', Icon: Mail, iconBg:'#EFF6FF', iconColor:'#0284C7',
      title:'กฎหมายที่ใช้บังคับ & ติดต่อ',
      content: (
        <>
          <p style={{ marginBottom:8 }}>ข้อกำหนดนี้อยู่ภายใต้บังคับและตีความตามกฎหมายของราชอาณาจักรไทย</p>
          <ul style={{ listStyle:'none', marginLeft:0 }}>
            <li style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <Mail size={13} color="#A0782B" />
              <span><strong>อีเมล</strong> · <a href="mailto:support@dreame-thailand.com" style={{ color:'#A0782B', fontWeight:600 }}>support@dreame-thailand.com</a></span>
            </li>
            <li style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <Sparkles size={13} color="#A0782B" />
              <span><strong>LINE Official</strong> · <span style={{ color:'#A0782B', fontWeight:600 }}>@DreameThailand</span></span>
            </li>
            <li style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Phone size={13} color="#A0782B" />
              <span>จันทร์ – ศุกร์ 09:00 – 18:00 น. (ยกเว้นวันหยุดนักขัตฤกษ์)</span>
            </li>
          </ul>
        </>
      ),
    },
  ]

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }}/>
      <div className="trm-wrap">
        <div className="trm">

          {/* Hero */}
          <div className="trm-hero">
            <img src="/dreame-logo.png" alt="Dreame Thailand" className="trm-hero-logo" />
            <div className="trm-hero-rule" />
            <p className="trm-hero-eyebrow">Membership Agreement</p>
            <h1 className="trm-hero-title">
              นโยบาย<span className="it"> และ </span>เงื่อนไข
            </h1>
            <span className="trm-hero-meta">
              <FileText size={11} /> มีผลบังคับใช้ 1 มีนาคม 2569
            </span>
          </div>

          {/* Body */}
          <div className="trm-body" ref={bodyRef}>
            {sections.map((s, i) => (
              <div key={s.no} className="sec" style={{ animation: mounted ? `fadeUp 0.32s ease ${i * 0.04}s both` : 'none' }}>
                <div className="sec-hdr">
                  <div className="sec-ico" style={{ background: s.iconBg, color: s.iconColor }}>
                    <s.Icon size={17} strokeWidth={1.9} />
                  </div>
                  <span className="sec-no">{s.no}</span>
                  <p className="sec-title">{s.title}</p>
                </div>
                <div className="sec-body">{s.content}</div>
              </div>
            ))}

            <div style={{ padding:'12px 0 20px', textAlign:'center' }}>
              <div style={{
                display:'inline-flex', alignItems:'center', gap:8,
                color:'rgba(20,18,15,0.30)',
              }}>
                <span style={{ width:18, height:1, background:'rgba(160,120,43,0.40)' }} />
                <Sparkles size={9} />
                <span style={{ width:18, height:1, background:'rgba(160,120,43,0.40)' }} />
              </div>
              <p style={{
                fontSize:11, color:'rgba(20,18,15,0.40)', margin:'8px 0 0',
                letterSpacing:'0.06em',
              }}>
                SHD Technology Co., Ltd. · Dreame Thailand
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="trm-foot">
            <div className="foot-card">
              {!scrolled && (
                <div className="scroll-hint">
                  <ChevronDown size={14}/>
                  เลื่อนอ่านให้ครบก่อนกดยืนยัน
                </div>
              )}

              <div className="chk-row" onClick={() => scrolled && setAccepted(a => !a)}>
                <div className="chk-box" style={{
                  background: accepted ? 'linear-gradient(135deg,#1A1815,#0E0E0E)' : '#fff',
                  border: accepted ? 'none' : '1.5px solid #D7CFC0',
                  opacity: scrolled ? 1 : 0.4,
                  boxShadow: accepted ? '0 2px 6px rgba(20,18,15,0.20), inset 0 1px 0 rgba(234,219,177,0.20)' : 'none',
                }}>
                  {accepted && <span style={{ color:'#EADBB1', fontSize:12, fontWeight:900 }}>✓</span>}
                </div>
                <p style={{ fontSize:13, color: scrolled ? '#1A1815' : '#A8A294', lineHeight:1.6, transition:'color 0.2s' }}>
                  ข้าพเจ้าได้อ่านและยอมรับ{' '}
                  <strong style={{ color: accepted ? '#A0782B' : 'inherit' }}>นโยบายและเงื่อนไข</strong>{' '}
                  การเป็นสมาชิก Dreame Thailand ทุกข้อ
                </p>
              </div>

              <button className="btn-accept" onClick={handleAccept} disabled={!accepted || loading}>
                {loading
                  ? <><div style={{ width:15, height:15, border:'2px solid rgba(234,219,177,0.30)', borderTop:'2px solid #EADBB1', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/> กำลังบันทึก...</>
                  : <><CheckCircle size={16}/> ยืนยันและเริ่มใช้งาน</>}
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
