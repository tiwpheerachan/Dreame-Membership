'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  User, Phone, Mail, MapPin, Lock, Eye, EyeOff,
  Camera, LogOut, ChevronRight, Shield, CheckCircle, Bell,
  Award, Sparkles,
} from 'lucide-react'
import type { User as UserType, UserTier } from '@/types'
import { normalizeTier } from '@/lib/tier'

// Tier-specific palette so the hero card matches the rest of the app's
// tier-aware aesthetic (home stage uses the same hues).
const TIER_THEME: Record<UserTier, {
  ring: string             // gradient around the avatar
  bg: string               // hero card background
  accent: string           // inline accent color
  glow: string             // soft radial decoration
  starColor: string        // colour for sparkles + shooting stars (matches home hero)
  label: string
}> = {
  SILVER: {
    ring:      'linear-gradient(135deg,#E2E8F2,#A8B4CC,#DDD0E5)',
    bg:        'linear-gradient(160deg,#F4F8FF 0%,#ECEFF7 50%,#EDE5F0 100%)',
    accent:    '#3A4565',
    glow:      'rgba(120,140,200,0.22)',
    starColor: '#7B8AB8',
    label:     'Silver',
  },
  GOLD: {
    ring:      'linear-gradient(135deg,#FAF3DC,#EADBB1,#A0782B)',
    bg:        'linear-gradient(160deg,#FFFCF6 0%,#FFF1DD 50%,#FCE2BD 100%)',
    accent:    '#5B3417',
    glow:      'rgba(255,166,77,0.24)',
    starColor: '#FF8A3D',
    label:     'Gold',
  },
  PLATINUM: {
    ring:      'linear-gradient(135deg,#DCFAF3,#7DD8C5,#0E9488)',
    bg:        'linear-gradient(160deg,#F4FBF8 0%,#DAF2EA 50%,#BBE6D7 100%)',
    accent:    '#0A4A42',
    glow:      'rgba(20,184,166,0.22)',
    starColor: '#0E9488',
    label:     'Platinum',
  },
}

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<UserType | null>(null)
  const [form, setForm] = useState({ full_name: '', phone: '', address: '' })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [pwOpen, setPwOpen] = useState(false)
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [savingPass, setSavingPass] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2400)
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return router.push('/login')
      const { data } = await supabase.from('users').select('*').eq('id', authUser.id).single()
      if (data) {
        setUser(data)
        setForm({ full_name: data.full_name || '', phone: data.phone || '', address: data.address || '' })
      }
    }
    load()
  }, [])

  async function changeEmail() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { showToast('อีเมลไม่ถูกต้อง', false); return }
    setSavingEmail(true)
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail })
      if (error) throw error
      showToast('ส่งลิงก์ยืนยันไปที่อีเมลใหม่แล้ว', true)
      setEmailOpen(false); setNewEmail('')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด', false)
    } finally { setSavingEmail(false) }
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || 'บันทึกไม่สำเร็จ', false)
        return
      }
      setUser(u => u ? { ...u, ...form } : u)
      showToast('บันทึกเรียบร้อย', true)
    } catch {
      showToast('บันทึกไม่สำเร็จ', false)
    } finally { setSaving(false) }
  }

  async function changePassword() {
    if (newPass.length < 8) { showToast('รหัสผ่านต้องอย่างน้อย 8 ตัวอักษร', false); return }
    if (newPass !== confirmPass) { showToast('รหัสผ่านไม่ตรงกัน', false); return }
    setSavingPass(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass })
      if (error) throw error
      showToast('เปลี่ยนรหัสผ่านเรียบร้อย', true)
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
    const res = await fetch('/api/users/me/avatar', { method: 'POST', body: fd })
    const data = await res.json()
    if (data.url) {
      setUser(u => u ? { ...u, profile_image_url: data.url } : u)
      showToast('เปลี่ยนรูปสำเร็จ', true)
    } else {
      showToast(data.error || 'อัพโหลดไม่สำเร็จ', false)
    }
    setUploading(false)
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{
          width: 28, height: 28,
          border: '2px solid var(--ink-ghost)',
          borderTopColor: 'var(--gold)',
          borderRadius: '50%',
        }} />
      </div>
    )
  }

  const tier = normalizeTier(user.tier as string)
  const theme = TIER_THEME[tier]
  const initials = (user.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const strLen = newPass.length
  const strength = strLen === 0 ? 0 : strLen < 8 ? 1 : strLen < 12 ? 2 : strLen < 16 ? 3 : 4
  const strColors = ['var(--ink-ghost)', 'var(--red)', 'var(--amber)', '#3D6CC4', 'var(--green)']
  const strLabels = ['', 'สั้นเกินไป', 'ปานกลาง', 'ดี', 'แข็งแกร่ง']

  return (
    <div className="page-enter" style={{ paddingTop: 18, paddingBottom: 32 }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 100, padding: '10px 22px', borderRadius: 'var(--r-pill)',
          background: toast.ok ? 'var(--black)' : 'var(--red)',
          color: toast.ok ? 'var(--gold-soft)' : '#fff',
          fontSize: 12.5, fontWeight: 600,
          boxShadow: 'var(--shadow-3)',
          animation: 'fade-up 0.3s ease',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header style={{ padding: '14px 20px 18px' }}>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Account Settings</p>
        <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          <span style={{ fontWeight: 800 }}>โปรไฟล์</span>{' '}
          <span className="serif-i" style={{ fontWeight: 400 }}>ของคุณ</span>
        </h1>
      </header>

      {/* ── Hero identity card — animated sparkle stage matching home hero ── */}
      <section style={{ padding: '0 16px 14px' }}>
        <div style={{
          position: 'relative',
          background: theme.bg,
          border: '1px solid rgba(0,0,0,0.06)',
          borderRadius: 'var(--r-lg)',
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(20,18,15,0.05), 0 1px 2px rgba(20,18,15,0.04)',
        }}>
          {/* aurora blobs (slow background drift) */}
          <div aria-hidden className="aurora" style={{
            top: '-20%', left: '-15%', width: 200, height: 200,
            background: theme.starColor, opacity: 0.18,
            animationDelay: '0s',
          }} />
          <div aria-hidden className="aurora" style={{
            bottom: '-20%', right: '-18%', width: 220, height: 220,
            background: theme.starColor, opacity: 0.14,
            animationDelay: '4s',
          }} />

          {/* faint tech grid for "futuristic" feel */}
          <div aria-hidden className="tech-grid" />

          {/* tier-tinted radial glow behind avatar */}
          <div aria-hidden style={{
            position: 'absolute', top: '32%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 260, height: 260, borderRadius: '50%',
            background: theme.glow,
            pointerEvents: 'none',
            filter: 'blur(8px)',
          }} />

          {/* concentric pulse rings around the avatar */}
          {[0, 1.5, 3].map((delay, i) => (
            <div key={`ring-${i}`} aria-hidden className="pulse-ring" style={{
              top: '32%', left: '50%',
              width: 180, height: 180,
              transform: 'translate(-50%, -50%)',
              border: `1.5px solid ${theme.starColor}`,
              opacity: 0.35,
              animationDelay: `${delay}s`,
            }} />
          ))}

          {/* twinkle dots */}
          {[
            { top: '8%',  left: '8%',  size: 3,   delay: '0s',   tone: theme.starColor },
            { top: '14%', left: '88%', size: 2.5, delay: '1.4s', tone: '#fff' },
            { top: '22%', left: '32%', size: 2,   delay: '0.6s', tone: '#fff' },
            { top: '28%', left: '72%', size: 4,   delay: '0.2s', tone: theme.starColor },
            { top: '52%', left: '6%',  size: 2.5, delay: '2.0s', tone: '#fff' },
            { top: '54%', left: '94%', size: 3,   delay: '1.0s', tone: theme.starColor },
            { top: '70%', left: '14%', size: 3.5, delay: '0.4s', tone: theme.starColor },
            { top: '74%', left: '78%', size: 2,   delay: '1.8s', tone: '#fff' },
            { top: '86%', left: '40%', size: 2.5, delay: '0.8s', tone: theme.starColor },
            { top: '90%', left: '62%', size: 3,   delay: '2.4s', tone: '#fff' },
            { top: '40%', left: '20%', size: 1.5, delay: '1.2s', tone: theme.starColor },
            { top: '44%', left: '84%', size: 2,   delay: '2.6s', tone: '#fff' },
          ].map((s, i) => (
            <span key={`tw-${i}`} aria-hidden className="twinkle" style={{
              top: s.top, left: s.left,
              width: s.size, height: s.size,
              background: `radial-gradient(circle, ${s.tone} 0%, transparent 70%)`,
              boxShadow: `0 0 ${s.size * 4}px ${s.tone}`,
              animationDelay: s.delay,
              animationDuration: `${2.4 + (i % 4) * 0.6}s`,
            }} />
          ))}

          {/* cross-shaped sparkle bursts */}
          {[
            { top: '18%', left: '14%', delay: '0s',   color: theme.starColor },
            { top: '36%', left: '90%', delay: '1.4s', color: '#fff' },
            { top: '64%', left: '8%',  delay: '2.0s', color: theme.starColor },
            { top: '80%', left: '70%', delay: '0.6s', color: '#fff' },
          ].map((s, i) => (
            <span key={`cr-${i}`} aria-hidden className="spark-cross" style={{
              top: s.top, left: s.left,
              color: s.color,
              animationDelay: s.delay,
            }} />
          ))}

          {/* drifting upward particles */}
          {[
            { top: '88%', left: '18%', size: 3, delay: '0s',   tone: theme.starColor },
            { top: '90%', left: '50%', size: 2, delay: '2s',   tone: '#fff' },
            { top: '85%', left: '82%', size: 3, delay: '3.5s', tone: theme.starColor },
          ].map((s, i) => (
            <span key={`dr-${i}`} aria-hidden className="drift" style={{
              top: s.top, left: s.left,
              width: s.size, height: s.size,
              background: s.tone,
              boxShadow: `0 0 ${s.size * 4}px ${s.tone}`,
              animationDelay: s.delay,
            }} />
          ))}

          {/* ambient star glyphs (✦) */}
          {[
            { top: '12%', left: '22%', size: 12, delay: '0s',   opacity: 0.65 },
            { top: '20%', left: '80%', size: 10, delay: '0.7s', opacity: 0.50 },
            { top: '60%', left: '90%', size: 12, delay: '1.4s', opacity: 0.55 },
            { top: '78%', left: '10%', size: 14, delay: '2.1s', opacity: 0.60 },
          ].map((s, i) => (
            <span key={`gl-${i}`} aria-hidden style={{
              position: 'absolute', top: s.top, left: s.left,
              fontSize: s.size, color: theme.starColor, opacity: s.opacity,
              animation: `sparkle-spin ${3.2 + (i % 3) * 0.6}s ease-in-out ${s.delay} infinite`,
              textShadow: `0 0 8px ${theme.starColor}`,
              pointerEvents: 'none',
            }}>✦</span>
          ))}

          {/* shooting stars — sweep across the card from left to right */}
          <span aria-hidden className="shooting-star" style={{ top: '14%', left: '-10%', animationDelay: '0s',   animationDuration: '5.5s' }} />
          <span aria-hidden className="shooting-star" style={{ top: '38%', left: '-15%', animationDelay: '2.8s', animationDuration: '6.5s' }} />
          <span aria-hidden className="shooting-star" style={{ top: '72%', left: '-8%',  animationDelay: '5.2s', animationDuration: '5s'   }} />

          <div style={{ position: 'relative', zIndex: 2, padding: '26px 22px 16px', textAlign: 'center' }}>
            {/* Avatar with gold/tier ring */}
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadAvatar} />
              <div style={{
                padding: 3, borderRadius: '50%',
                background: theme.ring,
                boxShadow: '0 8px 24px rgba(20,18,15,0.10), inset 0 1px 0 rgba(255,255,255,0.6)',
              }}>
                {user.profile_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.profile_image_url} alt={user.full_name || 'avatar'}
                    style={{ width: 92, height: 92, borderRadius: '50%', objectFit: 'cover', display: 'block', background: '#fff' }} />
                ) : (
                  <div style={{
                    width: 92, height: 92, borderRadius: '50%',
                    background: '#1A1815',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#EADBB1', fontSize: 30, fontWeight: 800,
                    letterSpacing: '0.02em',
                  }}>{initials}</div>
                )}
              </div>
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="tap-down" style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 30, height: 30, borderRadius: '50%',
                background: '#1A1815', color: '#EADBB1',
                border: '2.5px solid #fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(20,18,15,0.25)',
              }}>
                {uploading ? (
                  <div className="spinner" style={{
                    width: 12, height: 12, border: '2px solid rgba(234,219,177,0.3)',
                    borderTopColor: '#EADBB1', borderRadius: '50%',
                  }} />
                ) : <Camera size={13} />}
              </button>
            </div>

            <h2 className="display" style={{
              margin: '0 0 4px', fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em',
              color: theme.accent,
            }}>
              {user.full_name || 'สมาชิก'}
            </h2>
            <p style={{
              fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.16em',
              color: theme.accent, opacity: 0.6, margin: 0,
            }}>
              {user.member_id}
            </p>

            {/* Stats row */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
              marginTop: 18,
            }}>
              <Stat
                label="คะแนน"
                value={user.total_points.toLocaleString()}
                accent={theme.accent}
                bg="rgba(255,255,255,0.55)"
                border="rgba(0,0,0,0.04)"
              />
              <Stat
                label="สะสม"
                value={user.lifetime_points.toLocaleString()}
                accent={theme.accent}
                bg="rgba(255,255,255,0.55)"
                border="rgba(0,0,0,0.04)"
              />
              <div style={{
                padding: '10px 6px', textAlign: 'center',
                background: 'linear-gradient(135deg,#1A1815,#2A2419)',
                border: '1px solid rgba(0,0,0,0.20)',
                borderRadius: 'var(--r-md)',
                boxShadow: 'inset 0 1px 0 rgba(255,250,235,0.10)',
              }}>
                <p style={{
                  fontSize: 9, color: 'rgba(234,219,177,0.55)',
                  letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700,
                  margin: '0 0 4px',
                }}>
                  Tier
                </p>
                <p className="display" style={{
                  margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: '0.02em',
                  background: 'linear-gradient(135deg,#FAF3DC,#EADBB1,#A0782B)',
                  WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  <Award size={12} color="#EADBB1" /> {theme.label}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Personal information ── */}
      <SectionCard title="Personal Information">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="ชื่อ-นามสกุล" icon={<User size={15}/>}>
            <input className="field" type="text" value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="ชื่อ นามสกุล" style={{ paddingLeft: 42 }} />
          </Field>
          <Field label="เบอร์โทรศัพท์" icon={<Phone size={15}/>}>
            <input className="field" type="tel" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="0812345678" style={{ paddingLeft: 42 }} />
          </Field>
          <Field label="อีเมล" icon={<Mail size={15}/>}>
            <div style={{ position: 'relative' }}>
              <input className="field" type="email" value={user.email || ''} disabled readOnly
                style={{ paddingLeft: 42, paddingRight: 88 }} />
              <button onClick={() => setEmailOpen(o => !o)} className="tap-down" style={{
                position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                padding: '6px 14px', borderRadius: 'var(--r-pill)',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                background: emailOpen ? 'var(--bg-soft)' : 'var(--black)',
                color: emailOpen ? 'var(--ink)' : 'var(--gold-soft)',
                border: 'none', cursor: 'pointer',
              }}>
                {emailOpen ? 'ยกเลิก' : 'เปลี่ยน'}
              </button>
            </div>
            {emailOpen && (
              <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                <input className="field" type="email" placeholder="อีเมลใหม่"
                  value={newEmail} onChange={e => setNewEmail(e.target.value)}
                  style={{ flex: 1 }} />
                <button onClick={changeEmail} disabled={savingEmail || !newEmail} className="btn btn-ink" style={{ padding: '0 16px', fontSize: 12 }}>
                  {savingEmail ? '...' : 'ส่ง'}
                </button>
              </div>
            )}
          </Field>
          <Field label="ที่อยู่" icon={<MapPin size={15}/>} top>
            <textarea className="field" rows={3} value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="บ้านเลขที่ ถนน แขวง เขต จังหวัด"
              style={{ paddingLeft: 42, resize: 'none' }} />
          </Field>
        </div>
        <button onClick={save} disabled={saving} className="btn btn-ink" style={{
          width: '100%', marginTop: 16,
          boxShadow: '0 4px 14px rgba(20,18,15,0.18)',
        }}>
          {saving
            ? <><div className="spinner" style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%' }} /> กำลังบันทึก...</>
            : <><CheckCircle size={14} /> บันทึก</>}
        </button>
      </SectionCard>

      {/* ── Security ── */}
      <SectionCard title="Security">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(160deg,#FAFAF8 0%,#F0EFEB 100%)',
            border: '1px solid var(--hair)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ink-soft)', flexShrink: 0,
          }}>
            <Lock size={17} strokeWidth={1.8} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>รหัสผ่าน</p>
            <p className="serif-i" style={{ fontSize: 11.5, color: 'var(--ink-mute)', margin: '2px 0 0' }}>
              อัปเดตรหัสผ่านเพื่อความปลอดภัยของบัญชี
            </p>
          </div>
          <button onClick={() => { setPwOpen(o => !o); setNewPass(''); setConfirmPass('') }} className="tap-down" style={{
            padding: '7px 14px', borderRadius: 'var(--r-pill)',
            fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em',
            background: pwOpen ? 'var(--red-soft)' : 'var(--ink)',
            color: pwOpen ? 'var(--red)' : 'var(--gold-soft)',
            border: 'none', cursor: 'pointer', flexShrink: 0,
          }}>
            {pwOpen ? 'ยกเลิก' : 'เปลี่ยน'}
          </button>
        </div>

        {pwOpen && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="รหัสผ่านใหม่" icon={<Lock size={15}/>}>
              <div style={{ position: 'relative' }}>
                <input className="field" type={showPass ? 'text' : 'password'} value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                  style={{ paddingLeft: 42, paddingRight: 42 }} autoComplete="new-password" />
                <button onClick={() => setShowPass(s => !s)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer',
                }}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {newPass.length > 0 && (
                <>
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{
                        flex: 1, height: 3, borderRadius: 2,
                        background: i <= strength ? strColors[strength] : 'var(--ink-ghost)',
                        transition: 'background 0.2s ease',
                      }} />
                    ))}
                  </div>
                  <p style={{ fontSize: 10.5, margin: '4px 0 0', color: strColors[strength], fontWeight: 600 }}>
                    {strLabels[strength]}
                  </p>
                </>
              )}
            </Field>
            <Field label="ยืนยันรหัสผ่านใหม่" icon={<Lock size={15}/>}>
              <input className="field" type={showPass ? 'text' : 'password'} value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)}
                placeholder="กรอกอีกครั้ง" style={{ paddingLeft: 42 }} autoComplete="new-password"
                onKeyDown={e => e.key === 'Enter' && changePassword()} />
              {confirmPass.length > 0 && (
                <p style={{
                  fontSize: 10.5, margin: '4px 0 0', fontWeight: 600,
                  color: confirmPass === newPass ? 'var(--green)' : 'var(--red)',
                }}>
                  {confirmPass === newPass ? '✓ รหัสผ่านตรงกัน' : '✗ รหัสผ่านไม่ตรงกัน'}
                </p>
              )}
            </Field>
            <button onClick={changePassword} disabled={savingPass || newPass.length < 8 || newPass !== confirmPass}
              className="btn btn-ink" style={{ width: '100%' }}>
              {savingPass ? '...' : <><Lock size={13} /> เปลี่ยนรหัสผ่าน</>}
            </button>
          </div>
        )}
      </SectionCard>

      {/* ── Notifications & privacy ── */}
      <section style={{ padding: '0 16px 14px' }}>
        <div style={{
          background: '#fff',
          border: '1px solid var(--hair)',
          borderRadius: 'var(--r-lg)',
          overflow: 'hidden',
          boxShadow: '0 2px 12px rgba(20,18,15,0.04)',
        }}>
          {[
            { Icon: Bell,   label: 'การแจ้งเตือน',     sub: 'จัดการอีเมล + SMS', color: '#FFEDD5', iconColor: '#9A6E1F', href: '/notifications' },
            { Icon: Shield, label: 'ความเป็นส่วนตัว', sub: 'จัดการข้อมูลของคุณ',  color: '#E8F6EC', iconColor: '#1F6B33', href: '/terms' },
          ].map((r, i, arr) => (
            <Link key={r.label} href={r.href} className="tap-down" style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 18px',
              borderBottom: i < arr.length - 1 ? '1px solid var(--hair)' : 'none',
              cursor: 'pointer',
              textDecoration: 'none', color: 'inherit',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 11,
                background: r.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: r.iconColor, flexShrink: 0,
              }}>
                <r.Icon size={16} strokeWidth={1.8} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, margin: 0 }}>{r.label}</p>
                <p className="serif-i" style={{ fontSize: 11, color: 'var(--ink-mute)', margin: '2px 0 0' }}>{r.sub}</p>
              </div>
              <ChevronRight size={16} color="var(--ink-faint)" />
            </Link>
          ))}
        </div>
      </section>

      {/* ── Logout ── */}
      <div style={{ padding: '4px 16px 24px' }}>
        <button onClick={() => { supabase.auth.signOut(); router.push('/login') }} className="tap-down" style={{
          width: '100%', padding: '14px',
          background: '#fff', border: '1px solid rgba(180,58,58,0.20)',
          color: 'var(--red)', borderRadius: 'var(--r-lg)',
          fontSize: 13.5, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          cursor: 'pointer', fontFamily: 'inherit',
          transition: 'background 0.15s, border-color 0.15s',
        }}>
          <LogOut size={15} /> ออกจากระบบ
        </button>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          color: 'var(--ink-faint)',
        }}>
          <span style={{ width: 18, height: 1, background: 'var(--gold)' }} />
          <Sparkles size={9} />
          <span style={{ width: 18, height: 1, background: 'var(--gold)' }} />
        </div>
        <p className="serif-i" style={{
          fontSize: 11.5, color: 'var(--ink-faint)', margin: '8px 0 0',
          letterSpacing: '0.10em',
        }}>
          Maison Dreame · v2.0
        </p>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Helper components
// ────────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ padding: '0 16px 14px' }}>
      <div style={{
        background: '#fff',
        border: '1px solid var(--hair)',
        borderRadius: 'var(--r-lg)',
        boxShadow: '0 2px 12px rgba(20,18,15,0.04)',
        padding: '18px 18px 18px',
      }}>
        <p className="kicker" style={{ margin: '0 0 14px' }}>{title}</p>
        {children}
      </div>
    </section>
  )
}

function Stat({
  label, value, accent, bg, border,
}: {
  label: string; value: string; accent: string; bg: string; border: string;
}) {
  return (
    <div style={{
      padding: '10px 6px', textAlign: 'center',
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 'var(--r-md)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
    }}>
      <p style={{
        fontSize: 9, color: accent, opacity: 0.55,
        letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700,
        margin: '0 0 4px',
      }}>
        {label}
      </p>
      <p className="numerals" style={{
        margin: 0, fontSize: 17, fontWeight: 800, color: accent, letterSpacing: '-0.01em',
      }}>
        {value}
      </p>
    </div>
  )
}

function Field({ label, icon, top, children }: { label: string; icon: React.ReactNode; top?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
        color: 'var(--ink-mute)', margin: '0 0 6px',
      }}>{label}</p>
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 14, top: top ? 14 : '50%',
          transform: top ? 'none' : 'translateY(-50%)',
          color: 'var(--ink-faint)', pointerEvents: 'none', zIndex: 1,
        }}>{icon}</div>
        {children}
      </div>
    </div>
  )
}
