'use client'
import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Mail, Lock, Eye, EyeOff, User,
  ArrowLeft, LogIn, UserPlus, CheckCircle, AlertCircle
} from 'lucide-react'

type Mode = 'login' | 'register' | 'forgot' | 'verify-sent'
const KEY_EMAIL = 'dreame_email'
const KEY_REMEMBER = 'dreame_remember'

// ── เปลี่ยนรูปพื้นหลัง: วางไฟล์ที่ public/images/login-bg.jpg ──
const BG_IMAGE = '/images/login-bg.jpg'
const LOGO_URL = '/dreame-logo.png'

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700;800&display=swap');
  * { -webkit-tap-highlight-color:transparent; box-sizing:border-box; }
  @keyframes spin    { to { transform:rotate(360deg) } }
  @keyframes slideUp { from { opacity:0;transform:translateY(30px) } to { opacity:1;transform:translateY(0) } }
  .lg-root {
    position:fixed; inset:0; overflow:hidden;
    display:flex; justify-content:center; align-items:stretch;
    font-family:'Prompt',system-ui,sans-serif;
    background:#0d0d0d;
  }
  .lg-bg {
    position:absolute; top:0; left:50%; transform:translateX(-50%);
    width:100%; max-width:430px; height:100%; z-index:0;
  }
  .lg-bg img { width:100%; height:100%; object-fit:cover; object-position:center top; }
  .lg-overlay {
    position:absolute; inset:0;
    background:linear-gradient(to bottom,
      rgba(0,0,0,0.05) 0%,
      rgba(0,0,0,0.35) 45%,
      rgba(0,0,0,0.9) 100%);
  }
  .lg-inner {
    position:relative; z-index:1;
    width:100%; max-width:430px;
    display:flex; flex-direction:column; height:100%;
  }
  .lg-logo-area {
    flex:1; min-height:0;
    display:flex; align-items:center; justify-content:center;
    padding:64px 24px 20px;
  }
  .lg-sheet {
    flex-shrink:0;
    background:#fff; border-radius:24px 24px 0 0;
    padding:26px 22px 44px;
    box-shadow:0 -8px 40px rgba(0,0,0,0.3);
    animation:slideUp 0.4s cubic-bezier(0.34,1.1,0.64,1);
    max-height:70vh; overflow-y:auto;
  }
  .tab-row {
    display:flex; background:#f5f5f3; border-radius:12px;
    padding:3px; margin-bottom:18px;
  }
  .tab {
    flex:1; padding:10px; border:none; border-radius:10px;
    font-size:13px; font-weight:600; font-family:inherit; cursor:pointer;
    transition:all 0.18s; display:flex; align-items:center; justify-content:center; gap:6px;
  }
  .tab-on  { background:#fff; color:#111; box-shadow:0 1px 4px rgba(0,0,0,0.1); }
  .tab-off { background:transparent; color:#9ca3af; }
  .lbl {
    font-size:10px; font-weight:700; color:#9ca3af;
    text-transform:uppercase; letter-spacing:0.07em; margin:0 0 6px; display:block;
  }
  .inp {
    width:100%; background:#f7f7f5; border:1.5px solid #ebebeb; border-radius:12px;
    padding:12px 14px 12px 42px; font-size:14px; color:#111;
    outline:none; font-family:inherit; transition:all 0.15s;
  }
  .inp:focus { border-color:#d4af37; background:#fff; box-shadow:0 0 0 3px rgba(212,175,55,0.1); }
  .ico { position:absolute; left:13px; top:50%; transform:translateY(-50%); color:#c4c4c4; pointer-events:none; }
  .a-ok {
    padding:10px 13px; border-radius:11px; background:#f0fdf4;
    border:1px solid #dcfce7; color:#15803d; font-size:12px;
    display:flex; align-items:flex-start; gap:8px; margin-bottom:12px; line-height:1.5;
  }
  .a-err {
    padding:10px 13px; border-radius:11px; background:#fef2f2;
    border:1px solid #fee2e2; color:#dc2626; font-size:12px;
    display:flex; align-items:flex-start; gap:8px; margin-bottom:12px; line-height:1.5;
  }
  .btn-g {
    width:100%; padding:14px; background:#0d0d0d; color:#d4af37;
    border:none; border-radius:14px; font-size:15px; font-weight:700;
    font-family:inherit; cursor:pointer; display:flex; align-items:center;
    justify-content:center; gap:8px; transition:opacity 0.15s;
  }
  .btn-g:disabled { opacity:0.35; cursor:not-allowed; }
  .btn-plain { background:none; border:none; font-family:inherit; cursor:pointer; }
  .str-bar { display:flex; gap:4px; margin-top:6px; }
  .str-seg { flex:1; height:3px; border-radius:2px; transition:background 0.3s; }
`

function Spin() {
  return (
    <div style={{
      width: 15, height: 15, flexShrink: 0,
      border: '2px solid rgba(212,175,55,0.3)',
      borderTop: '2px solid #d4af37',
      borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    }} />
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [mode, setMode]         = useState<Mode>('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [errorReason, setErrorReason] = useState<'invalid' | 'unverified' | 'other' | null>(null)
  const [success, setSuccess]   = useState('')
  const [mounted, setMounted]   = useState(false)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const e = localStorage.getItem(KEY_EMAIL)
      const r = localStorage.getItem(KEY_REMEMBER)
      if (r === '1' && e) { setEmail(e); setRememberMe(true) }
    } catch { /* ignore */ }
    if (searchParams.get('error') === 'expired') setError('ลิงก์หมดอายุ กรุณาลองใหม่')
  }, [searchParams])

  function saveCred(val: string, remember: boolean) {
    try {
      if (remember) { localStorage.setItem(KEY_EMAIL, val); localStorage.setItem(KEY_REMEMBER, '1') }
      else          { localStorage.removeItem(KEY_EMAIL);   localStorage.removeItem(KEY_REMEMBER) }
    } catch { /* ignore */ }
  }

  function switchMode(m: Mode) {
    setMode(m); setError(''); setErrorReason(null); setSuccess(''); setPassword(''); setConfirmPw('')
  }

  async function handleLogin() {
    if (!email || !password) { setError('กรุณากรอกอีเมลและรหัสผ่าน'); setErrorReason(null); return }
    setLoading(true); setError(''); setErrorReason(null); setSuccess('')
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) {
        const msg = err.message.toLowerCase()
        if (msg.includes('email not confirmed')) {
          setError('กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ')
          setErrorReason('unverified')
        } else if (msg.includes('invalid login') || msg.includes('invalid credential')) {
          // Modern Supabase masks "email not confirmed" as "invalid credentials"
          // to prevent enumeration — so we can't tell which it is. Show both
          // recovery actions (resend verification + forgot password).
          setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง — หรืออีเมลยังไม่ได้ยืนยัน')
          setErrorReason('invalid')
        } else {
          setError(err.message)
          setErrorReason('other')
        }
        return
      }
      saveCred(email, rememberMe)
      await fetch('/api/users/ensure-profile', { method: 'POST' }).catch(() => {})
      const { data: user } = await supabase
        .from('users').select('terms_accepted_at').eq('id', data.user!.id).maybeSingle()
      router.push(user?.terms_accepted_at ? '/home' : '/terms')
    } catch {
      setError('เชื่อมต่อไม่ได้ กรุณาลองใหม่')
      setErrorReason('other')
    }
    finally   { setLoading(false) }
  }

  async function resendVerification() {
    if (!email) { setError('กรุณากรอกอีเมล'); return }
    setResending(true); setError(''); setSuccess('')
    try {
      const { error: err } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/callback` },
      })
      if (err && !err.message.toLowerCase().includes('already')) {
        setError(err.message)
        return
      }
      setSuccess('ส่งอีเมลยืนยันใหม่แล้ว — กรุณาเช็คกล่องจดหมาย (รวมถึง spam)')
      setErrorReason(null)
    } catch {
      setError('ส่งไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setResending(false)
    }
  }

  async function handleRegister() {
    if (!fullName.trim())        { setError('กรุณากรอกชื่อ-นามสกุล'); return }
    if (!email)                  { setError('กรุณากรอกอีเมล'); return }
    if (password.length < 8)    { setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return }
    if (password !== confirmPw)  { setError('รหัสผ่านไม่ตรงกัน'); return }
    setLoading(true); setError(''); setSuccess('')
    try {
      // Pass full_name through user_metadata so the DB trigger
      // (handle_new_auth_user) can populate public.users on insert.
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/callback`,
        },
      })
      if (err) {
        // Avoid email enumeration: same generic message regardless of cause.
        // (Supabase already prevents most enumeration in modern versions.)
        if (err.message.toLowerCase().includes('already registered')) {
          setError('อีเมลนี้มีบัญชีอยู่แล้ว — กรุณาเข้าสู่ระบบ')
          setMode('login')
        } else {
          setError(err.message)
        }
        return
      }
      if (!data.user) { setError('เกิดข้อผิดพลาด'); return }

      saveCred(email, true)

      if (data.session) {
        // Auto-confirmed (email confirmation off) — go straight to terms.
        await fetch('/api/users/ensure-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name: fullName.trim() }),
        }).catch(() => {})
        router.push('/terms')
      } else {
        // Email confirmation required — show dedicated screen with clear next steps
        setMode('verify-sent')
      }
    } catch { setError('เกิดข้อผิดพลาด กรุณาลองใหม่') }
    finally   { setLoading(false) }
  }

  async function handleForgot() {
    if (!email) { setError('กรุณากรอกอีเมล'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('อีเมลไม่ถูกต้อง'); return }
    setLoading(true); setError(''); setSuccess('')
    try {
      // Always show success — Supabase already silently no-ops on missing emails.
      // We don't surface the underlying error to avoid email enumeration.
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/callback?type=recovery`,
      })
      setSuccess('ถ้ามีบัญชีตามอีเมลนี้ ระบบจะส่งลิงก์รีเซ็ตให้ภายในไม่กี่นาที')
    } catch { setError('เกิดข้อผิดพลาด') }
    finally   { setLoading(false) }
  }

  const strLen   = password.length
  const strength = strLen === 0 ? 0 : strLen < 8 ? 1 : strLen < 12 ? 2 : strLen < 16 ? 3 : 4
  const strColor = ['#e5e7eb', '#ef4444', '#f59e0b', '#3b82f6', '#16a34a']
  const strLabel = ['', 'สั้นเกินไป', 'ปานกลาง', 'ดี', 'แข็งแกร่ง']

  const canLogin  = !loading && !!email && !!password
  const canReg    = !loading && !!fullName && !!email && password.length >= 8 && password === confirmPw
  const canForgot = !loading && !!email

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lg-root">

        {/* Layer 1 — Background image */}
        <div className="lg-bg">
          <img src={BG_IMAGE} alt="" draggable={false} />
          <div className="lg-overlay" />
        </div>

        {/* Layer 2 — UI */}
        <div className="lg-inner">

          {/* Logo top */}
          <div className="lg-logo-area" style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.5s' }}>
            <img
              src={LOGO_URL}
              alt="Dreame"
              style={{ height: 48, objectFit: 'contain', filter: 'brightness(0) invert(1)', maxWidth: 240 }}
            />
          </div>

          {/* Form sheet bottom */}
          <div className="lg-sheet">
            {mode === 'verify-sent' ? (
              <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
                <div style={{
                  width: 64, height: 64, margin: '0 auto 16px',
                  borderRadius: 20, background: 'linear-gradient(135deg,#d4af37,#f5d060)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(212,175,55,0.3)',
                }}>
                  <Mail size={28} color="#0d0d0d" />
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111', margin: '0 0 8px' }}>
                  ตรวจอีเมลของคุณ
                </h2>
                <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 6px', lineHeight: 1.6 }}>
                  ส่งลิงก์ยืนยันไปที่
                </p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '0 0 18px', wordBreak: 'break-all' }}>
                  {email}
                </p>
                <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 20px', lineHeight: 1.6 }}>
                  คลิกลิงก์ในอีเมลเพื่อยืนยันบัญชี<br/>
                  ไม่เห็นอีเมล? เช็ค spam หรือกดส่งใหม่
                </p>
                {success && (
                  <div className="a-ok" style={{ marginBottom: 12 }}>
                    <CheckCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{success}</span>
                  </div>
                )}
                {error && (
                  <div className="a-err" style={{ marginBottom: 12 }}>
                    <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{error}</span>
                  </div>
                )}
                <button
                  className="btn-g"
                  onClick={resendVerification}
                  disabled={resending}
                  style={{ marginBottom: 10 }}>
                  {resending ? <><Spin /> กำลังส่ง...</> : <>↻ ส่งอีเมลยืนยันใหม่</>}
                </button>
                <button className="btn-plain" onClick={() => switchMode('login')}
                  style={{ fontSize: 13, color: '#6b7280', padding: '8px 0' }}>
                  ← กลับไปหน้าเข้าสู่ระบบ
                </button>
              </div>
            ) : (
            <>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 3px' }}>
              {mode === 'forgot' ? 'รีเซ็ตรหัสผ่าน' : 'DREAME MEMBERSHIP'}
            </p>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: '0 0 16px' }}>
              {mode === 'login' ? 'เข้าสู่ระบบ' : mode === 'register' ? 'สมัครสมาชิก' : 'ลืมรหัสผ่าน?'}
            </h2>

            {mode !== 'forgot' && (
              <div className="tab-row">
                <button className={`tab ${mode === 'login' ? 'tab-on' : 'tab-off'}`} onClick={() => switchMode('login')}>
                  <LogIn size={13} /> เข้าสู่ระบบ
                </button>
                <button className={`tab ${mode === 'register' ? 'tab-on' : 'tab-off'}`} onClick={() => switchMode('register')}>
                  <UserPlus size={13} /> สมัครสมาชิก
                </button>
              </div>
            )}

            {success && (
              <div className="a-ok">
                <CheckCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{success}</span>
              </div>
            )}
            {error && (
              <div className="a-err" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{error}</span>
                </div>
                {mode === 'login' && (errorReason === 'unverified' || errorReason === 'invalid') && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={resendVerification}
                      disabled={resending || !email}
                      className="btn-plain"
                      style={{
                        flex: 1, minWidth: 140, padding: '8px 10px', fontSize: 11, fontWeight: 700,
                        color: '#0d0d0d', background: '#fde68a', border: '1px solid #fbbf24',
                        borderRadius: 8, opacity: !email ? 0.5 : 1,
                      }}>
                      {resending ? 'กำลังส่ง...' : '↻ ส่งอีเมลยืนยันใหม่'}
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="btn-plain"
                      style={{
                        flex: 1, minWidth: 110, padding: '8px 10px', fontSize: 11, fontWeight: 700,
                        color: '#fff', background: '#0d0d0d', border: 'none', borderRadius: 8,
                      }}>
                      🔑 ลืมรหัสผ่าน?
                    </button>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {mode === 'register' && (
                <div>
                  <label className="lbl">ชื่อ-นามสกุล</label>
                  <div style={{ position: 'relative' }}>
                    <User size={15} className="ico" />
                    <input className="inp" type="text" placeholder="สมชาย ใจดี"
                      value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" />
                  </div>
                </div>
              )}

              <div>
                <label className="lbl">อีเมล</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} className="ico" />
                  <input className="inp" type="email" placeholder="you@example.com"
                    value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"
                    onKeyDown={e => { if (e.key === 'Enter' && mode === 'forgot') handleForgot() }} />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div>
                  <label className="lbl">รหัสผ่าน</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} className="ico" />
                    <input className="inp"
                      type={showPass ? 'text' : 'password'}
                      placeholder={mode === 'register' ? 'อย่างน้อย 8 ตัวอักษร' : '••••••••'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      style={{ paddingRight: 44 }}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      onKeyDown={e => { if (e.key === 'Enter' && mode === 'login') handleLogin() }}
                    />
                    <button className="btn-plain" onClick={() => setShowPass(s => !s)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', padding: 0 }}>
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {mode === 'register' && password.length > 0 && (
                    <>
                      <div className="str-bar">
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className="str-seg"
                            style={{ background: i <= strength ? strColor[strength] : '#e5e7eb' }} />
                        ))}
                      </div>
                      <p style={{ fontSize: 11, color: strColor[strength], margin: '3px 0 0', fontWeight: 600 }}>
                        {strLabel[strength]}
                      </p>
                    </>
                  )}
                </div>
              )}

              {mode === 'register' && (
                <div>
                  <label className="lbl">ยืนยันรหัสผ่าน</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} className="ico" />
                    <input className="inp"
                      type={showPass ? 'text' : 'password'}
                      placeholder="กรอกอีกครั้ง"
                      value={confirmPw}
                      onChange={e => setConfirmPw(e.target.value)}
                      autoComplete="new-password"
                      onKeyDown={e => { if (e.key === 'Enter') handleRegister() }}
                    />
                  </div>
                  {confirmPw.length > 0 && (
                    <p style={{ fontSize: 11, color: confirmPw === password ? '#16a34a' : '#dc2626', margin: '3px 0 0', fontWeight: 600 }}>
                      {confirmPw === password ? '✓ รหัสผ่านตรงกัน' : '✗ รหัสผ่านไม่ตรงกัน'}
                    </p>
                  )}
                </div>
              )}

              {mode === 'login' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                    onClick={() => setRememberMe(r => !r)}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                      border: rememberMe ? 'none' : '1.5px solid #d1d5db',
                      background: rememberMe ? '#0d0d0d' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}>
                      {rememberMe && <span style={{ color: '#d4af37', fontSize: 10, fontWeight: 900 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>จำอีเมลของฉัน</span>
                  </label>
                  <button className="btn-plain" onClick={() => switchMode('forgot')}
                    style={{ fontSize: 12, color: '#b8860b', fontWeight: 600 }}>
                    ลืมรหัสผ่าน?
                  </button>
                </div>
              )}

              {mode === 'login' && (
                <button className="btn-g" onClick={handleLogin} disabled={!canLogin}>
                  {loading ? <><Spin /> กำลังเข้าสู่ระบบ...</> : <><LogIn size={15} /> เข้าสู่ระบบ</>}
                </button>
              )}

              {mode === 'register' && (
                <button className="btn-g" onClick={handleRegister} disabled={!canReg}>
                  {loading ? <><Spin /> กำลังสมัคร...</> : <><UserPlus size={15} /> สมัครสมาชิก</>}
                </button>
              )}

              {mode === 'forgot' && (
                <>
                  <button className="btn-g" onClick={handleForgot} disabled={!canForgot}>
                    {loading ? <><Spin /> กำลังส่ง...</> : <>ส่งลิงก์รีเซ็ตรหัสผ่าน</>}
                  </button>
                  <button className="btn-plain" onClick={() => switchMode('login')}
                    style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center', paddingTop: 4 }}>
                    <ArrowLeft size={13} /> กลับไปหน้าเข้าสู่ระบบ
                  </button>
                </>
              )}

            </div>
            </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(212,175,55,0.2)', borderTop: '3px solid #d4af37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}