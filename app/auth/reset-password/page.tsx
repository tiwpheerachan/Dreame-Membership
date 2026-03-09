'use client'
import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

function ResetPasswordForm() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // ตรวจสอบว่ามี session จาก reset link หรือเปล่า
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login?error=expired')
      } else {
        setReady(true)
      }
    })
  }, [])

  async function handleReset() {
    if (!password || !confirmPassword) { setError('กรุณากรอกรหัสผ่านให้ครบ'); return }
    if (password.length < 8) { setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return }
    if (password !== confirmPassword) { setError('รหัสผ่านไม่ตรงกัน'); return }
    setLoading(true); setError('')
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) { setError(err.message); return }
      setSuccess(true)
      setTimeout(() => router.push('/home'), 2000)
    } catch { setError('เกิดข้อผิดพลาด กรุณาลองใหม่') }
    finally { setLoading(false) }
  }

  const inputStyle = {
    width: '100%', background: 'rgba(31,41,55,1)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
    padding: '12px 14px', color: '#fff', fontSize: 14,
    outline: 'none', boxSizing: 'border-box' as const, paddingRight: 42,
  }

  if (!ready) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#030712' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 36, height: 36, border: '3px solid rgba(245,158,11,0.15)', borderTop: '3px solid #f59e0b', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#030712 0%,#111827 50%,#030712 100%)', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 58, height: 58, borderRadius: 18, background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow: '0 8px 24px rgba(245,158,11,0.4)', marginBottom: 12 }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: '#000' }}>D</span>
          </div>
          <h1 style={{ fontSize: 21, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>ตั้งรหัสผ่านใหม่</h1>
          <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>กรอกรหัสผ่านใหม่ของคุณ</p>
        </div>

        <div style={{ background: 'rgba(17,24,39,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 24 }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ fontSize: 40, marginBottom: 12 }}>✅</p>
              <p style={{ color: '#4ade80', fontSize: 16, fontWeight: 600, margin: '0 0 6px' }}>เปลี่ยนรหัสผ่านสำเร็จ!</p>
              <p style={{ color: '#6b7280', fontSize: 13 }}>กำลังพาไปหน้าหลัก...</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {error && (
                <div style={{ background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 14px', color: '#fca5a5', fontSize: 13 }}>
                  ⚠️ {error}
                </div>
              )}
              <div>
                <label style={{ display: 'block', color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>รหัสผ่านใหม่</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} placeholder="อย่างน้อย 8 ตัวอักษร"
                    value={password} onChange={e => setPassword(e.target.value)}
                    autoComplete="new-password" style={inputStyle}
                    onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#f59e0b'}
                    onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                  <button onClick={() => setShowPass(!showPass)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 16, padding: 0 }}>
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>ยืนยันรหัสผ่านใหม่</label>
                <input type={showPass ? 'text' : 'password'} placeholder="กรอกรหัสผ่านอีกครั้ง"
                  value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  style={{ ...inputStyle, borderColor: confirmPassword && confirmPassword !== password ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)' }}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = '#f59e0b'}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = confirmPassword && confirmPassword !== password ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'}
                  onKeyDown={e => { if (e.key === 'Enter') handleReset() }}
                />
                {confirmPassword && confirmPassword !== password && (
                  <p style={{ color: '#f87171', fontSize: 11, marginTop: 4 }}>รหัสผ่านไม่ตรงกัน</p>
                )}
              </div>
              <button onClick={handleReset} disabled={loading || !password || !confirmPassword}
                style={{ width: '100%', background: password && confirmPassword ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 12, padding: '14px 0', fontSize: 15, fontWeight: 700, color: password && confirmPassword ? '#000' : '#6b7280', cursor: password && confirmPassword ? 'pointer' : 'not-allowed', transition: 'all 0.2s', boxShadow: password && confirmPassword ? '0 4px 16px rgba(245,158,11,0.35)' : 'none' }}>
                {loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#030712' }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(245,158,11,0.15)', borderTop: '3px solid #f59e0b', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}