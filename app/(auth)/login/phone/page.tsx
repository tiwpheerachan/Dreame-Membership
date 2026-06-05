'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Phone, Smartphone, AlertCircle, CheckCircle, User } from 'lucide-react'
import { normalizeThaiPhone, formatThaiPhoneForDisplay, isValidThaiMobile } from '@/lib/phone'

type Step = 'phone' | 'otp'

export default function PhoneLoginPage() {
  // Suspense boundary required by Next.js 14 when using useSearchParams
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#ECE0CC' }} />}>
      <PhoneLoginInner />
    </Suspense>
  )
}

function PhoneLoginInner() {
  const router = useRouter()
  const supabase = createClient()
  const params = useSearchParams()
  // ?intent=signup ทำให้หน้าเปลี่ยน label เป็น "สมัครสมาชิก"
  // แต่ flow เหมือนกัน — signInWithOtp สร้าง user อัตโนมัติถ้ายังไม่มี
  const intent = params.get('intent') === 'signup' ? 'signup' : 'login'
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [fullName, setFullName] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const phoneE164Ref = useRef<string>('')

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  async function sendOtp() {
    setError('')
    let e164: string
    try { e164 = normalizeThaiPhone(phone) }
    catch { setError('เบอร์โทรไม่ถูกต้อง — รูปแบบ 08x-xxx-xxxx'); return }

    phoneE164Ref.current = e164
    setLoading(true)
    console.log('[phone-otp] sending OTP to', e164)
    const result = await supabase.auth.signInWithOtp({
      phone: e164,
      options: { channel: 'sms' },
    })
    console.log('[phone-otp] supabase response:', result)
    setLoading(false)
    if (result.error) {
      setError(`${result.error.message} (code: ${result.error.status})`)
      return
    }
    setStep('otp')
    setResendIn(60)
  }

  async function verifyOtp() {
    if (otp.length !== 6) { setError('กรอกรหัส OTP 6 หลัก'); return }
    setError(''); setLoading(true)
    const { data, error } = await supabase.auth.verifyOtp({
      phone: phoneE164Ref.current,
      token: otp,
      type: 'sms',
    })
    if (error || !data.session) {
      setLoading(false)
      setError(error?.message || 'รหัส OTP ไม่ถูกต้อง')
      return
    }

    // Ensure public.users row exists + backfill name/phone, then route
    await fetch('/api/users/ensure-profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName.trim() || undefined,
        phone: phoneE164Ref.current,
      }),
    }).catch(() => {})
    const { data: userRow } = await supabase
      .from('users').select('terms_accepted_at')
      .eq('id', data.user!.id).maybeSingle()
    router.replace(userRow?.terms_accepted_at ? '/home' : '/terms')
  }

  async function resend() {
    if (resendIn > 0) return
    await sendOtp()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#ECE0CC', display: 'flex',
      flexDirection: 'column', padding: '32px 22px', fontFamily: "'Prompt',system-ui,sans-serif" }}>

      <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
        color: '#3F2A1A', fontSize: 13, textDecoration: 'none', marginBottom: 32 }}>
        <ArrowLeft size={14} /> {intent === 'signup' ? 'สมัครด้วยอีเมล' : 'เข้าด้วยอีเมล'}
      </Link>

      <div style={{ maxWidth: 380, width: '100%', margin: '0 auto', flex: 1 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#0F0F0F',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px' }}>
          {step === 'phone'
            ? <Phone size={26} color="#E8C58C" strokeWidth={1.5} />
            : <Smartphone size={26} color="#E8C58C" strokeWidth={1.5} />}
        </div>

        <h1 style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, margin: '0 0 6px', color: '#1A1A1A' }}>
          {step === 'otp' ? 'ยืนยันรหัส OTP'
            : intent === 'signup' ? 'สมัครด้วยเบอร์โทร' : 'เข้าสู่ระบบด้วยเบอร์โทร'}
        </h1>
        <p style={{ textAlign: 'center', fontSize: 13, color: '#7A6B5B', margin: '0 0 28px' }}>
          {step === 'phone'
            ? 'ระบบจะส่งรหัส 6 หลักไปทาง SMS'
            : `ส่งไปที่ ${formatThaiPhoneForDisplay(phoneE164Ref.current)} แล้ว`}
        </p>

        {error && (
          <div style={{ display: 'flex', gap: 10, padding: 12, marginBottom: 16,
            background: '#FBE9E9', border: '1px solid #E8B4B4', borderRadius: 12 }}>
            <AlertCircle size={16} color="#B14242" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ margin: 0, fontSize: 12.5, color: '#7A2E2E' }}>{error}</p>
          </div>
        )}

        {step === 'phone' && (
          <>
            {intent === 'signup' && (
              <>
                <label style={{ display: 'block', fontSize: 11.5, color: '#6B5A48',
                  textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
                  ชื่อ-นามสกุล
                </label>
                <div style={{ position: 'relative', marginBottom: 14 }}>
                  <User size={15} style={{ position: 'absolute', left: 14, top: 17, color: '#A0907A' }} />
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="สมชาย ใจดี"
                    autoComplete="name"
                    style={{ width: '100%', padding: '14px 16px 14px 38px', fontSize: 15,
                      border: '1px solid #D7C5A6', borderRadius: 14, background: '#FFFAF1',
                      fontFamily: 'inherit', outline: 'none' }}
                  />
                </div>
              </>
            )}
            <label style={{ display: 'block', fontSize: 11.5, color: '#6B5A48',
              textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
              เบอร์โทรศัพท์
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="08x-xxx-xxxx"
              inputMode="tel"
              autoComplete="tel"
              onKeyDown={e => { if (e.key === 'Enter') sendOtp() }}
              style={{ width: '100%', padding: '14px 16px', fontSize: 16,
                border: '1px solid #D7C5A6', borderRadius: 14, background: '#FFFAF1',
                fontFamily: 'inherit', outline: 'none' }}
            />
            <button
              onClick={sendOtp}
              disabled={loading || !isValidThaiMobile(phone)}
              style={{ width: '100%', marginTop: 16, padding: '14px 18px',
                background: '#0F0F0F', color: '#E8C58C', border: 'none', borderRadius: 14,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit',
                opacity: (loading || !isValidThaiMobile(phone)) ? 0.55 : 1 }}>
              {loading ? 'กำลังส่ง…' : intent === 'signup' ? 'สมัครและส่งรหัส OTP' : 'ส่งรหัส OTP'}
            </button>
            {intent === 'login' && (
              <Link href="/login/phone?intent=signup"
                style={{ display: 'block', textAlign: 'center', marginTop: 12,
                  fontSize: 12.5, color: '#7A6B5B', textDecoration: 'none' }}>
                ยังไม่มีบัญชี? <strong style={{ color: '#3F2A1A' }}>สมัครด้วยเบอร์โทร</strong>
              </Link>
            )}
            {intent === 'signup' && (
              <Link href="/login/phone"
                style={{ display: 'block', textAlign: 'center', marginTop: 12,
                  fontSize: 12.5, color: '#7A6B5B', textDecoration: 'none' }}>
                มีบัญชีอยู่แล้ว? <strong style={{ color: '#3F2A1A' }}>เข้าสู่ระบบ</strong>
              </Link>
            )}
          </>
        )}

        {step === 'otp' && (
          <>
            <label style={{ display: 'block', fontSize: 11.5, color: '#6B5A48',
              textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
              รหัส OTP 6 หลัก
            </label>
            <input
              type="text"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="• • • • • •"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              onKeyDown={e => { if (e.key === 'Enter') verifyOtp() }}
              style={{ width: '100%', padding: '14px 16px', fontSize: 22,
                letterSpacing: 8, textAlign: 'center',
                border: '1px solid #D7C5A6', borderRadius: 14, background: '#FFFAF1',
                fontFamily: 'inherit', outline: 'none' }}
            />
            <button
              onClick={verifyOtp}
              disabled={loading || otp.length !== 6}
              style={{ width: '100%', marginTop: 16, padding: '14px 18px',
                background: '#0F0F0F', color: '#E8C58C', border: 'none', borderRadius: 14,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit',
                opacity: (loading || otp.length !== 6) ? 0.55 : 1 }}>
              {loading ? 'กำลังตรวจสอบ…' : <><CheckCircle size={14} style={{ verticalAlign: -2, marginRight: 6 }} />ยืนยัน</>}
            </button>

            <button
              onClick={resend}
              disabled={resendIn > 0}
              style={{ width: '100%', marginTop: 10, padding: '10px 18px',
                background: 'transparent', color: resendIn > 0 ? '#A0907A' : '#3F2A1A',
                border: 'none', fontSize: 12.5, cursor: resendIn > 0 ? 'default' : 'pointer',
                fontFamily: 'inherit' }}>
              {resendIn > 0 ? `ส่งใหม่ได้ใน ${resendIn} วินาที` : 'ส่งรหัสใหม่อีกครั้ง'}
            </button>

            <button
              onClick={() => { setStep('phone'); setOtp(''); setError('') }}
              style={{ width: '100%', marginTop: 4, padding: '6px',
                background: 'transparent', color: '#7A6B5B', border: 'none',
                fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              เปลี่ยนเบอร์
            </button>
          </>
        )}
      </div>
    </div>
  )
}
