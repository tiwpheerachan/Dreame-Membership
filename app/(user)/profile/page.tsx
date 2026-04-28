'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  User, Phone, Mail, MapPin, Lock, Eye, EyeOff,
  Camera, LogOut, ChevronRight, Shield, CheckCircle, Bell
} from 'lucide-react'
import type { User as UserType } from '@/types'

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

  const initials = (user.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const strLen = newPass.length
  const strength = strLen === 0 ? 0 : strLen < 8 ? 1 : strLen < 12 ? 2 : strLen < 16 ? 3 : 4
  const strColors = ['var(--ink-ghost)', 'var(--red)', 'var(--amber)', '#3D6CC4', 'var(--green)']
  const strLabels = ['', 'สั้นเกินไป', 'ปานกลาง', 'ดี', 'แข็งแกร่ง']

  return (
    <div className="page-enter" style={{ paddingTop: 18 }}>
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
      <header style={{ padding: '14px 20px 22px' }}>
        <p className="eyebrow" style={{ marginBottom: 10 }}>Account Settings</p>
        <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          <span style={{ fontWeight: 800 }}>โปรไฟล์</span>{' '}
          <span className="serif-i" style={{ fontWeight: 400 }}>ของคุณ</span>
        </h1>
      </header>

      {/* Avatar / Identity card */}
      <section style={{ padding: '0 16px 14px' }}>
        <div className="card-product" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '24px 20px', display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadAvatar} />
              {user.profile_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.profile_image_url} alt="" style={{
                  width: 76, height: 76, borderRadius: '50%', objectFit: 'cover',
                  border: '1px solid var(--line)',
                }} />
              ) : (
                <div style={{
                  width: 76, height: 76, borderRadius: '50%',
                  background: 'var(--black)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--gold-soft)', fontSize: 26, fontWeight: 800,
                  letterSpacing: '0.02em',
                }}>{initials}</div>
              )}
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="tap-down" style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--gold)', color: '#fff',
                border: '2px solid #fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}>
                {uploading ? (
                  <div className="spinner" style={{
                    width: 11, height: 11, border: '2px solid rgba(255,255,255,0.2)',
                    borderTopColor: '#fff', borderRadius: '50%',
                  }} />
                ) : <Camera size={12} />}
              </button>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="kicker" style={{ margin: '0 0 4px' }}>Member</p>
              <h2 style={{ margin: '0 0 4px', fontSize: 19, lineHeight: 1.2 }}>
                <span className="serif-i" style={{ fontWeight: 400 }}>{user.full_name || 'สมาชิก'}</span>
              </h2>
              <p style={{
                fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em',
                color: 'var(--ink-mute)', margin: 0,
              }}>
                {user.member_id}
              </p>
            </div>
          </div>
          <div className="bottom-bar" style={{ padding: '12px 20px', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.20em', textTransform: 'uppercase', color: 'var(--gold-soft)' }}>
              {user.tier}
            </span>
            <span className="numerals" style={{ fontSize: 16, color: '#fff' }}>
              {user.total_points.toLocaleString()}
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginLeft: 4 }} className="serif-i">pts</span>
            </span>
          </div>
        </div>
      </section>

      {/* Personal info form */}
      <section style={{ padding: '0 16px 14px' }}>
        <div className="surface" style={{ padding: 18 }}>
          <p className="kicker" style={{ margin: '0 0 14px' }}>Personal Information</p>
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
          <button onClick={save} disabled={saving} className="btn btn-ink" style={{ width: '100%', marginTop: 16 }}>
            {saving ? <><div className="spinner" style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%' }} /> กำลังบันทึก...</> : <><CheckCircle size={14} /> บันทึก</>}
          </button>
        </div>
      </section>

      {/* Password */}
      <section style={{ padding: '0 16px 14px' }}>
        <div className="surface" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p className="kicker" style={{ margin: '0 0 4px' }}>Security</p>
              <p style={{ margin: 0, fontSize: 14 }}>
                <span style={{ fontWeight: 700 }}>รหัสผ่าน</span>
              </p>
            </div>
            <button onClick={() => { setPwOpen(o => !o); setNewPass(''); setConfirmPass('') }} className="tap-down" style={{
              padding: '6px 14px', borderRadius: 'var(--r-pill)',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
              background: pwOpen ? 'var(--red-soft)' : 'var(--bg-soft)',
              color: pwOpen ? 'var(--red)' : 'var(--ink)',
              border: 'none', cursor: 'pointer',
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
        </div>
      </section>

      {/* Privacy / notifications */}
      <section style={{ padding: '0 16px 14px' }}>
        <div className="surface" style={{ overflow: 'hidden' }}>
          {[
            { Icon: Shield, label: 'ความเป็นส่วนตัว', sub: 'จัดการข้อมูลของคุณ' },
            { Icon: Bell,   label: 'การแจ้งเตือน',     sub: 'อีเมล + SMS' },
          ].map((r, i, arr) => (
            <div key={r.label} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 18px',
              borderBottom: i < arr.length - 1 ? '1px solid var(--hair)' : 'none',
              cursor: 'pointer',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 'var(--r-md)',
                background: 'var(--bg-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--ink)',
              }}>
                <r.Icon size={16} strokeWidth={1.6} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, margin: 0 }}>{r.label}</p>
                <p className="serif-i" style={{ fontSize: 11, color: 'var(--ink-mute)', margin: '2px 0 0' }}>{r.sub}</p>
              </div>
              <ChevronRight size={16} color="var(--ink-faint)" />
            </div>
          ))}
        </div>
      </section>

      {/* Logout */}
      <div style={{ padding: '4px 16px 24px' }}>
        <button onClick={() => { supabase.auth.signOut(); router.push('/login') }} style={{
          width: '100%', padding: '14px',
          background: '#fff', border: '1px solid var(--line)',
          color: 'var(--red)', borderRadius: 'var(--r-lg)',
          fontSize: 13.5, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <LogOut size={15} /> ออกจากระบบ
        </button>
      </div>

      <div style={{ textAlign: 'center', padding: '8px 0 24px' }}>
        <div style={{
          width: 30, height: 1, background: 'var(--gold)',
          margin: '0 auto 12px',
        }} />
        <p className="serif-i" style={{
          fontSize: 12, color: 'var(--ink-faint)', margin: 0,
          letterSpacing: '0.10em',
        }}>
          Maison Dreame · v2.0
        </p>
      </div>
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
