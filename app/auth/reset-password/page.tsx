'use client'
import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'

const BG_IMAGE = '/images/login-bg.jpg'
const LOGO_URL = '/dreame-logo.png'

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700;800&display=swap');
  *, *::before, *::after { -webkit-tap-highlight-color:transparent; box-sizing:border-box; margin:0; padding:0; }
  @keyframes spin    { to { transform:rotate(360deg) } }
  @keyframes slideUp { from { opacity:0;transform:translateY(30px) } to { opacity:1;transform:translateY(0) } }
  @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
  .rp-root {
    position:fixed; inset:0; overflow:hidden;
    display:flex; justify-content:center; align-items:stretch;
    font-family:'Prompt',system-ui,sans-serif; background:#0d0d0d;
  }
  .rp-bg {
    position:absolute; top:0; left:50%; transform:translateX(-50%);
    width:100%; max-width:430px; height:100%; z-index:0;
  }
  .rp-bg img { width:100%; height:100%; object-fit:cover; object-position:center top; }
  .rp-overlay {
    position:absolute; inset:0;
    background:linear-gradient(to bottom,rgba(0,0,0,0.05) 0%,rgba(0,0,0,0.35) 45%,rgba(0,0,0,0.9) 100%);
  }
  .rp-inner { position:relative; z-index:1; width:100%; max-width:430px; display:flex; flex-direction:column; height:100%; }
  .rp-logo-area { flex:1; min-height:0; display:flex; align-items:center; justify-content:center; padding:64px 24px 20px; }
  .rp-sheet {
    flex-shrink:0; background:#fff; border-radius:24px 24px 0 0;
    padding:26px 22px max(env(safe-area-inset-bottom,32px),32px);
    box-shadow:0 -8px 40px rgba(0,0,0,0.3);
    animation:slideUp 0.4s cubic-bezier(0.34,1.1,0.64,1);
  }
  .rp-title { font-size:20px; font-weight:800; color:#111; margin:0 0 4px; }
  .rp-sub   { font-size:12px; color:#9ca3af; margin:0 0 20px; }
  .lbl { font-size:10px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:0.07em; margin:0 0 6px; display:block; }
  .inp {
    width:100%; background:#f7f7f5; border:1.5px solid #ebebeb; border-radius:12px;
    padding:12px 14px 12px 42px; font-size:14px; color:#111;
    outline:none; font-family:inherit; transition:all 0.15s;
  }
  .inp:focus { border-color:#d4af37; background:#fff; box-shadow:0 0 0 3px rgba(212,175,55,0.1); }
  .ico   { position:absolute; left:13px; top:50%; transform:translateY(-50%); color:#c4c4c4; pointer-events:none; }
  .ico-r { position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; color:#9ca3af; cursor:pointer; padding:2px; }
  .a-err { padding:10px 13px; border-radius:11px; background:#fef2f2; border:1px solid #fecaca; color:#dc2626; font-size:12px; display:flex; align-items:flex-start; gap:8px; margin-bottom:12px; line-height:1.5; }
  .a-ok  { padding:10px 13px; border-radius:11px; background:#f0fdf4; border:1px solid #dcfce7; color:#15803d; font-size:12px; display:flex; align-items:flex-start; gap:8px; margin-bottom:12px; line-height:1.5; }
  .str-bar { display:flex; gap:3px; margin:6px 0 2px; }
  .str-seg { flex:1; height:3px; border-radius:3px; transition:background 0.2s; }
  .btn-main {
    width:100%; padding:15px; background:#0d0d0d; color:#d4af37;
    border:none; border-radius:14px; font-size:15px; font-weight:700; font-family:inherit;
    cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;
    transition:opacity 0.15s; margin-top:16px;
  }
  .btn-main:disabled { opacity:0.35; cursor:not-allowed; }
`

function ResetPasswordForm() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword]   = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState(false)
  const [ready, setReady]         = useState(false)
  const [mounted, setMounted]     = useState(false)

  useEffect(() => {
    setMounted(true)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/login?error=expired')
      else setReady(true)
    })
  }, [])

  async function handleReset() {
    if (!password || !confirmPw) { setError('กรุณากรอกรหัสผ่านให้ครบ'); return }
    if (password.length < 8)     { setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return }
    if (password !== confirmPw)  { setError('รหัสผ่านไม่ตรงกัน'); return }
    setLoading(true); setError('')
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) { setError(err.message); return }
      setSuccess(true)
      setTimeout(() => router.push('/home'), 2000)
    } catch { setError('เกิดข้อผิดพลาด กรุณาลองใหม่') }
    finally { setLoading(false) }
  }

  const strLen   = password.length
  const strength = strLen === 0 ? 0 : strLen < 8 ? 1 : strLen < 12 ? 2 : strLen < 16 ? 3 : 4
  const strColor = ['#e5e7eb','#ef4444','#f59e0b','#3b82f6','#16a34a']
  const strLabel = ['','สั้นเกินไป','ปานกลาง','ดี','แข็งแกร่ง']

  const Spinner = () => (
    <div style={{ minHeight:'100vh', background:'#0d0d0d', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:32, height:32, border:'3px solid rgba(212,175,55,0.2)', borderTop:'3px solid #d4af37', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
    </div>
  )

  if (!ready) return <Spinner />

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="rp-root">
        <div className="rp-bg">
          <img src={BG_IMAGE} alt="" draggable={false} />
          <div className="rp-overlay" />
        </div>
        <div className="rp-inner">
          <div className="rp-logo-area" style={{ opacity: mounted ? 1 : 0, transition:'opacity 0.6s' }}>
            <img src={LOGO_URL} alt="Dreame" style={{ height:36, objectFit:'contain', filter:'brightness(0) invert(1)', maxWidth:200 }} draggable={false} />
          </div>
          <div className="rp-sheet">
            <h1 className="rp-title">ตั้งรหัสผ่านใหม่</h1>
            <p className="rp-sub">กรอกรหัสผ่านใหม่ของคุณด้านล่าง</p>

            {success && (
              <div className="a-ok">
                <CheckCircle size={15} style={{ marginTop:1, flexShrink:0 }} />
                <span>เปลี่ยนรหัสผ่านสำเร็จ! กำลังพาไปหน้าหลัก...</span>
              </div>
            )}
            {error && (
              <div className="a-err">
                <AlertCircle size={15} style={{ marginTop:1, flexShrink:0 }} />
                <span>{error}</span>
              </div>
            )}

            {!success && (
              <>
                <div style={{ marginBottom:14 }}>
                  <label className="lbl">รหัสผ่านใหม่</label>
                  <div style={{ position:'relative' }}>
                    <Lock size={15} className="ico" />
                    <input className="inp" style={{ paddingRight:44 }}
                      type={showPass ? 'text' : 'password'}
                      placeholder="อย่างน้อย 8 ตัวอักษร"
                      value={password} onChange={e => setPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button className="ico-r" type="button" onClick={() => setShowPass(s => !s)}>
                      {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <>
                      <div className="str-bar">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="str-seg" style={{ background: i <= strength ? strColor[strength] : '#e5e7eb' }} />
                        ))}
                      </div>
                      <p style={{ fontSize:10, color:strColor[strength], fontWeight:600 }}>{strLabel[strength]}</p>
                    </>
                  )}
                </div>

                <div style={{ marginBottom:4 }}>
                  <label className="lbl">ยืนยันรหัสผ่านใหม่</label>
                  <div style={{ position:'relative' }}>
                    <Lock size={15} className="ico" />
                    <input className="inp"
                      type={showPass ? 'text' : 'password'}
                      placeholder="กรอกรหัสผ่านอีกครั้ง"
                      value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                      autoComplete="new-password"
                      onKeyDown={e => { if (e.key === 'Enter') handleReset() }}
                      style={{ borderColor: confirmPw && confirmPw !== password ? '#fca5a5' : undefined }}
                    />
                  </div>
                  {confirmPw && confirmPw !== password && (
                    <p style={{ fontSize:11, color:'#ef4444', marginTop:4 }}>รหัสผ่านไม่ตรงกัน</p>
                  )}
                </div>

                <button className="btn-main" onClick={handleReset} disabled={loading || !password || !confirmPw}>
                  {loading
                    ? <><div style={{ width:15, height:15, border:'2px solid rgba(212,175,55,0.3)', borderTop:'2px solid #d4af37', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/> กำลังบันทึก...</>
                    : <><CheckCircle size={16}/> บันทึกรหัสผ่านใหม่</>}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default function ResetPasswordPage() {
  const Spinner = () => (
    <div style={{ minHeight:'100vh', background:'#0d0d0d', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:32, height:32, border:'3px solid rgba(212,175,55,0.2)', borderTop:'3px solid #d4af37', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
    </div>
  )
  return <Suspense fallback={<Spinner />}><ResetPasswordForm /></Suspense>
}