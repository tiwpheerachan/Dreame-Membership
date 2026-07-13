'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Search, Upload, CheckCircle, Clock, X, Loader2, Plus, Trash2,
} from 'lucide-react'
import Link from 'next/link'
import PlatformLogo from '@/components/admin/PlatformLogo'

type Step = 'form' | 'done'
type VerifyStatus = 'idle' | 'loading' | 'verified' | 'pending' | 'bq_error' | 'error' | 'claimed'

const CHANNELS = [
  { value: 'SHOPEE',  label: 'Shopee',     type: 'ONLINE' },
  { value: 'LAZADA',  label: 'Lazada',     type: 'ONLINE' },
  { value: 'WEBSITE', label: 'Website',    type: 'ONLINE' },
  { value: 'TIKTOK',  label: 'TikTok',     type: 'ONLINE' },
  { value: 'STORE',   label: 'หน้าร้าน',   type: 'ONSITE' },
]

// A single online order queued for submission (multiple allowed).
interface OrderEntry {
  key: string
  order_sn: string
  serial_number: string
  channel: string
  bqData: Record<string, unknown> | null
  state: 'verified' | 'pending' | 'bq_error'
}

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('form')
  const [channel, setChannel] = useState('SHOPEE')
  const selectedChannel = CHANNELS.find(c => c.value === channel)
  const isOnline = selectedChannel?.type === 'ONLINE'

  // ── shared "current order" inputs (used by both online add + onsite) ──
  const [orderSn, setOrderSn] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle')
  const [verifyMsg, setVerifyMsg] = useState('')
  const [verifiedData, setVerifiedData] = useState<Record<string, unknown> | null>(null)

  // ── online: queue of orders ──
  const [orders, setOrders] = useState<OrderEntry[]>([])
  const keyRef = useRef(0)

  // ── onsite: receipt ──
  const [receipt, setReceipt] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [doneCount, setDoneCount] = useState(0)
  const [failMsgs, setFailMsgs] = useState<string[]>([])

  // Current order counts as "ready" once it has verified/pending/bq_error state.
  const currentReady = verifyStatus === 'verified' || verifyStatus === 'pending' || verifyStatus === 'bq_error'
  const totalOrders = orders.length + (currentReady && orderSn.trim() ? 1 : 0)

  function resetCurrent() {
    setOrderSn(''); setSerialNumber(''); setVerifyStatus('idle'); setVerifyMsg(''); setVerifiedData(null)
  }

  function switchChannel(v: string) {
    setChannel(v)
    setError('')
    // Orders already queued keep their own captured channel, so switching the
    // selector only affects the NEXT order the user adds — nothing to clear.
  }

  async function verifyOrder() {
    const sn = orderSn.trim()
    if (!sn) return
    // Guard against queuing the same order twice.
    if (orders.some(o => o.order_sn === sn)) {
      setVerifyStatus('claimed'); setVerifyMsg('คุณเพิ่มออเดอร์นี้ไว้แล้ว')
      return
    }
    setVerifyStatus('loading')
    try {
      const res = await fetch('/api/purchases/verify-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_sn: sn, channel }),
      })
      const data = await res.json()
      if (data.status === 'VERIFIED') { setVerifiedData(data.order); setVerifyStatus('verified') }
      else if (data.status === 'ALREADY_CLAIMED') { setVerifyMsg(data.message || 'ออเดอร์นี้ถูกใช้ลงทะเบียนไปแล้ว'); setVerifyStatus('claimed') }
      else if (data.status === 'PENDING') setVerifyStatus('pending')
      else if (data.status === 'BQ_ERROR') setVerifyStatus('bq_error')
      else setVerifyStatus('error')
    } catch { setVerifyStatus('error') }
  }

  // Push the current verified order into the queue and clear inputs for the next.
  function addAnother() {
    if (!currentReady || !orderSn.trim()) return
    setOrders(prev => [...prev, {
      key: `o${keyRef.current++}`,
      order_sn: orderSn.trim(),
      serial_number: serialNumber.trim(),
      channel,
      bqData: verifiedData,
      state: verifyStatus as OrderEntry['state'],
    }])
    resetCurrent()
  }

  function removeOrder(key: string) {
    setOrders(prev => prev.filter(o => o.key !== key))
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setReceipt(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  // All orders to submit = queued + the current one (if ready & not queued).
  function collectOrders(): OrderEntry[] {
    const list = [...orders]
    const sn = orderSn.trim()
    if (currentReady && sn && !list.some(o => o.order_sn === sn)) {
      list.push({
        key: 'current', order_sn: sn, serial_number: serialNumber.trim(),
        channel, bqData: verifiedData, state: verifyStatus as OrderEntry['state'],
      })
    }
    return list
  }

  async function submitOnline() {
    const list = collectOrders()
    if (list.length === 0) { setError('กรุณาเพิ่มอย่างน้อย 1 ออเดอร์'); return }
    setSubmitting(true); setError('')
    let ok = 0
    const fails: string[] = []
    for (const o of list) {
      try {
        const fd = new FormData()
        fd.append('order_sn', o.order_sn)
        fd.append('channel', o.channel)
        fd.append('channel_type', 'ONLINE')
        if (o.serial_number) fd.append('serial_number', o.serial_number)
        if (o.bqData) fd.append('bq_data', JSON.stringify(o.bqData))
        const res = await fetch('/api/purchases/register', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok) fails.push(`${o.order_sn}: ${data.error || 'ไม่สำเร็จ'}`)
        else ok++
      } catch { fails.push(`${o.order_sn}: เกิดข้อผิดพลาด`) }
    }
    setSubmitting(false)
    if (ok > 0) {
      setDoneCount(ok); setFailMsgs(fails); setStep('done'); router.refresh()
    } else {
      setError(fails.join('\n') || 'บันทึกไม่สำเร็จ')
    }
  }

  async function submitOnsite() {
    if (!orderSn.trim()) { setError('กรุณากรอก Order ID'); return }
    if (!receipt) { setError('กรุณาแนบใบเสร็จ (จำเป็นสำหรับหน้าร้าน)'); return }
    setSubmitting(true); setError('')
    try {
      const fd = new FormData()
      fd.append('order_sn', orderSn.trim())
      fd.append('channel', channel)
      fd.append('channel_type', 'ONSITE')
      if (serialNumber.trim()) fd.append('serial_number', serialNumber.trim())
      fd.append('receipt', receipt)
      const res = await fetch('/api/purchases/register', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ')
      setDoneCount(1); setFailMsgs([]); setStep('done'); router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally { setSubmitting(false) }
  }

  // ── DONE ──
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
        <p className="fade-up serif-i" style={{ color: 'var(--ink-mute)', fontSize: 13, margin: '0 0 12px', lineHeight: 1.6, maxWidth: 300 }}>
          {doneCount > 1
            ? `บันทึก ${doneCount} ออเดอร์เรียบร้อย — คะแนนจะถูกเพิ่มหลังตรวจสอบ`
            : 'รับข้อมูลแล้ว คะแนนจะถูกเพิ่มหลังการตรวจสอบ'}
        </p>
        {failMsgs.length > 0 && (
          <div style={{
            margin: '0 0 24px', padding: '10px 14px', maxWidth: 320,
            background: 'var(--amber-soft)', border: '1px solid rgba(154,110,31,0.20)',
            borderRadius: 'var(--r-md)', textAlign: 'left',
          }}>
            <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--amber)', margin: '0 0 4px' }}>
              {failMsgs.length} ออเดอร์ไม่สำเร็จ
            </p>
            {failMsgs.map((m, i) => (
              <p key={i} style={{ fontSize: 11, color: 'var(--amber)', margin: 0, lineHeight: 1.5 }}>• {m}</p>
            ))}
          </div>
        )}
        <button onClick={() => router.push('/purchases')} className="btn btn-ink fade-up tap-down" style={{ marginTop: failMsgs.length ? 0 : 20 }}>
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

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* ── Channel selector ── */}
        <div className="surface" style={{ padding: 18 }}>
          <p className="kicker" style={{ margin: '0 0 12px' }}>Sales Channel</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {CHANNELS.map(c => {
              const active = channel === c.value
              return (
                <button key={c.value} onClick={() => switchChannel(c.value)} className="tap-down" style={{
                  padding: '12px 14px', borderRadius: 'var(--r-md)',
                  border: active ? '1px solid var(--black)' : '1px solid var(--line)',
                  background: active ? 'var(--black)' : '#fff',
                  color: active ? 'var(--gold-soft)' : 'var(--ink)',
                  fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.18s ease',
                }}>
                  <PlatformLogo channel={c.value} size={18} />
                  {c.label}
                </button>
              )
            })}
          </div>
          <p style={{ fontSize: 11, color: 'var(--ink-mute)', margin: '12px 0 0', lineHeight: 1.5 }}>
            {isOnline
              ? 'ซื้อออนไลน์ — กรอก Order ID เพิ่มได้หลายออเดอร์ · Serial Number ไม่บังคับ'
              : 'ซื้อหน้าร้าน — กรอก Order ID และแนบใบเสร็จ (จำเป็น)'}
          </p>
        </div>

        {/* ── Queued online orders ── */}
        {isOnline && orders.length > 0 && (
          <div className="surface" style={{ padding: 18 }}>
            <p className="kicker" style={{ margin: '0 0 12px' }}>ออเดอร์ที่เพิ่มแล้ว ({orders.length})</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {orders.map(o => (
                <div key={o.key} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', background: 'var(--bg-soft)',
                  border: '1px solid var(--hair)', borderRadius: 'var(--r-md)',
                }}>
                  <PlatformLogo channel={o.channel} size={18} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {o.order_sn}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 10.5, color: 'var(--ink-mute)' }}>
                      {o.state === 'verified' ? '✓ ตรวจสอบแล้ว' : 'รอตรวจสอบ'}
                      {o.serial_number ? ` · SN ${o.serial_number}` : ''}
                    </p>
                  </div>
                  <button onClick={() => removeOrder(o.key)} className="tap-down" style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    background: '#fff', border: '1px solid var(--line)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--red)', cursor: 'pointer',
                  }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Order ID card ── */}
        <div className="surface" style={{ padding: 18 }}>
          <p className="kicker" style={{ margin: '0 0 12px' }}>
            {isOnline && orders.length > 0 ? 'เพิ่มออเดอร์ถัดไป' : 'Order ID'}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="field" type="text" placeholder="เช่น 250123456789"
              value={orderSn}
              onChange={e => { setOrderSn(e.target.value); if (verifyStatus !== 'idle') { setVerifyStatus('idle'); setVerifiedData(null) } }}
              onKeyDown={e => e.key === 'Enter' && isOnline && verifyOrder()}
              style={{ flex: 1 }} />
            {isOnline && (
              <button onClick={verifyOrder} disabled={verifyStatus === 'loading' || !orderSn.trim()}
                className="btn btn-ink tap-down" style={{ padding: '0 18px' }}>
                {verifyStatus === 'loading' ? <Loader2 size={16} className="spinner" /> : <Search size={16} />}
              </button>
            )}
          </div>

          {/* Verified BQ preview (online only) */}
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
                  {orderDate && (<div>วันที่ซื้อ: <strong>{orderDate}</strong></div>)}
                  <div>ยอดรวม: <strong>฿{Number(verifiedData.total_amount).toLocaleString()}</strong></div>
                  {totalQty > 0 && (<div>จำนวน: <strong>{totalQty} ชิ้น</strong></div>)}
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
                      const imageUrl = (it.image_url as string | null) || null
                      const showModel = modelName && itemName && modelName !== itemName
                      return (
                        <div key={i} style={{
                          padding: '8px 10px',
                          background: 'rgba(255,255,255,0.6)',
                          borderRadius: 'var(--r-sm)',
                          fontSize: 11.5, color: 'var(--ink)',
                          display: 'flex', gap: 10, alignItems: 'flex-start',
                        }}>
                          {imageUrl && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={imageUrl} alt={itemName || modelName || 'product'}
                              style={{
                                width: 48, height: 48, flexShrink: 0,
                                objectFit: 'cover', borderRadius: 'var(--r-sm)',
                                background: 'var(--bg-soft)', border: '1px solid var(--hair)',
                              }} />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
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
              background: 'var(--amber-soft)', border: '1px solid rgba(154,110,31,0.20)', borderRadius: 'var(--r-md)',
            }}>
              <Clock size={15} color="var(--amber)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--amber)', margin: '0 0 2px' }}>ยังไม่พบใน BigQuery</p>
                <p style={{ fontSize: 11, color: 'var(--amber)', margin: 0 }}>ระบบจะตรวจสอบอัตโนมัติ คุณสามารถลงทะเบียนต่อได้</p>
              </div>
            </div>
          )}
          {verifyStatus === 'bq_error' && (
            <div style={{
              marginTop: 12, padding: 14, display: 'flex', gap: 10,
              background: 'var(--amber-soft)', border: '1px solid rgba(154,110,31,0.20)', borderRadius: 'var(--r-md)',
            }}>
              <Clock size={15} color="var(--amber)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--amber)', margin: '0 0 2px' }}>ตรวจสอบ BigQuery ไม่สำเร็จ</p>
                <p style={{ fontSize: 11, color: 'var(--amber)', margin: 0 }}>ลงทะเบียนต่อได้ แอดมินจะตรวจสอบให้</p>
              </div>
            </div>
          )}
          {verifyStatus === 'error' && (
            <div style={{
              marginTop: 12, padding: 14,
              background: 'var(--red-soft)', border: '1px solid rgba(139,58,58,0.18)', borderRadius: 'var(--r-md)',
            }}>
              <p style={{ fontSize: 12.5, color: 'var(--red)', margin: 0, fontWeight: 600 }}>
                ไม่พบ Order ID นี้ กรุณาตรวจสอบอีกครั้ง
              </p>
            </div>
          )}
          {verifyStatus === 'claimed' && (
            <div style={{
              marginTop: 12, padding: 14, display: 'flex', gap: 10,
              background: 'var(--red-soft)', border: '1px solid rgba(139,58,58,0.18)', borderRadius: 'var(--r-md)',
            }}>
              <X size={15} color="var(--red)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--red)', margin: '0 0 2px' }}>ออเดอร์นี้ใช้ไม่ได้</p>
                <p style={{ fontSize: 11, color: 'var(--red)', margin: 0 }}>
                  {verifyMsg || 'ออเดอร์นี้ถูกใช้ลงทะเบียนไปแล้ว ไม่สามารถใช้ซ้ำได้'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Serial Number (optional) — online after verify, onsite always ── */}
        {((isOnline && currentReady) || !isOnline) && (
          <div className="surface" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <p className="kicker" style={{ margin: 0 }}>Serial Number (SN)</p>
              <span style={{ fontSize: 10, color: 'var(--ink-faint)', letterSpacing: '0.04em', fontWeight: 600 }}>
                ไม่จำเป็น
              </span>
            </div>
            <input
              className="field" type="text" placeholder="เช่น SN-ABCD1234567"
              value={serialNumber}
              onChange={e => setSerialNumber(e.target.value.toUpperCase())}
              autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={50}
              style={{ width: '100%', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}
            />
            <p style={{ fontSize: 10.5, color: 'var(--ink-mute)', margin: '8px 0 0', lineHeight: 1.5 }}>
              เลขเครื่องด้านล่าง/หลังกล่องสินค้า — ใช้สำหรับ <strong>การรับประกัน</strong> และ service
            </p>
          </div>
        )}

        {/* ── Add-another (online) ── */}
        {isOnline && currentReady && (
          <button onClick={addAnother} className="btn btn-ghost tap-down" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Plus size={16} /> เพิ่มออเดอร์อีก
          </button>
        )}

        {/* ── Receipt (onsite REQUIRED) ── */}
        {!isOnline && (
          <div className="surface" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <p className="kicker" style={{ margin: 0 }}>Receipt · ใบเสร็จ</p>
              <span style={{ fontSize: 10, color: 'var(--red)', letterSpacing: '0.04em', fontWeight: 700 }}>
                จำเป็น
              </span>
            </div>
            {!previewUrl ? (
              <div onClick={() => fileRef.current?.click()} className="tap-down" style={{
                border: '2px dashed var(--line)', borderRadius: 'var(--r-md)',
                padding: 40, textAlign: 'center', cursor: 'pointer',
                background: 'var(--bg-soft)', transition: 'all 0.18s ease',
              }}>
                <div style={{
                  width: 56, height: 56, margin: '0 auto 14px',
                  borderRadius: '50%', background: '#fff', border: '1px solid var(--hair)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold-deep)',
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
        )}

        {error && (
          <div style={{
            padding: '12px 14px',
            background: 'var(--red-soft)', border: '1px solid rgba(139,58,58,0.18)', borderRadius: 'var(--r-md)',
          }}>
            {error.split('\n').map((line, i) => (
              <p key={i} style={{ color: 'var(--red)', fontSize: 12.5, margin: 0, lineHeight: 1.5 }}>⚠️ {line}</p>
            ))}
          </div>
        )}

        {/* ── Submit ── */}
        {isOnline ? (
          <button onClick={submitOnline} disabled={submitting || totalOrders === 0}
            className="btn btn-ink tap-down">
            {submitting
              ? <><Loader2 size={14} className="spinner" /> กำลังบันทึก...</>
              : `ยืนยัน${totalOrders > 1 ? ` ${totalOrders} ออเดอร์` : ''} ✓`}
          </button>
        ) : (
          <button onClick={submitOnsite} disabled={submitting || !orderSn.trim() || !receipt}
            className="btn btn-ink tap-down">
            {submitting ? <><Loader2 size={14} className="spinner" /> กำลังบันทึก...</> : 'ยืนยัน ✓'}
          </button>
        )}
      </div>
    </div>
  )
}
