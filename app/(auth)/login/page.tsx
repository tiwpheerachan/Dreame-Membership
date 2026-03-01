'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

type Step = 'input' | 'otp' | 'name'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [step, setStep] = useState<Step>('input')
  const [inputType, setInputType] = useState<'phone' | 'email'>('email')
  const [value, setValue] = useState('')
  const [otp, setOtp] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [magicSent, setMagicSent] = useState(false)

  // Handle ?new=1 from magic link callback (new user needs name)
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setStep('name')
    }
    if (searchParams.get('error') === '1') {
      setError('ลิงก์หมดอายุหรือไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง')
    }
  }, [searchParams])

  function startCountdown() {
    setCountdown(60)
    const t = setInterval(() => {
      setCountdown(c => { if (c <= 1) { clearInterval(t); return 0 } return c - 1 })
    }, 1000)
  }

  async function sendOtp() {
    setLoading(true); setError(''); setMagicSent(false)
    try {
      if (inputType === 'phone') {
        const phone = value.startsWith('+') ? value : '+66' + value.replace(/^0/, '')
        const { error: err } = await supabase.auth.signInWithOtp({ phone })
        if (err) throw err
        setStep('otp')
        startCountdown()
      } else {
        // Email — sends Magic Link (user clicks link → auto login)
        const { error: err } = await supabase.auth.signInWithOtp({
          email: value,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })
        if (err) throw err
        setMagicSent(true)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'ส่งไม่สำเร็จ กรุณาลองใหม่')
    } finally { setLoading(false) }
  }

  async function verifyOtp() {
    setLoading(true); setError('')
    try {
      const phone = value.startsWith('+') ? value : '+66' + value.replace(/^0/, '')
      const { error: err, data } = await supabase.auth.verifyOtp({
        phone, token: otp, type: 'sms'
      })
      if (err) throw err
      const { data: user } = await supabase.from('users').select('id, full_name').eq('id', data.session!.user.id).single()
      if (!user || !user.full_name) setStep('name')
      else router.push('/home')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'รหัส OTP ไม่ถูกต้อง')
    } finally { setLoading(false) }
  }

  async function saveName() {
    setLoading(true); setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Session expired')
      await supabase.from('users').upsert({
        id: user.id,
        full_name: fullName,
        phone: inputType === 'phone' ? value : user.phone,
        email: inputType === 'email' ? value : user.email,
      })
      // new user → ต้องยอมรับ terms ก่อน
      router.push('/terms')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4">
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30 mb-4">
            <span className="text-2xl font-black text-gray-900">D</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Dreame Membership</h1>
          <p className="text-gray-400 text-sm mt-1">สมัครหรือเข้าสู่ระบบ</p>
        </div>

        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 backdrop-blur">

          {/* Step 1: Input */}
          {step === 'input' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">เข้าสู่ระบบ</h2>

              <div className="flex rounded-lg overflow-hidden border border-gray-700">
                <button onClick={() => { setInputType('email'); setMagicSent(false) }}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${inputType === 'email' ? 'bg-amber-500 text-gray-900' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  ✉️ Email
                </button>
                <button onClick={() => { setInputType('phone'); setMagicSent(false) }}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${inputType === 'phone' ? 'bg-amber-500 text-gray-900' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  📱 เบอร์โทร
                </button>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  {inputType === 'email' ? 'อีเมล' : 'เบอร์โทรศัพท์'}
                </label>
                <input
                  type={inputType === 'email' ? 'email' : 'tel'}
                  placeholder={inputType === 'email' ? 'you@example.com' : '0812345678'}
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && value && sendOtp()}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm"
                />
              </div>

              {error && <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{error}</p>}

              {/* Magic link sent state */}
              {magicSent && (
                <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-4 text-center space-y-2">
                  <p className="text-2xl">📬</p>
                  <p className="text-green-400 font-semibold text-sm">ส่งลิงก์เข้าสู่ระบบแล้ว!</p>
                  <p className="text-gray-400 text-xs">เช็คอีเมล <span className="text-white font-medium">{value}</span><br/>คลิกปุ่ม <strong>"Log In"</strong> ในอีเมลได้เลย</p>
                  <p className="text-gray-600 text-xs mt-2">ไม่เห็นอีเมล? เช็ค Spam folder ด้วยนะครับ</p>
                  <button onClick={() => { setMagicSent(false); sendOtp() }} disabled={loading}
                    className="mt-2 text-amber-400 text-xs hover:underline">
                    ส่งใหม่
                  </button>
                </div>
              )}

              {!magicSent && (
                <button onClick={sendOtp} disabled={loading || !value}
                  className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-semibold py-3 rounded-lg transition-colors text-sm">
                  {loading ? 'กำลังส่ง...' : inputType === 'email' ? 'รับลิงก์เข้าสู่ระบบ' : 'รับรหัส OTP'}
                </button>
              )}

              {inputType === 'email' && !magicSent && (
                <p className="text-gray-600 text-xs text-center">ระบบจะส่งลิงก์ Magic Link ไปยังอีเมลของคุณ</p>
              )}
            </div>
          )}

          {/* Step 2: Phone OTP */}
          {step === 'otp' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white">กรอก OTP</h2>
                <p className="text-gray-400 text-sm mt-1">ส่งรหัส 6 หลักไปยัง {value}</p>
              </div>
              <input type="text" inputMode="numeric" placeholder="------" maxLength={6}
                value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && otp.length === 6 && verifyOtp()}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-center text-2xl tracking-widest font-mono focus:outline-none focus:border-amber-500" />
              {error && <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{error}</p>}
              <button onClick={verifyOtp} disabled={loading || otp.length !== 6}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-900 font-semibold py-3 rounded-lg text-sm">
                {loading ? 'กำลังตรวจสอบ...' : 'ยืนยัน OTP'}
              </button>
              <div className="flex items-center justify-between">
                <button onClick={() => setStep('input')} className="text-gray-400 hover:text-white text-sm">← กลับ</button>
                {countdown > 0
                  ? <span className="text-gray-500 text-sm">ส่งใหม่ใน {countdown}s</span>
                  : <button onClick={sendOtp} className="text-amber-400 text-sm">ส่ง OTP ใหม่</button>}
              </div>
            </div>
          )}

          {/* Step 3: Name (new user) */}
          {step === 'name' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white">ยินดีต้อนรับ! 🎉</h2>
                <p className="text-gray-400 text-sm mt-1">กรุณากรอกชื่อเพื่อสมัครสมาชิก</p>
              </div>
              <input type="text" placeholder="ชื่อ-นามสกุล" value={fullName}
                onChange={e => setFullName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fullName && saveName()}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 text-sm" />
              {error && <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{error}</p>}
              <button onClick={saveName} disabled={loading || !fullName.trim()}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-900 font-semibold py-3 rounded-lg text-sm">
                {loading ? 'กำลังบันทึก...' : 'เริ่มต้นใช้งาน →'}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">© 2024 Dreame Thailand · Membership System</p>
      </div>
    </div>
  )
}