'use client'
import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

type Mode = 'login' | 'register' | 'forgot'
const KEY_EMAIL = 'dreame_email'
const KEY_REMEMBER = 'dreame_remember'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem(KEY_EMAIL)
      const savedRemember = localStorage.getItem(KEY_REMEMBER)
      if (savedRemember === '1' && savedEmail) {
        setEmail(savedEmail)
        setRememberMe(true)
      }
    } catch { /* ignore */ }

    const errorParam = searchParams.get('error')
    if (errorParam === 'expired') setError('ลิงก์หมดอายุ กรุณาลองใหม่อีกครั้ง')
  }, [searchParams])

  function saveCredential(val: string, remember: boolean) {
    try {
      if (remember) {
        localStorage.setItem(KEY_EMAIL, val)
        localStorage.setItem(KEY_REMEMBER, '1')
      } else {
        localStorage.removeItem(KEY_EMAIL)
        localStorage.removeItem(KEY_REMEMBER)
      }
    } catch { /* ignore */ }
  }

  // ─── LOGIN ────────────────────────────────────────────────
  async function handleLogin() {
    if (!email || !password) { setError('กรุณากรอกอีเมลและรหัสผ่าน'); return }
    setLoading(true); setError(''); setSuccess('')
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) {
        if (err.message.includes('Invalid login') || err.message.includes('invalid')) {
          setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
        } else if (err.message.includes('Email not confirmed')) {
          setError('กรุณายืนยันอีเมลก่อน login หรือติดต่อแอดมิน')
        } else {
          setError(err.message)
        }
        return
      }
      saveCredential(email, rememberMe)
      // ตรวจสอบ profile และ terms
      const { data: user } = await supabase
        .from('users').select('terms_accepted_at').eq('id', data.user!.id).single()
      if (!user?.terms_accepted_at) router.push('/terms')
      else router.push('/home')
    } catch { setError('เกิดข้อผิดพลาด กรุณาลองใหม่') }
    finally { setLoading(false) }
  }

  // ─── REGISTER ─────────────────────────────────────────────
  async function handleRegister() {
    if (!fullName.trim()) { setError('กรุณากรอกชื่อ-นามสกุล'); return }
    if (!email) { setError('กรุณากรอกอีเมล'); return }
    if (password.length < 8) { setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return }
    if (password !== confirmPassword) { setError('รหัสผ่านไม่ตรงกัน'); return }
    setLoading(true); setError(''); setSuccess('')
    try {
      const { data, error: err } = await supabase.auth.signUp({ email, password })
      if (err) {
        if (err.message.includes('already registered') || err.message.includes('User already')) {
          setError('อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ')
          setMode('login')
        } else {
          setError(err.message)
        }
        return
      }
      if (!data.user) { setError('เกิดข้อผิดพลาด กรุณาลองใหม่'); return }

      // บันทึกชื่อลง users table
      await supabase.from('users').upsert({
        id: data.user.id,
        full_name: fullName.trim(),
        email: email,
      })
      saveCredential(email, true)

      if (data.session) {
        // ปิด confirm email → เข้าได้เลย
        router.push('/terms')
      } else {
        // ยังเปิด confirm email อยู่
        setSuccess('📧 กรุณาเช็คอีเมลและกดยืนยันก่อน login ครับ')
        setMode('login')
      }
    } catch { setError('เกิดข้อผิดพลาด กรุณาลองใหม่') }
    finally { setLoading(false) }
  }

  // ─── FORGOT PASSWORD ──────────────────────────────────────
  async function handleForgot() {
    if (!email) { setError('กรุณากรอกอีเมล'); return }
    setLoading(true); setError(''); setSuccess('')
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (err) { setError(err.message); return }
      setSuccess('📧 ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว! เช็คอีเมลของคุณได้เลย')
    } catch { setError('เกิดข้อผิดพลาด กรุณาลองใหม่') }
    finally { setLoading(false) }
  }

  function switchMode(m: Mode) {
    setMode(m); setError(''); setSuccess('')
    setPassword(''); setConfirmPassword('')
  }

  const inp = {
    width: '100%', background: 'rgba(31,41,55,1)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
    padding: '12px 14px', color: '#fff', fontSize: 14,
    outline: 'none', boxSizing: 'border-box' as const,
  }
  const isLoginReady = !loading && !!email && !!password
  const isRegReady = !loading && !!fullName && !!email && password.length >= 8 && password === confirmPassword
  const isForgotReady = !loading && !!email

  function PrimaryBtn({ onClick, disabled, children }: { onClick: () => void, disabled: boolean, children: React.ReactNode }) {
    return (
      <button onClick={onClick} disabled={disabled} style={{
        width: '100%', border: 'none', borderRadius: 12, padding: '14px 0',
        fontSize: 15, fontWeight: 700, transition: 'all 0.2s', cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled ? 'rgba(255,255,255,0.07)' : 'linear-gradient(135deg,#f59e0b,#d97706)',
        color: disabled ? '#6b7280' : '#000',
        boxShadow: disabled ? 'none' : '0 4px 16px rgba(245,158,11,0.35)',
      }}>{children}</button>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#030712 0%,#111827 50%,#030712 100%)', padding: 16 }}>
      <div style={{ position: 'fixed', top: '25%', left: '50%', transform: 'translateX(-50%)', width: 400, height: 400, background: 'radial-gradient(circle,rgba(245,158,11,0.06) 0%,transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 58, height: 58, borderRadius: 18, background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow: '0 8px 24px rgba(245,158,11,0.4)', marginBottom: 12 }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: '#000' }}>D</span>
          </div>
          <h1 style={{ fontSize: 21, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>Dreame Membership</h1>
          <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
            {mode === 'login' ? 'เข้าสู่ระบบสมาชิก' : mode === 'register' ? 'สมัครสมาชิกใหม่' : 'รีเซ็ตรหัสผ่าน'}
          </p>
        </div>

        {/* Tabs */}
        {mode !== 'forgot' && (
          <div style={{ display: 'flex', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 12 }}>
            {(['login', 'register'] as Mode[]).map(m => (
              <button key={m} onClick={() => switchMode(m)} style={{
                flex: 1, padding: '11px 0', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                background: mode === m ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'rgba(17,24,39,1)',
                color: mode === m ? '#000' : '#6b7280',
              }}>
                {m === 'login' ? '🔑 เข้าสู่ระบบ' : '✨ สมัครสมาชิก'}
              </button>
            ))}
          </div>
        )}

        {/* Card */}
        <div style={{ background: 'rgba(17,24,39,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 24 }}>

          {success && (
            <div style={{ background: 'rgba(20,83,45,0.4)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: '12px 14px', color: '#4ade80', fontSize: 13, marginBottom: 14, lineHeight: 1.6 }}>
              {success}
            </div>
          )}
          {error && (
            <div style={{ background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 14 }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>

            {/* ชื่อ */}
            {mode === 'register' && (
              <div>
                <label style={{ display: 'block', color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>ชื่อ-นามสกุล</label>
                <input type="text" placeholder="สมชาย ใจดี" value={fullName}
                  onChange={e => setFullName(e.target.value)} autoComplete="name"
                  style={inp}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#f59e0b'}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label style={{ display: 'block', color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>อีเมล</label>
              <input type="email" placeholder="you@example.com" value={email}
                onChange={e => setEmail(e.target.value)} autoComplete="email"
                style={inp}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#f59e0b'}
                onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.1)'}
                onKeyDown={e => { if (e.key === 'Enter' && mode === 'forgot') handleForgot() }}
              />
            </div>

            {/* Password */}
            {mode !== 'forgot' && (
              <div>
                <label style={{ display: 'block', color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>
                  รหัสผ่าน {mode === 'register' && <span style={{ color: '#6b7280' }}>(อย่างน้อย 8 ตัวอักษร)</span>}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder={mode === 'register' ? 'ตั้งรหัสผ่านของคุณ' : '••••••••'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    style={{ ...inp, paddingRight: 44 }}
                    onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#f59e0b'}
                    onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.1)'}
                    onKeyDown={e => { if (e.key === 'Enter' && mode === 'login') handleLogin() }}
                  />
                  <button onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 15, padding: 0 }}>
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>

                {/* Password strength (register only) */}
                {mode === 'register' && password && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                      {[1,2,3,4].map(i => (
                        <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: password.length >= i * 2 + 2 ? (password.length >= 12 ? '#4ade80' : password.length >= 8 ? '#f59e0b' : '#ef4444') : 'rgba(255,255,255,0.1)' }} />
                      ))}
                    </div>
                    <p style={{ color: password.length >= 12 ? '#4ade80' : password.length >= 8 ? '#f59e0b' : '#ef4444', fontSize: 11, margin: 0 }}>
                      {password.length >= 12 ? '✓ รหัสผ่านแข็งแกร่ง' : password.length >= 8 ? '~ รหัสผ่านปานกลาง' : '✗ รหัสผ่านสั้นเกินไป'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Confirm Password */}
            {mode === 'register' && (
              <div>
                <label style={{ display: 'block', color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>ยืนยันรหัสผ่าน</label>
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  style={{ ...inp, borderColor: confirmPassword && confirmPassword !== password ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)' }}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#f59e0b'}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = confirmPassword && confirmPassword !== password ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'}
                  onKeyDown={e => { if (e.key === 'Enter') handleRegister() }}
                />
                {confirmPassword && (
                  <p style={{ color: confirmPassword === password ? '#4ade80' : '#f87171', fontSize: 11, marginTop: 4 }}>
                    {confirmPassword === password ? '✓ รหัสผ่านตรงกัน' : '✗ รหัสผ่านไม่ตรงกัน'}
                  </p>
                )}
              </div>
            )}

            {/* Remember me + Forgot (login only) */}
            {mode === 'login' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: -4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <div
                    onClick={() => setRememberMe(!rememberMe)}
                    style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${rememberMe ? '#f59e0b' : 'rgba(255,255,255,0.2)'}`, background: rememberMe ? '#f59e0b' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}>
                    {rememberMe && <span style={{ color: '#000', fontSize: 11, fontWeight: 900 }}>✓</span>}
                  </div>
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>จำอีเมลของฉัน</span>
                </label>
                <button onClick={() => switchMode('forgot')} style={{ color: '#f59e0b', background: 'none', border: 'none', fontSize: 12, cursor: 'pointer' }}>
                  ลืมรหัสผ่าน?
                </button>
              </div>
            )}

            {/* Submit */}
            {mode === 'login' && <PrimaryBtn onClick={handleLogin} disabled={!isLoginReady}>{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</PrimaryBtn>}
            {mode === 'register' && <PrimaryBtn onClick={handleRegister} disabled={!isRegReady}>{loading ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}</PrimaryBtn>}
            {mode === 'forgot' && (
              <>
                <PrimaryBtn onClick={handleForgot} disabled={!isForgotReady}>{loading ? 'กำลังส่ง...' : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}</PrimaryBtn>
                <button onClick={() => switchMode('login')} style={{ color: '#9ca3af', background: 'none', border: 'none', fontSize: 13, cursor: 'pointer', textAlign: 'center' }}>
                  ← กลับไปหน้าเข้าสู่ระบบ
                </button>
              </>
            )}
          </div>
        </div>

        <p style={{ textAlign: 'center', color: '#374151', fontSize: 11, marginTop: 18 }}>© 2025 Dreame Thailand · Membership System</p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#030712' }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(245,158,11,0.15)', borderTop: '3px solid #f59e0b', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}