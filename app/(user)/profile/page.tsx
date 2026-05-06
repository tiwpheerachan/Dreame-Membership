'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  User, Phone, Mail, MapPin, Lock, Eye, EyeOff,
  Camera, LogOut, CheckCircle,
  Sparkles, MessageCircle,
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
    <div className="page-enter" style={{ paddingBottom: 32 }}>
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

      {/* ── Hero — top half: uncropped photo · bottom half: gradient blur with content ── */}
      <section style={{ padding: '12px 16px 14px' }}>
        <div style={{
          position: 'relative',
          aspectRatio: '3 / 4',
          borderRadius: 28,
          overflow: 'hidden',
          background: theme.bg,
          boxShadow: '0 12px 36px rgba(20,18,15,0.18), 0 2px 6px rgba(20,18,15,0.08)',
        }}>
          {/* Background photo — anchored to top so the face/head stays visible
              and the bottom of the photo (which gets the blur fade) is where the
              less-important part of the frame sits. */}
          {user.profile_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.profile_image_url}
              alt={user.full_name || 'profile'}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover',
                objectPosition: 'top center',
              }}
            />
          ) : (
            <div aria-hidden style={{
              position: 'absolute', inset: 0,
              background: theme.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: theme.accent, fontSize: 92, fontWeight: 800,
              letterSpacing: '0.02em',
            }}>
              {initials}
            </div>
          )}

          {/* Top corner controls */}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadAvatar} />
          <Link href="/home" aria-label="back" className="tap-down" style={{
            position: 'absolute', top: 16, left: 16, zIndex: 5,
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(20,18,15,0.55)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', textDecoration: 'none', fontSize: 18, fontWeight: 600,
          }}>
            ✕
          </Link>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="upload photo"
            className="tap-down"
            style={{
              position: 'absolute', top: 16, right: 16, zIndex: 5,
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(20,18,15,0.55)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', cursor: 'pointer',
            }}
          >
            {uploading ? (
              <div className="spinner" style={{
                width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff', borderRadius: '50%',
              }} />
            ) : <Camera size={15} />}
          </button>

          {/* Gradient-masked backdrop blur — fades from sharp (top) to fully blurred (bottom).
              No box, no border — just a smooth blur ramp over the lower half of the photo. */}
          <div aria-hidden style={{
            position: 'absolute', inset: 0, zIndex: 2,
            backdropFilter: 'blur(28px) saturate(1.2)',
            WebkitBackdropFilter: 'blur(28px) saturate(1.2)',
            // Mask: invisible at top → fully opaque at ~55% → black at the bottom.
            // backdrop-filter only paints where the element is opaque, so the
            // top half of the photo stays crystal-clear.
            maskImage: 'linear-gradient(to bottom, transparent 0%, transparent 42%, rgba(0,0,0,0.5) 56%, black 72%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, transparent 42%, rgba(0,0,0,0.5) 56%, black 72%)',
          }} />

          {/* Dark vignette over the same fade so white text reads cleanly */}
          <div aria-hidden style={{
            position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none',
            background:
              'linear-gradient(180deg, transparent 38%, rgba(20,18,15,0.18) 55%, rgba(20,18,15,0.55) 100%)',
          }} />

          {/* Content — sits in the bottom half over the blur, no card border */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 4,
            padding: '20px 22px 24px',
            color: '#fff',
          }}>
            <h2 style={{
              margin: 0, fontSize: 28, fontWeight: 700, lineHeight: 1.15,
              letterSpacing: '-0.015em', textAlign: 'center',
              textShadow: '0 2px 12px rgba(0,0,0,0.45)',
            }}>
              {user.full_name || 'สมาชิก Dreame'}
            </h2>
            <p style={{
              margin: '4px 0 18px', textAlign: 'center',
              fontSize: 13, color: 'rgba(255,255,255,0.72)',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
              textShadow: '0 1px 6px rgba(0,0,0,0.35)',
            }}>
              @{user.member_id?.toLowerCase()}
            </p>

            {/* Primary CTA + secondary icon */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18 }}>
              <Link href="/home" className="tap-down" style={{
                flex: 1,
                padding: '13px 18px', borderRadius: 999,
                background: '#fff', color: '#1A1815',
                fontSize: 14, fontWeight: 700, letterSpacing: '0.01em',
                textAlign: 'center', textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(0,0,0,0.20)',
              }}>
                ดูบัตรสมาชิก
              </Link>
              <Link href="/notifications" aria-label="messages" className="tap-down" style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'rgba(255,255,255,0.14)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.22)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', flexShrink: 0, textDecoration: 'none',
              }}>
                <MessageCircle size={17} strokeWidth={1.7} />
              </Link>
            </div>

            {/* Stats row */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4,
            }}>
              <GlassStat label="คะแนน" value={user.total_points.toLocaleString()} />
              <GlassStat label="สะสม"  value={user.lifetime_points.toLocaleString()} />
              <GlassStat
                label="ระดับ"
                value={
                  <span style={{
                    background: 'linear-gradient(135deg,#FAF3DC,#EADBB1,#A0782B)',
                    WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                  }}>{theme.label}</span>
                }
              />
            </div>

            {/* Bio — plain text, no border/box */}
            <p style={{
              marginTop: 14, marginBottom: 0,
              fontSize: 12, lineHeight: 1.55,
              color: 'rgba(255,255,255,0.78)',
              textAlign: 'center',
              textShadow: '0 1px 6px rgba(0,0,0,0.35)',
            }}>
              {form.address?.trim()
                || `สมาชิก ${theme.label} · พร้อมรับสิทธิประโยชน์พิเศษจาก Dreame`}
            </p>
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

function GlassStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 0 }}>
      <p className="numerals" style={{
        margin: 0, fontSize: 22, fontWeight: 700, color: '#fff',
        letterSpacing: '-0.005em', lineHeight: 1.1,
      }}>
        {value}
      </p>
      <p style={{
        margin: '3px 0 0', fontSize: 10.5, fontWeight: 500,
        color: 'rgba(255,255,255,0.62)', letterSpacing: '0.04em',
      }}>
        {label}
      </p>
    </div>
  )
}

// Legacy helper retained for any other call site; the redesigned hero uses GlassStat.
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
