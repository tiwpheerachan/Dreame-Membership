'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  User, Phone, Mail, MapPin, Lock, Eye, EyeOff,
  Camera, LogOut, ChevronRight, TrendingUp, Shield, CheckCircle
} from 'lucide-react'
import type { User as UserType } from '@/types'

const CSS = `
  * { box-sizing:border-box; }
  .pfw { background:#f0f0ee; min-height:100vh; font-family:'Prompt',system-ui,sans-serif; }
  @keyframes spin { to { transform:rotate(360deg) } }
  @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
  @keyframes slideDown { from{opacity:0;transform:translateX(-50%) translateY(-8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }

  /* HEADER */
  .pf-hdr { background:#0d0d0d; padding:52px 20px 80px; position:relative; overflow:hidden; }
  .pf-hdr-glow { position:absolute; top:-80px; right:-80px; width:280px; height:280px; border-radius:50%;
    background:radial-gradient(circle,rgba(212,175,55,0.16) 0%,transparent 65%); pointer-events:none; }
  .pf-hdr-line { position:absolute; top:0; left:0; right:0; height:1px;
    background:linear-gradient(90deg,transparent,rgba(212,175,55,0.5),transparent); }

  /* AVATAR HERO */
  .av-wrap { position:relative; display:inline-block; }
  .av-ring { width:88px; height:88px; border-radius:50%; display:flex; align-items:center;
    justify-content:center; font-size:28px; font-weight:800; color:#0d0d0d;
    border:3px solid rgba(212,175,55,0.6); box-shadow:0 0 0 5px rgba(212,175,55,0.1); }
  .av-img { width:88px; height:88px; border-radius:50%; object-fit:cover;
    border:3px solid rgba(212,175,55,0.6); box-shadow:0 0 0 5px rgba(212,175,55,0.1); }
  .av-btn { position:absolute; bottom:0; right:0; width:28px; height:28px; border-radius:50%;
    background:linear-gradient(135deg,#d4af37,#f5d060); border:2.5px solid #0d0d0d;
    display:flex; align-items:center; justify-content:center; cursor:pointer; }

  /* TIER BADGE */
  .tier-pill { display:inline-flex; align-items:center; gap:6px; padding:5px 14px;
    border-radius:100px; font-size:11px; font-weight:700; letter-spacing:0.06em; margin-top:10px; }
  .tier-gold     { background:rgba(212,175,55,0.15); color:#d4af37; border:1px solid rgba(212,175,55,0.35); }
  .tier-silver   { background:rgba(180,180,180,0.15); color:#aaa; border:1px solid rgba(180,180,180,0.3); }
  .tier-platinum { background:rgba(78,201,232,0.15); color:#4ec9e8; border:1px solid rgba(78,201,232,0.35); }

  /* CARDS */
  .pf-card { background:#fff; border-radius:20px; box-shadow:0 2px 12px rgba(0,0,0,0.07);
    border:1px solid rgba(0,0,0,0.05); overflow:hidden; }

  /* STAT STRIP */
  .stat-row { display:grid; grid-template-columns:1fr 1fr 1fr; }
  .stat-cell { padding:14px 10px; text-align:center; position:relative; }
  .stat-cell:not(:last-child)::after { content:''; position:absolute; right:0; top:18%; bottom:18%;
    width:1px; background:#f0f0ee; }

  /* FORM */
  .pf-label { font-size:10px; font-weight:700; color:#9ca3af; text-transform:uppercase;
    letter-spacing:0.07em; margin:0 0 6px; }
  .pf-input-wrap { position:relative; }
  .pf-input { width:100%; background:#f7f7f5; border:1.5px solid #ebebeb; border-radius:12px;
    padding:11px 14px 11px 42px; font-size:14px; color:#111; outline:none;
    font-family:inherit; transition:all 0.15s; }
  .pf-input:focus { border-color:#d4af37; background:#fff;
    box-shadow:0 0 0 3px rgba(212,175,55,0.1); }
  .pf-icon { position:absolute; left:13px; top:50%; transform:translateY(-50%); color:#c4c4c4; flex-shrink:0; }
  .pf-textarea { width:100%; background:#f7f7f5; border:1.5px solid #ebebeb; border-radius:12px;
    padding:11px 14px 11px 42px; font-size:14px; color:#111; outline:none;
    font-family:inherit; transition:all 0.15s; resize:none; }
  .pf-textarea:focus { border-color:#d4af37; background:#fff;
    box-shadow:0 0 0 3px rgba(212,175,55,0.1); }
  .pf-icon-top { position:absolute; left:13px; top:13px; color:#c4c4c4; }

  /* PROGRESS */
  .prog-track { height:5px; background:#f0f0ee; border-radius:100px; overflow:hidden; margin-top:8px; }
  .prog-gold { height:100%; border-radius:100px;
    background:linear-gradient(90deg,#92600a,#d4af37,#f5d060); }

  /* BUTTONS */
  .btn-gold { width:100%; padding:13px; border-radius:14px; border:none;
    background:linear-gradient(135deg,#b8860b,#d4af37,#f5d060); color:#0d0d0d;
    font-size:14px; font-weight:700; cursor:pointer; font-family:inherit;
    display:flex; align-items:center; justify-content:center; gap:8px;
    transition:opacity 0.15s; }
  .btn-gold:disabled { opacity:0.45; cursor:not-allowed; }
  .btn-indigo { width:100%; padding:13px; border-radius:14px; border:none;
    background:linear-gradient(135deg,#4f46e5,#6366f1); color:#fff;
    font-size:14px; font-weight:700; cursor:pointer; font-family:inherit;
    display:flex; align-items:center; justify-content:center; gap:8px;
    transition:opacity 0.15s; }
  .btn-indigo:disabled { opacity:0.45; cursor:not-allowed; }
  .btn-text { background:none; border:none; font-family:inherit; cursor:pointer; }

  /* SECTION ROW */
  .sec-row { display:flex; align-items:center; gap:12px; padding:14px 16px;
    border-bottom:1px solid #f7f7f5; }
  .sec-row:last-child { border-bottom:none; }
  .sec-ico { width:38px; height:38px; border-radius:12px;
    display:flex; align-items:center; justify-content:center; flex-shrink:0; }

  /* STRENGTH BAR */
  .str-bar { display:flex; gap:4px; margin-top:6px; }
  .str-seg { flex:1; height:3px; border-radius:2px; transition:background 0.3s; }

  /* TOAST */
  .toast { position:fixed; top:20px; left:50%; transform:translateX(-50%);
    z-index:9999; padding:10px 22px; border-radius:100px; font-size:13px; font-weight:600;
    font-family:inherit; white-space:nowrap; box-shadow:0 8px 28px rgba(0,0,0,0.18);
    animation:slideDown 0.25s ease; }
  .toast-ok  { background:#0d0d0d; color:#d4af37; }
  .toast-err { background:#dc2626; color:#fff; }
`

const TIER_CFG = {
  GOLD:     { pill:'tier-gold',     gradient:'linear-gradient(135deg,#d4af37,#f5d060)', label:'GOLD MEMBER' },
  SILVER:   { pill:'tier-silver',   gradient:'linear-gradient(135deg,#9ca3af,#d1d5db)', label:'SILVER MEMBER' },
  PLATINUM: { pill:'tier-platinum', gradient:'linear-gradient(135deg,#0891b2,#67e8f9)', label:'PLATINUM MEMBER' },
}

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<UserType | null>(null)
  const [form, setForm] = useState({ full_name:'', phone:'', email:'', address:'' })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{ msg:string; ok:boolean } | null>(null)
  const [pwOpen, setPwOpen] = useState(false)
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [savingPass, setSavingPass] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')
      const { data } = await supabase.from('users').select('*').eq('id', user!.id).single()
      if (data) { setUser(data); setForm({ full_name:data.full_name||'', phone:data.phone||'', email:data.email||'', address:data.address||'' }) }
    }
    load()
  }, [])

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('users').update(form).eq('id', user!.id)
    setSaving(false)
    if (!error) { setUser(u => u ? { ...u, ...form } : u); showToast('บันทึกสำเร็จแล้ว', true) }
    else showToast('บันทึกไม่สำเร็จ กรุณาลองใหม่', false)
  }

  async function changePassword() {
    if (newPass.length < 8) { showToast('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร', false); return }
    if (newPass !== confirmPass) { showToast('รหัสผ่านไม่ตรงกัน', false); return }
    setSavingPass(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass })
      if (error) throw error
      showToast('เปลี่ยนรหัสผ่านสำเร็จ', true)
      setNewPass(''); setConfirmPass(''); setPwOpen(false)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด', false)
    } finally { setSavingPass(false) }
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true)
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/users/me/avatar', { method:'POST', body:fd })
    const data = await res.json()
    if (data.url) { setUser(u => u ? { ...u, profile_image_url:data.url } : u); showToast('เปลี่ยนรูปสำเร็จ', true) }
    else showToast('อัพโหลดไม่สำเร็จ', false)
    setUploading(false)
  }

  if (!user) return (
    <div style={{ minHeight:'100vh', background:'#f0f0ee', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Prompt,system-ui' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:36, height:36, border:'3px solid #f0f0ee', borderTop:'3px solid #d4af37', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 10px' }}/>
        <p style={{ color:'#9ca3af', fontSize:13, margin:0 }}>กำลังโหลด...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const tc = TIER_CFG[user.tier as keyof typeof TIER_CFG] || TIER_CFG.SILVER
  const init = (user.full_name || 'U').split(' ').map((n:string) => n[0]).join('').slice(0,2).toUpperCase()
  const tierNext = user.tier === 'SILVER' ? { label:'Gold', max:500 } : user.tier === 'GOLD' ? { label:'Platinum', max:2000 } : null
  const pct = tierNext ? Math.min(100, Math.round(user.lifetime_points / tierNext.max * 100)) : 100
  const passOk = newPass.length >= 8 && newPass === confirmPass
  const strength = newPass.length === 0 ? 0 : newPass.length < 8 ? 1 : newPass.length < 12 ? 2 : newPass.length < 16 ? 3 : 4
  const strengthColor = ['#e5e7eb','#dc2626','#f59e0b','#3b82f6','#16a34a']
  const strengthLabel = ['','สั้นเกินไป','ปานกลาง','ดี','แข็งแกร่ง']

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />
      {toast && <div className={`toast ${toast.ok ? 'toast-ok' : 'toast-err'}`}>{toast.msg}</div>}
      <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={uploadAvatar}/>

      <div className="pfw">

        {/* ── DARK HEADER ── */}
        <div className="pf-hdr">
          <div className="pf-hdr-glow"/><div className="pf-hdr-line"/>
          {/* Avatar + name centered */}
          <div style={{ position:'relative', zIndex:1, textAlign:'center' }}>
            <div className="av-wrap">
              {user.profile_image_url
                ? <img src={user.profile_image_url} alt="" className="av-img"/>
                : <div className="av-ring" style={{ background: tc.gradient }}>{init}</div>}
              <button className="av-btn" onClick={() => fileRef.current?.click()} style={{ border:'none', padding:0 }}>
                {uploading
                  ? <div style={{ width:10, height:10, border:'2px solid rgba(0,0,0,0.2)', borderTop:'2px solid #0d0d0d', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
                  : <Camera size={12} color="#0d0d0d"/>}
              </button>
            </div>
            <h1 style={{ color:'#fff', fontSize:20, fontWeight:700, margin:'12px 0 2px' }}>
              {user.full_name || 'สมาชิก'}
            </h1>
            <p style={{ color:'rgba(255,255,255,0.38)', fontSize:11, margin:'0 0 4px', fontFamily:'monospace', letterSpacing:'0.1em' }}>
              {user.member_id}
            </p>
            <span className={`tier-pill ${tc.pill}`}>✦ {tc.label}</span>
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{ padding:'0 16px', marginTop:-36, position:'relative', zIndex:2, display:'flex', flexDirection:'column', gap:12 }}>

          {/* Stat Strip */}
          <div className="pf-card">
            <div className="stat-row">
              <div className="stat-cell">
                <p style={{ fontSize:19, fontWeight:800, color:'#d4af37', margin:'0 0 2px', lineHeight:1 }}>{user.total_points.toLocaleString()}</p>
                <p style={{ fontSize:9, color:'#9ca3af', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em', margin:0 }}>คะแนนคงเหลือ</p>
              </div>
              <div className="stat-cell">
                <p style={{ fontSize:19, fontWeight:800, color:'#7c3aed', margin:'0 0 2px', lineHeight:1 }}>{user.lifetime_points.toLocaleString()}</p>
                <p style={{ fontSize:9, color:'#9ca3af', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em', margin:0 }}>สะสมตลอดกาล</p>
              </div>
              <div className="stat-cell">
                <p style={{ fontSize:19, fontWeight:800, color:'#0891b2', margin:'0 0 2px', lineHeight:1 }}>{user.tier}</p>
                <p style={{ fontSize:9, color:'#9ca3af', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em', margin:0 }}>ระดับสมาชิก</p>
              </div>
            </div>
            {/* Tier progress */}
            {tierNext && (
              <div style={{ padding:'0 16px 14px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <TrendingUp size={12} color="#d4af37"/>
                    <span style={{ fontSize:11, fontWeight:600, color:'#374151' }}>สู่ระดับ <span style={{ color:'#b8860b' }}>{tierNext.label}</span></span>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, color:'#d4af37' }}>{pct}%</span>
                </div>
                <div className="prog-track">
                  <div className="prog-gold" style={{ width:`${pct}%` }}/>
                </div>
              </div>
            )}
          </div>

          {/* Personal Info */}
          <div className="pf-card" style={{ padding:'18px 16px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <div style={{ width:36, height:36, borderRadius:11, background:'#0d0d0d', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <User size={16} color="#d4af37"/>
              </div>
              <div>
                <p style={{ fontSize:14, fontWeight:700, color:'#111', margin:0 }}>ข้อมูลส่วนตัว</p>
                <p style={{ fontSize:11, color:'#9ca3af', margin:0 }}>ชื่อ, เบอร์, ที่อยู่</p>
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {/* Name */}
              <div>
                <p className="pf-label">ชื่อ-นามสกุล</p>
                <div className="pf-input-wrap">
                  <User size={15} className="pf-icon" style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'#c4c4c4' }}/>
                  <input className="pf-input" type="text" placeholder="ชื่อ นามสกุล"
                    value={form.full_name} onChange={e => setForm(f=>({...f,full_name:e.target.value}))}/>
                </div>
              </div>
              {/* Phone */}
              <div>
                <p className="pf-label">เบอร์โทรศัพท์</p>
                <div className="pf-input-wrap">
                  <Phone size={15} style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'#c4c4c4' }}/>
                  <input className="pf-input" type="tel" placeholder="0812345678"
                    value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))}/>
                </div>
              </div>
              {/* Email */}
              <div>
                <p className="pf-label">อีเมล</p>
                <div className="pf-input-wrap">
                  <Mail size={15} style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'#c4c4c4' }}/>
                  <input className="pf-input" type="email" placeholder="you@example.com"
                    value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))}/>
                </div>
              </div>
              {/* Address */}
              <div>
                <p className="pf-label">ที่อยู่</p>
                <div className="pf-input-wrap">
                  <MapPin size={15} style={{ position:'absolute', left:13, top:12, color:'#c4c4c4' }}/>
                  <textarea className="pf-textarea" rows={3}
                    placeholder="บ้านเลขที่ ถนน แขวง เขต จังหวัด"
                    value={form.address} onChange={e => setForm(f=>({...f,address:e.target.value}))}/>
                </div>
              </div>
            </div>

            <button className="btn-gold" onClick={save} disabled={saving} style={{ marginTop:16 }}>
              {saving
                ? <><div style={{ width:14, height:14, border:'2px solid rgba(0,0,0,0.2)', borderTop:'2px solid #0d0d0d', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/> กำลังบันทึก...</>
                : <><CheckCircle size={15}/> บันทึกข้อมูล</>}
            </button>
          </div>

          {/* Password */}
          <div className="pf-card" style={{ padding:'16px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:36, height:36, borderRadius:11, background:'#eef2ff', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Lock size={16} color="#4f46e5"/>
                </div>
                <div>
                  <p style={{ fontSize:14, fontWeight:700, color:'#111', margin:0 }}>รหัสผ่าน</p>
                  <p style={{ fontSize:11, color:'#9ca3af', margin:0 }}>เปลี่ยนรหัสผ่านของคุณ</p>
                </div>
              </div>
              <button className="btn-text" onClick={() => { setPwOpen(!pwOpen); setNewPass(''); setConfirmPass('') }}
                style={{ fontSize:12, fontWeight:700, color: pwOpen ? '#dc2626' : '#4f46e5',
                  background: pwOpen ? '#fef2f2' : '#eef2ff',
                  padding:'6px 14px', borderRadius:10,
                  border: pwOpen ? '1px solid #fecaca' : '1px solid #c7d2fe' }}>
                {pwOpen ? 'ยกเลิก' : 'เปลี่ยน'}
              </button>
            </div>

            {pwOpen && (
              <div style={{ marginTop:16, display:'flex', flexDirection:'column', gap:12 }}>
                {/* New password */}
                <div>
                  <p className="pf-label">รหัสผ่านใหม่</p>
                  <div className="pf-input-wrap">
                    <Lock size={15} style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'#c4c4c4' }}/>
                    <input className="pf-input" type={showPass ? 'text' : 'password'}
                      placeholder="อย่างน้อย 8 ตัวอักษร" value={newPass}
                      style={{ paddingRight:44 }}
                      onChange={e => setNewPass(e.target.value)}
                      autoComplete="new-password"/>
                    <button className="btn-text" onClick={() => setShowPass(!showPass)}
                      style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', color:'#9ca3af', padding:0 }}>
                      {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                  {newPass.length > 0 && (
                    <>
                      <div className="str-bar">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="str-seg" style={{ background: i <= strength ? strengthColor[strength] : '#e5e7eb' }}/>
                        ))}
                      </div>
                      <p style={{ fontSize:11, color: strengthColor[strength], margin:'3px 0 0', fontWeight:600 }}>
                        {strengthLabel[strength]}
                      </p>
                    </>
                  )}
                </div>
                {/* Confirm password */}
                <div>
                  <p className="pf-label">ยืนยันรหัสผ่านใหม่</p>
                  <div className="pf-input-wrap">
                    <Lock size={15} style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'#c4c4c4' }}/>
                    <input className="pf-input" type={showPass ? 'text' : 'password'}
                      placeholder="กรอกอีกครั้ง" value={confirmPass}
                      onChange={e => setConfirmPass(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && passOk && changePassword()}
                      autoComplete="new-password"/>
                  </div>
                  {confirmPass.length > 0 && (
                    <p style={{ fontSize:11, color: confirmPass === newPass ? '#16a34a' : '#dc2626', margin:'3px 0 0', fontWeight:600 }}>
                      {confirmPass === newPass ? '✓ รหัสผ่านตรงกัน' : '✗ รหัสผ่านไม่ตรงกัน'}
                    </p>
                  )}
                </div>
                <button className="btn-indigo" onClick={changePassword} disabled={savingPass || !passOk}>
                  {savingPass
                    ? <><div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid #fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/> กำลังบันทึก...</>
                    : <><Lock size={14}/> บันทึกรหัสผ่านใหม่</>}
                </button>
              </div>
            )}
          </div>

          {/* Menu Rows */}
          <div className="pf-card">
            {[
              { icon:<Shield size={16} color="#7c3aed"/>, bg:'#f5f3ff', label:'ความเป็นส่วนตัว', sub:'จัดการข้อมูลของคุณ' },
              { icon:<Mail size={16} color="#0891b2"/>,   bg:'#eff6ff', label:'การแจ้งเตือน',    sub:'SMS และอีเมล' },
            ].map((r, i) => (
              <div key={r.label} className="sec-row">
                <div className="sec-ico" style={{ background: r.bg }}>{r.icon}</div>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:13, fontWeight:600, color:'#111', margin:'0 0 1px' }}>{r.label}</p>
                  <p style={{ fontSize:11, color:'#9ca3af', margin:0 }}>{r.sub}</p>
                </div>
                <ChevronRight size={16} color="#d1d5db"/>
              </div>
            ))}
          </div>

          {/* Logout */}
          <button onClick={() => { supabase.auth.signOut(); router.push('/login') }}
            style={{ width:'100%', padding:'14px', borderRadius:18, border:'1.5px solid #fecaca',
              background:'#fff', color:'#dc2626', fontSize:14, fontWeight:700,
              fontFamily:'inherit', cursor:'pointer', display:'flex', alignItems:'center',
              justifyContent:'center', gap:8 }}>
            <LogOut size={15}/> ออกจากระบบ
          </button>

          <p style={{ textAlign:'center', fontSize:11, color:'#c4c4c4', margin:'0 0 8px' }}>
            Dreame Thailand Membership v2.0
          </p>

        </div>
      </div>
    </>
  )
}