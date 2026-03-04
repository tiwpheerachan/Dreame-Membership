'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User as UserType } from '@/types'

function PressButton({ onClick, disabled, children, style, className }: {
  onClick?: () => void; disabled?: boolean; children: React.ReactNode
  style?: React.CSSProperties; className?: string
}) {
  const [pressed, setPressed] = useState(false)
  return (
    <button onClick={onClick} disabled={disabled} className={className}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{ ...style, transform: pressed ? 'scale(0.96)' : 'scale(1)', transition: 'transform 0.12s cubic-bezier(0.34,1.56,0.64,1), opacity 0.12s', opacity: disabled ? 0.6 : 1 }}>
      {children}
    </button>
  )
}

function GlassInput({ label, icon, type = 'text', value, onChange, placeholder, multiline }: {
  label: string; icon: string; type?: string; value: string
  onChange: (v: string) => void; placeholder?: string; multiline?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const base: React.CSSProperties = {
    width: '100%', fontFamily: 'Prompt,sans-serif',
    background: focused ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.5)',
    border: focused ? '1.5px solid rgba(245,158,11,0.5)' : '1.5px solid rgba(255,255,255,0.7)',
    borderRadius: 14, padding: '12px 14px 12px 44px',
    fontSize: 15, color: '#1a1a2e', outline: 'none',
    backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    transition: 'all 0.2s ease', resize: 'none' as const,
    boxShadow: focused ? '0 0 0 3px rgba(245,158,11,0.12), 0 4px 20px rgba(0,0,0,0.07)' : '0 2px 8px rgba(0,0,0,0.05)',
  }
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8aaa', letterSpacing: '0.07em', textTransform: 'uppercase' as const, marginBottom: 6 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 13, top: multiline ? 13 : '50%', transform: multiline ? 'none' : 'translateY(-50%)', fontSize: 18, pointerEvents: 'none' as const }}>{icon}</span>
        {multiline
          ? <textarea value={value} onChange={e => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder={placeholder} rows={3} style={base} />
          : <input type={type} value={value} onChange={e => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder={placeholder} style={base} />}
      </div>
    </div>
  )
}

const TIER = {
  SILVER:   { g: 'linear-gradient(135deg,#b0b0b0,#e0e0e0,#909090)', glow: 'rgba(180,180,180,0.4)', emoji: '🥈', name: 'Silver' },
  GOLD:     { g: 'linear-gradient(135deg,#f59e0b,#fde68a,#d97706)', glow: 'rgba(245,158,11,0.4)', emoji: '🥇', name: 'Gold' },
  PLATINUM: { g: 'linear-gradient(135deg,#67e8f9,#a5f3fc,#0891b2)', glow: 'rgba(103,232,249,0.4)', emoji: '💎', name: 'Platinum' },
} as const

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<UserType | null>(null)
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', address: '' })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Password change state
  const [pwSection, setPwSection] = useState(false)
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showNewPass, setShowNewPass] = useState(false)
  const [savingPass, setSavingPass] = useState(false)

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2600)
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.push('/login')
      const { data } = await supabase.from('users').select('*').eq('id', session.user.id).single()
      if (data) { setUser(data); setForm({ full_name: data.full_name||'', phone: data.phone||'', email: data.email||'', address: data.address||'' }) }
    }
    load()
  }, [])

  async function save() {
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { error } = await supabase.from('users').update(form).eq('id', session.user.id)
    setSaving(false)
    if (!error) { setUser(u => u ? { ...u, ...form } : u); showToast('บันทึกสำเร็จแล้ว ✓', true) }
    else showToast('บันทึกไม่สำเร็จ กรุณาลองใหม่', false)
  }

  async function changePassword() {
    if (newPass.length < 8) { showToast('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร', false); return }
    if (newPass !== confirmPass) { showToast('รหัสผ่านไม่ตรงกัน', false); return }
    setSavingPass(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass })
      if (error) throw error
      showToast('เปลี่ยนรหัสผ่านสำเร็จ ✓', true)
      setNewPass(''); setConfirmPass(''); setPwSection(false)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด', false)
    } finally { setSavingPass(false) }
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true)
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/users/me/avatar', { method: 'POST', body: fd })
    const data = await res.json()
    if (data.url) { setUser(u => u ? { ...u, profile_image_url: data.url } : u); showToast('เปลี่ยนรูปโปรไฟล์สำเร็จ ✓', true) }
    else showToast('อัพโหลดไม่สำเร็จ', false)
    setUploading(false)
  }

  if (!user) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#fffbf0,#f0f4ff,#fdf0ff)', fontFamily:'Prompt,sans-serif' }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
        <div style={{ width:40, height:40, border:'3px solid rgba(245,158,11,0.2)', borderTop:'3px solid #f59e0b', borderRadius:'50%', animation:'spin 0.9s linear infinite' }} />
        <p style={{ color:'#9ca3af', fontSize:13 }}>กำลังโหลด...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const tier = TIER[user.tier as keyof typeof TIER] || TIER.SILVER
  const initials = (user.full_name||'U').split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase()
  const tierProgress = user.tier === 'SILVER' ? { label:'สู่ Gold', cur:user.lifetime_points, max:500 }
    : user.tier === 'GOLD' ? { label:'สู่ Platinum', cur:user.lifetime_points, max:2000 } : null

  const glass: React.CSSProperties = {
    background: 'rgba(255,255,255,0.58)',
    backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
    border: '1.5px solid rgba(255,255,255,0.8)',
    borderRadius: 24,
    boxShadow: '0 8px 40px rgba(0,0,0,0.07), 0 1px 0 rgba(255,255,255,0.95) inset',
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap');
        * { -webkit-tap-highlight-color:transparent; box-sizing:border-box; }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:none} }
        @keyframes slideDown { from{opacity:0;transform:translateX(-50%) translateY(-10px) scale(0.95)} to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)} }
        @keyframes floatA { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-16px) rotate(3deg)} }
        @keyframes floatB { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-10px) rotate(-2deg)} }
        @keyframes ring { 0%{box-shadow:0 0 0 0 rgba(245,158,11,0.35)} 70%{box-shadow:0 0 0 12px rgba(245,158,11,0)} 100%{box-shadow:0 0 0 0 rgba(245,158,11,0)} }
        input::placeholder, textarea::placeholder { color:#c0c0d0; }
      `}</style>

      {/* BG */}
      <div style={{ position:'fixed', inset:0, background:'linear-gradient(145deg,#fffbf0 0%,#eef2ff 40%,#fdf4ff 75%,#f0fdf4 100%)', zIndex:0, overflow:'hidden' }}>
        <div style={{ position:'absolute', width:320, height:320, top:-100, left:-80, background:'radial-gradient(circle,rgba(251,191,36,0.22),transparent 70%)', borderRadius:'50%', animation:'floatA 9s ease-in-out infinite' }} />
        <div style={{ position:'absolute', width:260, height:260, top:'25%', right:-70, background:'radial-gradient(circle,rgba(167,139,250,0.18),transparent 70%)', borderRadius:'50%', animation:'floatB 11s ease-in-out infinite 2s' }} />
        <div style={{ position:'absolute', width:200, height:200, bottom:'18%', left:'5%', background:'radial-gradient(circle,rgba(34,211,238,0.16),transparent 70%)', borderRadius:'50%', animation:'floatA 13s ease-in-out infinite 4s' }} />
        <div style={{ position:'absolute', width:160, height:160, bottom:-40, right:'15%', background:'radial-gradient(circle,rgba(249,115,22,0.14),transparent 70%)', borderRadius:'50%', animation:'floatB 8s ease-in-out infinite 1s' }} />
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', top:20, left:'50%',
          transform:'translateX(-50%)',
          zIndex:1000,
          background: toast.ok ? 'rgba(16,185,129,0.93)' : 'rgba(239,68,68,0.93)',
          backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
          color:'#fff', fontFamily:'Prompt,sans-serif', fontSize:14, fontWeight:500,
          padding:'10px 24px', borderRadius:100,
          boxShadow:'0 8px 32px rgba(0,0,0,0.18)',
          animation:'slideDown 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          whiteSpace:'nowrap',
        }}>{toast.msg}</div>
      )}

      {/* Content */}
      <div style={{ position:'relative', zIndex:1, minHeight:'100vh', padding:'16px 16px 110px', fontFamily:'Prompt,sans-serif', maxWidth:480, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ paddingTop:12, marginBottom:20, animation:'fadeUp 0.4s ease' }}>
          <h1 style={{ fontSize:26, fontWeight:700, color:'#1a1a2e', margin:0 }}>โปรไฟล์</h1>
          <p style={{ fontSize:13, color:'#9ca3af', margin:'2px 0 0' }}>จัดการข้อมูลส่วนตัวของคุณ</p>
        </div>

        {/* ── Hero Card ── */}
        <div style={{ ...glass, padding:'28px 20px 22px', marginBottom:14, animation:'fadeUp 0.42s ease 0.05s both', textAlign:'center' }}>
          {/* Avatar */}
          <div style={{ position:'relative', display:'inline-block', marginBottom:14 }}>
            <div style={{ width:96, height:96, borderRadius:'50%', background:user.profile_image_url ? 'transparent' : tier.g, padding:user.profile_image_url ? 3 : 0, boxShadow:`0 0 0 4px rgba(255,255,255,0.85), 0 8px 28px ${tier.glow}`, animation:'ring 2.8s ease-in-out infinite' }}>
              {user.profile_image_url
                ? <img src={user.profile_image_url} alt="" style={{ width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover', display:'block' }} />
                : <div style={{ width:'100%', height:'100%', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:30, fontWeight:700, color:'#fff', textShadow:'0 2px 8px rgba(0,0,0,0.25)' }}>{initials}</div>}
            </div>
            <PressButton onClick={() => fileRef.current?.click()} disabled={uploading} style={{ position:'absolute', bottom:1, right:1, width:30, height:30, background:'linear-gradient(135deg,#f59e0b,#d97706)', borderRadius:'50%', border:'2.5px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 14px rgba(245,158,11,0.45)', cursor:'pointer' }}>
              {uploading
                ? <div style={{ width:12, height:12, border:'2px solid rgba(255,255,255,0.35)', borderTop:'2px solid #fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
                : <span style={{ fontSize:13 }}>📷</span>}
            </PressButton>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={uploadAvatar} />

          <h2 style={{ fontSize:20, fontWeight:700, color:'#1a1a2e', margin:'0 0 3px' }}>{user.full_name || 'สมาชิก'}</h2>
          <p style={{ fontSize:12, color:'#9ca3af', fontFamily:'monospace', margin:'0 0 12px' }}>{user.member_id}</p>

          <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 16px', background:tier.g, borderRadius:100, boxShadow:`0 4px 18px ${tier.glow}`, marginBottom:18 }}>
            <span style={{ fontSize:14 }}>{tier.emoji}</span>
            <span style={{ fontSize:12, fontWeight:700, color:'#fff', textShadow:'0 1px 4px rgba(0,0,0,0.2)', letterSpacing:'0.05em' }}>{tier.name} Member</span>
          </div>

          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1px 1fr 1px 1fr' }}>
            {[
              { label:'คะแนนคงเหลือ', val:user.total_points.toLocaleString(), color:'#f59e0b' },
              null,
              { label:'สะสมตลอดกาล', val:user.lifetime_points.toLocaleString(), color:'#8b5cf6' },
              null,
              { label:'Tier', val:user.tier, color:'#06b6d4' },
            ].map((item, i) => item === null
              ? <div key={i} style={{ background:'rgba(0,0,0,0.06)', width:1 }} />
              : <div key={i} style={{ padding:'8px 4px', textAlign:'center' }}>
                  <p style={{ fontSize:16, fontWeight:700, color:item.color, margin:0 }}>{item.val}</p>
                  <p style={{ fontSize:10, color:'#9ca3af', margin:'2px 0 0', lineHeight:1.3 }}>{item.label}</p>
                </div>)}
          </div>

          {/* Progress */}
          {tierProgress && (
            <div style={{ marginTop:14, padding:'10px 14px', background:'rgba(245,158,11,0.07)', borderRadius:14, border:'1px solid rgba(245,158,11,0.14)', textAlign:'left' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ fontSize:11, color:'#9ca3af' }}>ความคืบหน้า{tierProgress.label}</span>
                <span style={{ fontSize:11, fontWeight:600, color:'#f59e0b' }}>{Math.min(tierProgress.cur,tierProgress.max).toLocaleString()} / {tierProgress.max.toLocaleString()}</span>
              </div>
              <div style={{ height:6, background:'rgba(0,0,0,0.07)', borderRadius:100, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${Math.min(100,(tierProgress.cur/tierProgress.max)*100)}%`, background:tier.g, borderRadius:100, transition:'width 1s cubic-bezier(0.34,1.56,0.64,1)' }} />
              </div>
              {tierProgress.cur < tierProgress.max && <p style={{ fontSize:10, color:'#9ca3af', marginTop:4 }}>อีก {(tierProgress.max-tierProgress.cur).toLocaleString()} คะแนน</p>}
            </div>
          )}
        </div>

        {/* ── Edit Form ── */}
        <div style={{ ...glass, padding:'20px 18px', marginBottom:14, animation:'fadeUp 0.42s ease 0.10s both' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
            <div style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg,#f59e0b,#d97706)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>✏️</div>
            <h2 style={{ fontSize:15, fontWeight:600, color:'#1a1a2e', margin:0 }}>ข้อมูลส่วนตัว</h2>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
            <GlassInput label="ชื่อ-นามสกุล" icon="👤" value={form.full_name} onChange={v => setForm(f=>({...f,full_name:v}))} placeholder="ชื่อ นามสกุล" />
            <GlassInput label="เบอร์โทรศัพท์" icon="📱" type="tel" value={form.phone} onChange={v => setForm(f=>({...f,phone:v}))} placeholder="0812345678" />
            <GlassInput label="อีเมล" icon="✉️" type="email" value={form.email} onChange={v => setForm(f=>({...f,email:v}))} placeholder="you@example.com" />
            <GlassInput label="ที่อยู่" icon="📍" value={form.address} onChange={v => setForm(f=>({...f,address:v}))} placeholder="บ้านเลขที่ ถนน แขวง เขต จังหวัด" multiline />
          </div>
          <PressButton onClick={save} disabled={saving} style={{ width:'100%', marginTop:18, background:saving?'rgba(245,158,11,0.55)':'linear-gradient(135deg,#f59e0b,#d97706)', border:'none', borderRadius:16, padding:'14px 0', fontSize:15, fontWeight:600, fontFamily:'Prompt,sans-serif', color:'#fff', cursor:saving?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 6px 24px rgba(245,158,11,0.32)' }}>
            {saving
              ? <><div style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.35)', borderTop:'2px solid #fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} /> กำลังบันทึก...</>
              : <><span>💾</span> บันทึกการเปลี่ยนแปลง</>}
          </PressButton>
        </div>

        {/* ── Password Section ── */}
        <div style={{ ...glass, padding:'20px 18px', marginBottom:14, animation:'fadeUp 0.42s ease 0.13s both' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: pwSection ? 18 : 0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg,#6366f1,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🔑</div>
              <div>
                <h2 style={{ fontSize:15, fontWeight:600, color:'#1a1a2e', margin:0 }}>รหัสผ่าน</h2>
                <p style={{ fontSize:11, color:'#9ca3af', margin:'2px 0 0' }}>เปลี่ยนรหัสผ่านของคุณ</p>
              </div>
            </div>
            <PressButton onClick={() => { setPwSection(!pwSection); setNewPass(''); setConfirmPass('') }}
              style={{ background: pwSection ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)', border: `1px solid ${pwSection ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)'}`, borderRadius:10, padding:'7px 14px', fontSize:12, fontWeight:600, color: pwSection ? '#ef4444' : '#6366f1', cursor:'pointer', fontFamily:'Prompt,sans-serif' }}>
              {pwSection ? 'ยกเลิก' : 'เปลี่ยน'}
            </PressButton>
          </div>

          {pwSection && (
            <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
              {/* New Password */}
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#8a8aaa', letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:6 }}>รหัสผ่านใหม่</label>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', fontSize:18, pointerEvents:'none' }}>🔒</span>
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    placeholder="อย่างน้อย 8 ตัวอักษร"
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                    autoComplete="new-password"
                    style={{ width:'100%', fontFamily:'Prompt,sans-serif', background:'rgba(255,255,255,0.6)', border:'1.5px solid rgba(255,255,255,0.7)', borderRadius:14, padding:'12px 44px 12px 44px', fontSize:15, color:'#1a1a2e', outline:'none', boxSizing:'border-box' }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; e.target.style.background = 'rgba(255,255,255,0.85)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.7)'; e.target.style.background = 'rgba(255,255,255,0.6)' }}
                  />
                  <button onClick={() => setShowNewPass(!showNewPass)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:16, padding:0, color:'#9ca3af' }}>
                    {showNewPass ? '🙈' : '👁️'}
                  </button>
                </div>
                {/* Strength bar */}
                {newPass && (
                  <div style={{ marginTop:6 }}>
                    <div style={{ display:'flex', gap:4, marginBottom:4 }}>
                      {[1,2,3,4].map(i => (
                        <div key={i} style={{ flex:1, height:3, borderRadius:2, transition:'background 0.3s', background: newPass.length >= i*2+2 ? (newPass.length >= 12 ? '#4ade80' : newPass.length >= 8 ? '#f59e0b' : '#ef4444') : 'rgba(0,0,0,0.08)' }} />
                      ))}
                    </div>
                    <p style={{ fontSize:11, margin:0, color: newPass.length >= 12 ? '#16a34a' : newPass.length >= 8 ? '#d97706' : '#dc2626' }}>
                      {newPass.length >= 12 ? '✓ รหัสผ่านแข็งแกร่ง' : newPass.length >= 8 ? '~ รหัสผ่านปานกลาง' : '✗ สั้นเกินไป'}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#8a8aaa', letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:6 }}>ยืนยันรหัสผ่านใหม่</label>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', fontSize:18, pointerEvents:'none' }}>🔒</span>
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    placeholder="กรอกรหัสผ่านอีกครั้ง"
                    value={confirmPass}
                    onChange={e => setConfirmPass(e.target.value)}
                    autoComplete="new-password"
                    style={{ width:'100%', fontFamily:'Prompt,sans-serif', background:'rgba(255,255,255,0.6)', border:`1.5px solid ${confirmPass && confirmPass !== newPass ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.7)'}`, borderRadius:14, padding:'12px 14px 12px 44px', fontSize:15, color:'#1a1a2e', outline:'none', boxSizing:'border-box' }}
                    onFocus={e => { e.target.style.background = 'rgba(255,255,255,0.85)' }}
                    onBlur={e => { e.target.style.background = 'rgba(255,255,255,0.6)' }}
                    onKeyDown={e => { if (e.key === 'Enter') changePassword() }}
                  />
                </div>
                {confirmPass && (
                  <p style={{ fontSize:11, margin:'4px 0 0', color: confirmPass === newPass ? '#16a34a' : '#dc2626' }}>
                    {confirmPass === newPass ? '✓ รหัสผ่านตรงกัน' : '✗ รหัสผ่านไม่ตรงกัน'}
                  </p>
                )}
              </div>

              <PressButton onClick={changePassword} disabled={savingPass || newPass.length < 8 || newPass !== confirmPass}
                style={{ width:'100%', background: newPass.length >= 8 && newPass === confirmPass ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : 'rgba(0,0,0,0.07)', border:'none', borderRadius:16, padding:'14px 0', fontSize:15, fontWeight:600, fontFamily:'Prompt,sans-serif', color: newPass.length >= 8 && newPass === confirmPass ? '#fff' : '#9ca3af', cursor: newPass.length >= 8 && newPass === confirmPass ? 'pointer' : 'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow: newPass.length >= 8 && newPass === confirmPass ? '0 6px 24px rgba(99,102,241,0.3)' : 'none', transition:'all 0.2s' }}>
                {savingPass
                  ? <><div style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.35)', borderTop:'2px solid #fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} /> กำลังบันทึก...</>
                  : <><span>🔑</span> บันทึกรหัสผ่านใหม่</>}
              </PressButton>
            </div>
          )}
        </div>

        {/* ── Quick Actions ── */}
        <div style={{ ...glass, padding:8, marginBottom:14, animation:'fadeUp 0.42s ease 0.15s both' }}>
          {[
            { icon:'🔒', label:'ความเป็นส่วนตัว', sub:'จัดการข้อมูลของคุณ', color:'#8b5cf6' },
            { icon:'🔔', label:'การแจ้งเตือน', sub:'SMS, อีเมล, Push', color:'#06b6d4' },
            { icon:'🎁', label:'โปรแกรม Referral', sub:'เชิญเพื่อน รับแต้มพิเศษ', color:'#10b981' },
          ].map((item, i, arr) => (
            <PressButton key={item.label} style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'12px 12px', background:'transparent', border:'none', borderRadius:16, cursor:'pointer', borderBottom:i<arr.length-1?'1px solid rgba(0,0,0,0.05)':'none', fontFamily:'Prompt,sans-serif' }}>
              <div style={{ width:40, height:40, borderRadius:12, background:`${item.color}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{item.icon}</div>
              <div style={{ flex:1, textAlign:'left' }}>
                <p style={{ fontSize:14, fontWeight:600, color:'#1a1a2e', margin:0 }}>{item.label}</p>
                <p style={{ fontSize:11, color:'#9ca3af', margin:'2px 0 0' }}>{item.sub}</p>
              </div>
              <span style={{ color:'#d1d5db', fontSize:20, fontWeight:300, lineHeight:1 }}>›</span>
            </PressButton>
          ))}
        </div>

        {/* ── Logout ── */}
        <div style={{ animation:'fadeUp 0.42s ease 0.2s both' }}>
          <PressButton onClick={() => { supabase.auth.signOut(); router.push('/login') }}
            style={{ width:'100%', background:'rgba(255,255,255,0.58)', backdropFilter:'blur(28px)', WebkitBackdropFilter:'blur(28px)', border:'1.5px solid rgba(239,68,68,0.25)', borderRadius:20, padding:'14px 0', fontSize:15, fontWeight:600, fontFamily:'Prompt,sans-serif', color:'#ef4444', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 4px 20px rgba(239,68,68,0.07)' }}>
            <span>🚪</span> ออกจากระบบ
          </PressButton>
          <p style={{ textAlign:'center', fontSize:11, color:'#c4c4d4', marginTop:16 }}>Dreame Thailand Membership v2.0</p>
        </div>
      </div>
    </>
  )
}