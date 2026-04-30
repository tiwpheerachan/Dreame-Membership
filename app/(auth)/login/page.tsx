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
// Track which email a user *just* signed up with so we can show a
// "verify your email first" banner instead of a generic login error
// when they navigate back to the login screen.
const KEY_PENDING_VERIFY = 'dreame_pending_verify'

// ── เปลี่ยนรูปพื้นหลัง: วางไฟล์ที่ public/images/login-bg.png ──
const BG_IMAGE = '/images/login-bg.png'

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700;800&display=swap');
  * { -webkit-tap-highlight-color:transparent; box-sizing:border-box; }
  @keyframes spin    { to { transform:rotate(360deg) } }
  @keyframes slideUp { from { opacity:0;transform:translateY(30px) } to { opacity:1;transform:translateY(0) } }
  .lg-root {
    position:fixed; inset:0; overflow:hidden;
    display:flex; justify-content:center; align-items:stretch;
    font-family:'Prompt',system-ui,sans-serif;
    /* Cream backdrop matches the new key visual (light beige), so the
       sides outside the 430px frame don't look like a black void. */
    background:#ECE0CC;
  }
  .lg-bg {
    position:absolute; top:0; left:50%; transform:translateX(-50%);
    width:100%; max-width:430px; height:100%; z-index:0;
  }
  /* contain (not cover) so the full key visual fits without being cropped at
     the sides — the wordmark "DREAME MEMBERSHIP" stays intact. The cream
     backdrop (.lg-root) fills any leftover space below the image so the
     transition into the form sheet still looks seamless. */
  .lg-bg img { width:100%; height:100%; object-fit:contain; object-position:center top; }
  .lg-overlay {
    /* Soft white-ish fade at the bottom only, so the cream image blends
       into the white form sheet without a hard line. No dark tint. */
    position:absolute; inset:0;
    background:linear-gradient(to bottom,
      rgba(255,255,255,0) 0%,
      rgba(255,255,255,0) 55%,
      rgba(255,255,255,0.20) 80%,
      rgba(255,255,255,0.55) 100%);
  }
  .lg-inner {
    position:relative; z-index:1;
    width:100%; max-width:430px;
    display:flex; flex-direction:column; height:100%;
  }
  .lg-logo-area {
    flex:1; min-height:0;
    display:flex; align-items:flex-start; justify-content:center;
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
  // Email of a recently-registered account that still needs verification.
  // Lets us swap the generic login error for an actionable "check your email" banner.
  const [pendingVerify, setPendingVerify] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    try {
      const e = localStorage.getItem(KEY_EMAIL)
      const r = localStorage.getItem(KEY_REMEMBER)
      if (r === '1' && e) { setEmail(e); setRememberMe(true) }
      const pv = localStorage.getItem(KEY_PENDING_VERIFY)
      if (pv) {
        setPendingVerify(pv)
        // Pre-fill that email if nothing else was remembered
        if (!localStorage.getItem(KEY_EMAIL)) setEmail(pv)
      }
    } catch { /* ignore */ }
    if (searchParams.get('error') === 'expired') setError('ลิงก์หมดอายุ กรุณาลองใหม่')
  }, [searchParams])

  // Clear pending-verify banner if user changes email to something different
  const showPendingBanner = mode === 'login' && pendingVerify && email.trim().toLowerCase() === pendingVerify.toLowerCase()

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
      // Successful login implies the email is confirmed — drop the pending banner.
      try { localStorage.removeItem(KEY_PENDING_VERIFY) } catch { /* ignore */ }
      setPendingVerify(null)
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
      // Send via our own Resend-backed endpoint instead of supabase.auth.resend
      // (which silently rate-limits on the free tier and lands in spam).
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'ส่งไม่สำเร็จ — โปรดลองใหม่')
        return
      }
      setSuccess('ส่งอีเมลยืนยันใหม่แล้ว — กรุณาเช็คกล่องจดหมาย รวมถึงโฟลเดอร์ Spam/Junk/โปรโมชั่น')
      setErrorReason(null)
    } catch (e) {
      console.error('[resend]', e)
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
      // Custom signup endpoint creates the user via admin API with
      // email_confirm:false and sends the verification email via Resend
      // — no Supabase auto-mailer involved, no duplicate emails.
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName.trim() }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (data.code === 'already_registered') {
          setError(data.error || 'อีเมลนี้มีบัญชีอยู่แล้ว — กรุณาเข้าสู่ระบบ')
          setMode('login')
        } else {
          setError(data.error || 'สมัครไม่สำเร็จ')
        }
        return
      }

      saveCred(email, true)
      try { localStorage.setItem(KEY_PENDING_VERIFY, email) } catch { /* ignore */ }
      setPendingVerify(email)
      setMode('verify-sent')

      if (!data.email_sent) {
        // Account was created but the verification email failed to send.
        // Surface that hint inline so the user knows to tap "Resend".
        setError(data.error || 'สร้างบัญชีสำเร็จ แต่ส่งอีเมลยืนยันไม่สำเร็จ')
      }
    } catch (e) {
      console.error('[register]', e)
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    }
    finally   { setLoading(false) }
  }

  async function handleForgot() {
    if (!email) { setError('กรุณากรอกอีเมล'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('อีเมลไม่ถูกต้อง'); return }
    setLoading(true); setError(''); setSuccess('')
    try {
      // Goes through our Resend-backed endpoint, not supabase.auth.resetPasswordForEmail.
      const res = await fetch('/api/auth/send-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาด — โปรดลองใหม่')
        return
      }
      // Generic message regardless of whether the email exists (avoids enumeration).
      setSuccess('ถ้ามีบัญชีตามอีเมลนี้ ระบบจะส่งลิงก์รีเซ็ตให้ภายในไม่กี่นาที — หากไม่ได้รับโปรดเช็คโฟลเดอร์ Spam')
    } catch (e) {
      console.error('[forgot]', e)
      setError('เกิดข้อผิดพลาด')
    }
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

          {/* Spacer that lets the brand visual breathe above the form sheet.
              The image already carries the DREAME MEMBERSHIP wordmark, so
              we no longer overlay a separate logo here. */}
          <div className="lg-logo-area" style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.5s' }} />

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
                <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 14px', lineHeight: 1.65 }}>
                  คลิกลิงก์ในอีเมลเพื่อยืนยันบัญชี<br/>
                  อีเมลอาจใช้เวลา 2-5 นาทีในการมาถึง
                </p>
                <div style={{
                  padding: '10px 14px', borderRadius: 12,
                  background: '#fffaf0', border: '1px solid #fde68a',
                  margin: '0 0 18px', textAlign: 'left',
                }}>
                  <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: '#7c5410' }}>
                    💡 ไม่เห็นอีเมล?
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#8c5e16', lineHeight: 1.6 }}>
                    1. เช็คโฟลเดอร์ <strong>Spam / Junk / โปรโมชั่น</strong><br/>
                    2. ตรวจว่าพิมพ์อีเมลถูกต้อง<br/>
                    3. กด &ldquo;ส่งอีเมลยืนยันใหม่&rdquo; ด้านล่าง
                  </p>
                </div>
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

            {/* Pending-verify banner — shown when user just registered and
                navigated back to login. Replaces the generic invalid-cred
                error with an actionable resend-verification CTA. */}
            {showPendingBanner && !error && !success && (
              <div style={{
                padding: '12px 14px', borderRadius: 12,
                background: '#fffaf0', border: '1px solid #fde68a',
                marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Mail size={15} color="#b8860b" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: '#7c5410' }}>
                      ยืนยันอีเมลก่อนเข้าสู่ระบบ
                    </p>
                    <p style={{ margin: '3px 0 0', fontSize: 11.5, color: '#8c5e16', lineHeight: 1.55 }}>
                      เราส่งลิงก์ยืนยันไปที่ <strong>{pendingVerify}</strong> แล้ว — คลิกลิงก์เพื่อใช้งานบัญชี<br/>
                      ไม่ได้รับอีเมล? เช็ค <strong>โฟลเดอร์ Spam/Junk</strong> หรือกดส่งใหม่
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resendVerification}
                  disabled={resending}
                  className="btn-plain"
                  style={{
                    padding: '8px 12px', fontSize: 11.5, fontWeight: 700,
                    color: '#0d0d0d', background: '#fde68a', border: '1px solid #fbbf24',
                    borderRadius: 8,
                  }}>
                  {resending ? 'กำลังส่ง...' : '↻ ส่งอีเมลยืนยันใหม่'}
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