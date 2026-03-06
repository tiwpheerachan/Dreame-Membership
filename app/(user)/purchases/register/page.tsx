'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, Upload, CheckCircle, Clock, X, Package, Loader2 } from 'lucide-react'
import Link from 'next/link'

type Step = 'order' | 'upload' | 'done'
type VerifyStatus = 'idle' | 'loading' | 'verified' | 'pending' | 'error'

const CHANNELS = [
  { value:'SHOPEE',  label:'Shopee',    emoji:'🛍️', type:'ONLINE' },
  { value:'LAZADA',  label:'Lazada',    emoji:'🛒', type:'ONLINE' },
  { value:'WEBSITE', label:'Website',   emoji:'🌐', type:'ONLINE' },
  { value:'TIKTOK',  label:'TikTok',    emoji:'🎵', type:'ONLINE' },
  { value:'STORE',   label:'หน้าร้าน', emoji:'🏪', type:'ONSITE' },
]

const CSS = `
  .rgw { min-height:100vh; background:#f7f7f5;  }
  .rg-hdr { background:#0d0d0d; padding:48px 20px 22px; position:relative; overflow:hidden; }
  .rg-hdr::before { content:''; position:absolute; top:-60px; right:-60px; width:200px; height:200px; border-radius:50%; background:radial-gradient(circle,rgba(212,175,55,0.15) 0%,transparent 70%); }
  .rg-hdr-line { position:absolute; top:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,rgba(212,175,55,0.4),transparent); }
  .rg-body { padding:16px; display:flex; flex-direction:column; gap:14px; }
  .rg-card { background:#fff; border-radius:18px; padding:18px; box-shadow:0 1px 6px rgba(0,0,0,0.06); border:1px solid rgba(0,0,0,0.04); }
  .rg-label { font-size:11px; font-weight:600; color:#6b7280; margin:0 0 8px; text-transform:uppercase; letter-spacing:0.05em; }
  .rg-input { width:100%; background:#f7f7f5; border:1px solid #e5e7eb; border-radius:12px; padding:12px 14px; font-size:14px; color:#111; outline:none; font-family:inherit; transition:border 0.15s; box-sizing:border-box; }
  .rg-input:focus { border-color:#d4af37; background:#fff; }
  .rg-textarea { width:100%; background:#f7f7f5; border:1px solid #e5e7eb; border-radius:12px; padding:12px 14px; font-size:14px; color:#111; outline:none; font-family:inherit; resize:none; transition:border 0.15s; box-sizing:border-box; }
  .rg-textarea:focus { border-color:#d4af37; background:#fff; }
  .ch-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .ch-btn { padding:11px 12px; border-radius:12px; font-size:13px; font-weight:600; text-align:left; cursor:pointer; transition:all 0.15s; border:1.5px solid #e5e7eb; background:#f7f7f5; color:#374151; display:flex; align-items:center; gap:8px; }
  .ch-btn-active { border-color:#d4af37; background:#0d0d0d; color:#d4af37; }
  .prog-steps { display:flex; gap:6px; }
  .prog-step { flex:1; height:4px; border-radius:100px; }
  .prog-step-done { background:linear-gradient(90deg,#b8860b,#d4af37); }
  .prog-step-todo { background:#e5e7eb; }
  .btn-gold { width:100%; padding:14px; border-radius:14px; border:none; background:linear-gradient(135deg,#b8860b,#d4af37,#f5d060); color:#0d0d0d; font-size:14px; font-weight:700; cursor:pointer; font-family:inherit; transition:opacity 0.15s; }
  .btn-gold:disabled { opacity:0.4; cursor:not-allowed; }
  .btn-outline { flex:1; padding:14px; border-radius:14px; border:1.5px solid #e5e7eb; background:#fff; color:#374151; font-size:14px; font-weight:600; cursor:pointer; font-family:inherit; }
  .verified-box { border-radius:14px; padding:14px; background:#f0fdf4; border:1px solid #bbf7d0; }
  .pending-box { border-radius:14px; padding:14px; background:#fffbeb; border:1px solid #fde68a; }
  .error-box { border-radius:14px; padding:14px; background:#fef2f2; border:1px solid #fecaca; }
  .upload-area { border-radius:14px; border:2px dashed #e5e7eb; padding:40px 24px; text-align:center; cursor:pointer; background:#f7f7f5; transition:all 0.15s; }
  .upload-area:hover { border-color:#d4af37; background:#fffbeb; }
`

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('order')
  const [orderSn, setOrderSn] = useState('')
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle')
  const [verifiedData, setVerifiedData] = useState<Record<string,unknown>|null>(null)
  const [channel, setChannel] = useState('SHOPEE')
  const [receipt, setReceipt] = useState<File|null>(null)
  const [previewUrl, setPreviewUrl] = useState<string|null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const selectedChannel = CHANNELS.find(c => c.value === channel)

  const steps = ['order','upload'] as const
  const stepIdx = (['order','upload'] as string[]).indexOf(step)

  async function verifyOrder() {
    if (!orderSn.trim()) return
    setVerifyStatus('loading')
    try {
      const res = await fetch('/api/purchases/verify-order', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ order_sn: orderSn, channel }),
      })
      const data = await res.json()
      if (data.status === 'VERIFIED') { setVerifiedData(data.order); setVerifyStatus('verified') }
      else if (data.status === 'PENDING') setVerifyStatus('pending')
      else setVerifyStatus('error')
    } catch { setVerifyStatus('error') }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setReceipt(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  async function submit() {
    setSubmitting(true); setError('')
    try {
      const fd = new FormData()
      fd.append('order_sn', orderSn); fd.append('channel', channel)
      fd.append('channel_type', selectedChannel?.type || 'ONLINE')
      if (verifiedData) fd.append('bq_data', JSON.stringify(verifiedData))
      if (receipt) fd.append('receipt', receipt)
      const res = await fetch('/api/purchases/register', { method:'POST', body:fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ')
      setStep('done')
    } catch(e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally { setSubmitting(false) }
  }

  if (step === 'done') return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />
      <div style={{ minHeight:'100vh', background:'#f7f7f5', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:32, textAlign:'center' }}>
        <div style={{ width:80, height:80, borderRadius:24, background:'linear-gradient(135deg,#d4af37,#f5d060)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', boxShadow:'0 8px 24px rgba(212,175,55,0.3)' }}>
          <CheckCircle size={40} color="#0d0d0d"/>
        </div>
        <h2 style={{ fontSize:22, fontWeight:700, color:'#0d0d0d', margin:'0 0 8px' }}>ลงทะเบียนสำเร็จ!</h2>
        <p style={{ color:'#6b7280', fontSize:13, margin:'0 0 28px', lineHeight:1.6 }}>
          {verifyStatus === 'verified' ? 'ยืนยันสินค้าเรียบร้อย คะแนนจะถูกเพิ่มภายใน 24 ชั่วโมง' : 'รับข้อมูลแล้ว กำลังตรวจสอบ อาจใช้เวลาสูงสุด 6 ชั่วโมง'}
        </p>
        <button onClick={() => router.push('/purchases')} style={{ padding:'14px 32px', background:'#0d0d0d', color:'#d4af37', borderRadius:14, fontWeight:700, fontSize:14, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
          ดูประวัติสินค้า →
        </button>
      </div>
    </>
  )

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="rgw">
        {/* Header */}
        <div className="rg-hdr">
          <div className="rg-hdr-line"/>
          <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', gap:12 }}>
            <Link href="/purchases" style={{ width:36, height:36, borderRadius:12, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.7)', textDecoration:'none', flexShrink:0 }}>
              <ArrowLeft size={16}/>
            </Link>
            <div>
              <p style={{ color:'rgba(255,255,255,0.4)', fontSize:11, margin:'0 0 2px', letterSpacing:'0.06em', textTransform:'uppercase' }}>ลงทะเบียน</p>
              <h1 style={{ color:'#fff', fontSize:18, fontWeight:700, margin:0 }}>สินค้า & ประกัน</h1>
            </div>
          </div>
        </div>

        <div className="rg-body">
          {/* Progress */}
          {(step as string) !== 'done' && (
            <div className="prog-steps">
              {steps.map((s,i) => (
                <div key={s} className={`prog-step ${stepIdx >= i ? 'prog-step-done' : 'prog-step-todo'}`}/>
              ))}
            </div>
          )}

          {/* STEP 1: Order */}
          {step === 'order' && (
            <>
              <div className="rg-card">
                <p className="rg-label">ช่องทางการซื้อ</p>
                <div className="ch-grid">
                  {CHANNELS.map(c => (
                    <button key={c.value} onClick={() => setChannel(c.value)}
                      className={`ch-btn ${channel === c.value ? 'ch-btn-active' : ''}`}>
                      <span style={{ fontSize:16 }}>{c.emoji}</span> {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rg-card">
                <p className="rg-label">Order ID / หมายเลขคำสั่งซื้อ</p>
                <div style={{ display:'flex', gap:8 }}>
                  <input className="rg-input" style={{ flex:1 }} type="text"
                    placeholder="เช่น 250123456789" value={orderSn}
                    onChange={e => setOrderSn(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && verifyOrder()}/>
                  <button onClick={verifyOrder} disabled={verifyStatus === 'loading' || !orderSn.trim()}
                    style={{ padding:'0 16px', borderRadius:12, background: !orderSn.trim() ? '#e5e7eb' : '#0d0d0d', color: !orderSn.trim() ? '#9ca3af' : '#d4af37', border:'none', cursor:'pointer', display:'flex', alignItems:'center' }}>
                    {verifyStatus === 'loading' ? <Loader2 size={18} style={{ animation:'spin 0.8s linear infinite' }}/> : <Search size={18}/>}
                  </button>
                </div>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

                {verifyStatus === 'verified' && verifiedData && (
                  <div className="verified-box" style={{ marginTop:12 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                      <CheckCircle size={14} color="#16a34a"/>
                      <p style={{ fontSize:13, fontWeight:700, color:'#15803d', margin:0 }}>ตรวจสอบสำเร็จ</p>
                    </div>
                    <p style={{ fontSize:12, color:'#374151', margin:'0 0 3px' }}>Platform: <span style={{ fontWeight:600 }}>{verifiedData.platform as string}</span></p>
                    <p style={{ fontSize:12, color:'#374151', margin:0 }}>ยอดรวม: <span style={{ fontWeight:600 }}>฿{Number(verifiedData.total_amount).toLocaleString()}</span></p>
                  </div>
                )}
                {verifyStatus === 'pending' && (
                  <div className="pending-box" style={{ marginTop:12, display:'flex', gap:10 }}>
                    <Clock size={16} color="#d97706" style={{ flexShrink:0, marginTop:1 }}/>
                    <div>
                      <p style={{ fontSize:13, fontWeight:600, color:'#92400e', margin:'0 0 3px' }}>ยังไม่พบข้อมูลใน BigQuery</p>
                      <p style={{ fontSize:11, color:'#92400e', margin:0, opacity:0.8 }}>ระบบจะตรวจสอบอัตโนมัติ คุณสามารถลงทะเบียนต่อได้</p>
                    </div>
                  </div>
                )}
                {verifyStatus === 'error' && (
                  <div className="error-box" style={{ marginTop:12 }}>
                    <p style={{ fontSize:13, color:'#dc2626', margin:0, fontWeight:500 }}>ไม่พบ Order ID นี้ กรุณาตรวจสอบอีกครั้ง</p>
                  </div>
                )}
              </div>

              {(verifyStatus === 'verified' || verifyStatus === 'pending') && (
                <button className="btn-gold" onClick={() => setStep('upload')}>ถัดไป →</button>
              )}
            </>
          )}

          {/* STEP 3: Upload */}
          {step === 'upload' && (
            <>
              <div className="rg-card">
                <p className="rg-label">อัพโหลดใบเสร็จ</p>
                {!previewUrl ? (
                  <div className="upload-area" onClick={() => fileRef.current?.click()}>
                    <div style={{ width:52, height:52, borderRadius:16, background:'#fff', border:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
                      <Upload size={24} color="#9ca3af"/>
                    </div>
                    <p style={{ fontSize:13, color:'#374151', fontWeight:600, margin:'0 0 4px' }}>กดเพื่อเลือกรูปใบเสร็จ</p>
                    <p style={{ fontSize:11, color:'#9ca3af', margin:0 }}>JPG, PNG, PDF · ไม่เกิน 10MB</p>
                  </div>
                ) : (
                  <div style={{ position:'relative', borderRadius:12, overflow:'hidden' }}>
                    <img src={previewUrl} alt="receipt" style={{ width:'100%', objectFit:'contain', maxHeight:240 }}/>
                    <button onClick={() => { setReceipt(null); setPreviewUrl(null) }}
                      style={{ position:'absolute', top:8, right:8, width:28, height:28, borderRadius:'50%', background:'rgba(0,0,0,0.6)', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                      <X size={14} color="#fff"/>
                    </button>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display:'none' }} onChange={handleFile}/>

              {error && (
                <div style={{ padding:'12px 14px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:12 }}>
                  <p style={{ color:'#dc2626', fontSize:13, margin:0 }}>⚠️ {error}</p>
                </div>
              )}

              <div style={{ display:'flex', gap:8 }}>
                <button className="btn-outline" onClick={() => setStep('order')}>← กลับ</button>
                <button className="btn-gold" style={{ flex:1 }} onClick={submit} disabled={submitting}>
                  {submitting ? (
                    <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                      <Loader2 size={16} style={{ animation:'spin 0.8s linear infinite' }}/> กำลังบันทึก...
                    </span>
                  ) : 'ยืนยัน ✓'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}