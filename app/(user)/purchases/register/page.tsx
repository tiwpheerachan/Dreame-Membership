'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Search, Upload, CheckCircle, Clock, X, Loader2,
  ShoppingBag, Globe, Store, Sparkles
} from 'lucide-react'
import Link from 'next/link'

type Step = 'order' | 'upload' | 'done'
type VerifyStatus = 'idle' | 'loading' | 'verified' | 'pending' | 'error'

const CHANNELS = [
  { value: 'SHOPEE',  label: 'Shopee',   Icon: ShoppingBag, type: 'ONLINE' },
  { value: 'LAZADA',  label: 'Lazada',   Icon: ShoppingBag, type: 'ONLINE' },
  { value: 'WEBSITE', label: 'Website',  Icon: Globe,       type: 'ONLINE' },
  { value: 'TIKTOK',  label: 'TikTok',   Icon: Sparkles,    type: 'ONLINE' },
  { value: 'STORE',   label: 'หน้าร้าน', Icon: Store,       type: 'ONSITE' },
]

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('order')
  const [orderSn, setOrderSn] = useState('')
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle')
  const [verifiedData, setVerifiedData] = useState<Record<string, unknown> | null>(null)
  const [channel, setChannel] = useState('SHOPEE')
  const [receipt, setReceipt] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const selectedChannel = CHANNELS.find(c => c.value === channel)

  const stepIdx = step === 'order' ? 0 : step === 'upload' ? 1 : 2

  async function verifyOrder() {
    if (!orderSn.trim()) return
    setVerifyStatus('loading')
    try {
      const res = await fetch('/api/purchases/verify-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
      fd.append('order_sn', orderSn)
      fd.append('channel', channel)
      fd.append('channel_type', selectedChannel?.type || 'ONLINE')
      if (verifiedData) fd.append('bq_data', JSON.stringify(verifiedData))
      if (receipt) fd.append('receipt', receipt)
      const res = await fetch('/api/purchases/register', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ')
      setStep('done')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally { setSubmitting(false) }
  }

  if (step === 'done') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
        <div className="fade-up" style={{
          width: 96, height: 96, borderRadius: '50%',
          background: 'var(--black)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
          boxShadow: 'var(--shadow-3)',
        }}>
          <CheckCircle size={42} color="var(--gold-soft)" strokeWidth={1.5} />
        </div>
        <p className="kicker fade-up" style={{ marginBottom: 8 }}>Registration Complete</p>
        <h2 className="fade-up" style={{ margin: '0 0 12px', fontSize: 28, lineHeight: 1.2 }}>
          <span style={{ fontWeight: 800 }}>ลงทะเบียน</span>{' '}
          <span className="serif-i" style={{ fontWeight: 400 }}>สำเร็จ</span>
        </h2>
        <p className="fade-up serif-i" style={{ color: 'var(--ink-mute)', fontSize: 13, margin: '0 0 32px', lineHeight: 1.6, maxWidth: 280 }}>
          {verifyStatus === 'verified'
            ? 'ยืนยันสินค้าเรียบร้อย คะแนนจะถูกเพิ่มภายใน 24 ชั่วโมง'
            : 'รับข้อมูลแล้ว กำลังตรวจสอบ ใช้เวลาสูงสุด 6 ชั่วโมง'}
        </p>
        <button onClick={() => router.push('/purchases')} className="btn btn-ink fade-up tap-down">
          ดูประวัติสินค้า →
        </button>
      </div>
    )
  }

  return (
    <div className="page-enter" style={{ paddingTop: 18 }}>
      {/* Header */}
      <header style={{ padding: '14px 20px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <Link href="/purchases" className="tap-down" style={{
          width: 38, height: 38, borderRadius: '50%',
          background: '#fff', border: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--ink)', textDecoration: 'none',
        }}>
          <ArrowLeft size={16} />
        </Link>
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>New Registration</p>
          <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.1 }}>
            <span style={{ fontWeight: 800 }}>ลงทะเบียน</span>{' '}
            <span className="serif-i" style={{ fontWeight: 400 }}>สินค้า</span>
          </h1>
        </div>
      </header>

      {/* Progress with step labels */}
      <div style={{ padding: '0 20px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="numerals" style={{ fontSize: 16, color: stepIdx >= 0 ? 'var(--gold-deep)' : 'var(--ink-faint)' }}>01</span>
          <div style={{ flex: 1, height: 2, background: stepIdx >= 1 ? 'var(--gold)' : 'var(--ink-ghost)', borderRadius: 'var(--r-pill)', transition: 'all 0.3s' }} />
          <span className="numerals" style={{ fontSize: 16, color: stepIdx >= 1 ? 'var(--gold-deep)' : 'var(--ink-faint)' }}>02</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <p className="kicker" style={{ margin: 0 }}>Order</p>
          <p className="kicker" style={{ margin: 0 }}>Receipt</p>
        </div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {step === 'order' && (
          <>
            <div className="surface" style={{ padding: 18 }}>
              <p className="kicker" style={{ margin: '0 0 12px' }}>Sales Channel</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {CHANNELS.map(c => {
                  const active = channel === c.value
                  return (
                    <button key={c.value} onClick={() => setChannel(c.value)} className="tap-down" style={{
                      padding: '12px 14px', borderRadius: 'var(--r-md)',
                      border: active ? '1px solid var(--black)' : '1px solid var(--line)',
                      background: active ? 'var(--black)' : '#fff',
                      color: active ? 'var(--gold-soft)' : 'var(--ink)',
                      fontSize: 13, fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 10,
                      cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all 0.18s ease',
                    }}>
                      <c.Icon size={15} strokeWidth={1.6} />
                      {c.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="surface" style={{ padding: 18 }}>
              <p className="kicker" style={{ margin: '0 0 12px' }}>Order ID</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="field" type="text" placeholder="เช่น 250123456789"
                  value={orderSn} onChange={e => setOrderSn(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && verifyOrder()}
                  style={{ flex: 1 }} />
                <button onClick={verifyOrder} disabled={verifyStatus === 'loading' || !orderSn.trim()}
                  className="btn btn-ink tap-down" style={{ padding: '0 18px' }}>
                  {verifyStatus === 'loading' ? <Loader2 size={16} className="spinner" /> : <Search size={16} />}
                </button>
              </div>

              {verifyStatus === 'verified' && verifiedData && (() => {
                const items = (verifiedData.items as Array<Record<string, unknown>>) || []
                const orderDate = verifiedData.order_date as string | undefined
                const totalQty = items.reduce((s, it) => s + Number(it.quantity || 0), 0)
                return (
                  <div style={{
                    marginTop: 12, padding: 14,
                    background: 'var(--green-soft)',
                    border: '1px solid rgba(64,107,63,0.18)',
                    borderRadius: 'var(--r-md)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <CheckCircle size={14} color="var(--green)" />
                      <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--green)', margin: 0 }}>
                        ตรวจสอบสำเร็จ
                      </p>
                    </div>

                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr',
                      gap: '6px 14px', fontSize: 12, color: 'var(--ink-soft)',
                      paddingBottom: items.length > 0 ? 10 : 0,
                      marginBottom: items.length > 0 ? 10 : 0,
                      borderBottom: items.length > 0 ? '1px solid rgba(64,107,63,0.18)' : 'none',
                    }}>
                      <div>Platform: <strong>{verifiedData.platform as string}</strong></div>
                      {orderDate && (
                        <div>วันที่ซื้อ: <strong>{orderDate}</strong></div>
                      )}
                      <div>ยอดรวม: <strong>฿{Number(verifiedData.total_amount).toLocaleString()}</strong></div>
                      {totalQty > 0 && (
                        <div>จำนวน: <strong>{totalQty} ชิ้น</strong></div>
                      )}
                    </div>

                    {items.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <p style={{ fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, margin: 0 }}>
                          รายการสินค้า ({items.length})
                        </p>
                        {items.map((it, i) => {
                          const qty = Number(it.quantity || 0)
                          const price = Number(it.price || 0)
                          const itemName = (it.item_name as string) || ''
                          const modelName = (it.model_name as string) || ''
                          const sku = (it.item_sku as string) || (it.model_sku as string) || ''
                          const showModel = modelName && itemName && modelName !== itemName
                          return (
                            <div key={i} style={{
                              padding: '8px 10px',
                              background: 'rgba(255,255,255,0.6)',
                              borderRadius: 'var(--r-sm)',
                              fontSize: 11.5, color: 'var(--ink)',
                            }}>
                              <p style={{ margin: '0 0 2px', fontWeight: 600, lineHeight: 1.35 }}>
                                {itemName || modelName || '—'}
                              </p>
                              {showModel && (
                                <p style={{ margin: '0 0 2px', fontSize: 10.5, color: 'var(--ink-mute)' }}>
                                  รุ่น: {modelName}
                                </p>
                              )}
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
                                <span>{sku}</span>
                                <span>
                                  ฿{price.toLocaleString()} × {qty} ={' '}
                                  <strong style={{ color: 'var(--ink)' }}>฿{(price * qty).toLocaleString()}</strong>
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })()}
              {verifyStatus === 'pending' && (
                <div style={{
                  marginTop: 12, padding: 14, display: 'flex', gap: 10,
                  background: 'var(--amber-soft)',
                  border: '1px solid rgba(154,110,31,0.20)',
                  borderRadius: 'var(--r-md)',
                }}>
                  <Clock size={15} color="var(--amber)" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--amber)', margin: '0 0 2px' }}>
                      ยังไม่พบใน BigQuery
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--amber)', margin: 0 }}>
                      ระบบจะตรวจสอบอัตโนมัติ คุณสามารถลงทะเบียนต่อได้
                    </p>
                  </div>
                </div>
              )}
              {verifyStatus === 'error' && (
                <div style={{
                  marginTop: 12, padding: 14,
                  background: 'var(--red-soft)',
                  border: '1px solid rgba(139,58,58,0.18)',
                  borderRadius: 'var(--r-md)',
                }}>
                  <p style={{ fontSize: 12.5, color: 'var(--red)', margin: 0, fontWeight: 600 }}>
                    ไม่พบ Order ID นี้ กรุณาตรวจสอบอีกครั้ง
                  </p>
                </div>
              )}
            </div>

            {(verifyStatus === 'verified' || verifyStatus === 'pending') && (
              <button className="btn btn-ink tap-down" onClick={() => setStep('upload')}>
                ถัดไป →
              </button>
            )}
          </>
        )}

        {step === 'upload' && (
          <>
            <div className="surface" style={{ padding: 18 }}>
              <p className="kicker" style={{ margin: '0 0 12px' }}>Receipt</p>
              {!previewUrl ? (
                <div onClick={() => fileRef.current?.click()} className="tap-down" style={{
                  border: '2px dashed var(--line)', borderRadius: 'var(--r-md)',
                  padding: 40, textAlign: 'center', cursor: 'pointer',
                  background: 'var(--bg-soft)',
                  transition: 'all 0.18s ease',
                }}>
                  <div style={{
                    width: 56, height: 56, margin: '0 auto 14px',
                    borderRadius: '50%', background: '#fff',
                    border: '1px solid var(--hair)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--gold-deep)',
                  }}>
                    <Upload size={22} strokeWidth={1.5} />
                  </div>
                  <p style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 700, margin: '0 0 4px' }}>
                    กดเพื่อเลือกรูปใบเสร็จ
                  </p>
                  <p className="serif-i" style={{ fontSize: 11, color: 'var(--ink-mute)', margin: 0 }}>
                    JPG · PNG · PDF · ไม่เกิน 10MB
                  </p>
                </div>
              ) : (
                <div style={{ position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="receipt" style={{ width: '100%', objectFit: 'contain', maxHeight: 300 }} />
                  <button onClick={() => { setReceipt(null); setPreviewUrl(null) }} className="tap-down" style={{
                    position: 'absolute', top: 8, right: 8,
                    width: 30, height: 30, borderRadius: '50%',
                    background: 'rgba(10,9,7,0.85)', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', backdropFilter: 'blur(8px)',
                  }}>
                    <X size={14} color="#fff" />
                  </button>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFile} />
            </div>

            {error && (
              <div style={{
                padding: '12px 14px',
                background: 'var(--red-soft)',
                border: '1px solid rgba(139,58,58,0.18)',
                borderRadius: 'var(--r-md)',
              }}>
                <p style={{ color: 'var(--red)', fontSize: 12.5, margin: 0 }}>⚠️ {error}</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep('order')} className="btn btn-ghost tap-down" style={{ flex: 1 }}>
                ← กลับ
              </button>
              <button onClick={submit} disabled={submitting} className="btn btn-ink tap-down" style={{ flex: 2 }}>
                {submitting ? <><Loader2 size={14} className="spinner" /> กำลังบันทึก...</> : 'ยืนยัน ✓'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
