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

// Per-field requirement per channel. 'req' = บังคับ, 'opt' = ไม่บังคับ, 'off' = ไม่ต้อง
type Req = 'req' | 'opt' | 'off'
interface ChannelDef {
  value: string
  label: string
  orderId: Req
  sn: Req
  receipt: Req
  bqVerify: boolean            // ตรวจสอบกับ BigQuery หรือไม่ (เฉพาะช่องทางออนไลน์)
  channelType: 'ONLINE' | 'ONSITE'
}

// Matrix (ยืนยันกับลูกค้าแล้ว):
//   Platform (Shopee/Lazada/TikTok) : OrderID บังคับ · SN ไม่บังคับ · ใบเสร็จ ไม่ต้อง · verify BQ
//   Website (Shopify)               : OrderID บังคับ · SN ไม่บังคับ · ใบเสร็จ ไม่ต้อง · verify BQ
//   Brand Shop                      : OrderID บังคับ · SN ไม่บังคับ · ใบเสร็จ บังคับ
//   หน้าร้าน                          : OrderID ไม่ต้อง · SN บังคับ · ใบเสร็จ บังคับ
const CHANNELS: ChannelDef[] = [
  { value: 'SHOPEE',    label: 'Shopee',     orderId: 'req', sn: 'opt', receipt: 'off', bqVerify: true,  channelType: 'ONLINE' },
  { value: 'LAZADA',    label: 'Lazada',     orderId: 'req', sn: 'opt', receipt: 'off', bqVerify: true,  channelType: 'ONLINE' },
  { value: 'TIKTOK',    label: 'TikTok',     orderId: 'req', sn: 'opt', receipt: 'off', bqVerify: true,  channelType: 'ONLINE' },
  { value: 'WEBSITE',   label: 'Website',    orderId: 'req', sn: 'opt', receipt: 'off', bqVerify: true,  channelType: 'ONLINE' },
  { value: 'BRANDSHOP', label: 'Brand Shop', orderId: 'req', sn: 'opt', receipt: 'req', bqVerify: false, channelType: 'ONSITE' },
  { value: 'STORE',     label: 'หน้าร้าน',    orderId: 'off', sn: 'req', receipt: 'req', bqVerify: false, channelType: 'ONSITE' },
]
const defOf = (v: string): ChannelDef => CHANNELS.find(c => c.value === v) ?? CHANNELS[0]

// A single order/unit queued for submission (multiple allowed, any channel).
interface OrderEntry {
  key: string
  channel: string
  order_sn: string
  serial_number: string
  bqData: Record<string, unknown> | null
  state: 'verified' | 'pending' | 'bq_error' | 'manual'
  receipt: File | null
  receiptPreview: string | null
}

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('form')
  const [channel, setChannel] = useState('SHOPEE')
  const def = defOf(channel)

  // ── shared "current entry" inputs ──
  const [orderSn, setOrderSn] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle')
  const [verifyMsg, setVerifyMsg] = useState('')
  const [verifiedData, setVerifiedData] = useState<Record<string, unknown> | null>(null)
  const [receipt, setReceipt] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── queue of orders ──
  const [orders, setOrders] = useState<OrderEntry[]>([])
  const keyRef = useRef(0)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [doneCount, setDoneCount] = useState(0)
  const [failMsgs, setFailMsgs] = useState<string[]>([])

  // Derived per-channel flags
  const showOrderId  = def.orderId !== 'off'
  const orderIdReq   = def.orderId === 'req'
  const showVerify   = def.bqVerify
  const snReq        = def.sn === 'req'
  const showReceipt  = def.receipt !== 'off'
  const receiptReq   = def.receipt === 'req'

  // Order-ID step satisfied enough to reveal SN/receipt.
  // BQ channels: needs a resolved verify state. Others: always ready.
  const currentReady = !showVerify
    || verifyStatus === 'verified' || verifyStatus === 'pending' || verifyStatus === 'bq_error'

  // Show SN card: for req channels always; for opt channels once the order-id step is ready.
  const showSnCard = def.sn !== 'off' && (snReq || currentReady)

  // Is the "current entry" complete enough to add/submit?
  function currentValid(): boolean {
    if (orderIdReq && !orderSn.trim()) return false
    if (showVerify && !(verifyStatus === 'verified' || verifyStatus === 'pending' || verifyStatus === 'bq_error')) return false
    if (snReq && !serialNumber.trim()) return false
    if (receiptReq && !receipt) return false
    return true
  }

  const entryKey = () => orderSn.trim() || serialNumber.trim()

  function resetCurrent() {
    setOrderSn(''); setSerialNumber(''); setVerifyStatus('idle'); setVerifyMsg(''); setVerifiedData(null)
    // A queued entry takes ownership of previewUrl — clear the ref WITHOUT revoking.
    setReceipt(null); setPreviewUrl(null)
  }

  function switchChannel(v: string) {
    if (v === channel) return
    setChannel(v); setError('')
    // Current, un-queued receipt is discarded on switch — safe to revoke.
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    resetCurrent()
  }

  async function verifyOrder() {
    const sn = orderSn.trim()
    if (!sn) return
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

  function makeEntry(key: string): OrderEntry {
    return {
      key,
      channel,
      order_sn: orderSn.trim(),
      serial_number: serialNumber.trim(),
      bqData: verifiedData,
      state: showVerify ? (verifyStatus as OrderEntry['state']) : 'manual',
      receipt,
      receiptPreview: previewUrl,
    }
  }

  // Push the current (valid) entry into the queue and clear inputs for the next.
  function addAnother() {
    if (!currentValid()) return
    const k = entryKey()
    if (orders.some(o => (o.order_sn || o.serial_number) === k)) {
      setError('รายการนี้ถูกเพิ่มไว้แล้ว'); return
    }
    setError('')
    setOrders(prev => [...prev, makeEntry(`o${keyRef.current++}`)])
    resetCurrent()
  }

  function removeOrder(key: string) {
    setOrders(prev => {
      const o = prev.find(x => x.key === key)
      if (o?.receiptPreview) URL.revokeObjectURL(o.receiptPreview)
      return prev.filter(x => x.key !== key)
    })
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setReceipt(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  // All entries to submit = queued + the current one (if valid & not already queued).
  function collectEntries(): OrderEntry[] {
    const list = [...orders]
    if (currentValid()) {
      const k = entryKey()
      if (!list.some(o => (o.order_sn || o.serial_number) === k)) list.push(makeEntry('current'))
    }
    return list
  }

  const entries = collectEntries()
  const totalEntries = entries.length

  async function submitAll() {
    if (entries.length === 0) { setError('กรุณาเพิ่มอย่างน้อย 1 รายการ'); return }
    setSubmitting(true); setError('')
    let ok = 0
    const fails: string[] = []
    for (const o of entries) {
      const d = defOf(o.channel)
      const label = o.order_sn || o.serial_number
      try {
        const fd = new FormData()
        if (o.order_sn) fd.append('order_sn', o.order_sn)
        fd.append('channel', o.channel)
        fd.append('channel_type', d.channelType)
        if (o.serial_number) fd.append('serial_number', o.serial_number)
        if (o.bqData) fd.append('bq_data', JSON.stringify(o.bqData))
        if (o.receipt) fd.append('receipt', o.receipt)
        const res = await fetch('/api/purchases/register', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok) fails.push(`${label}: ${data.error || 'ไม่สำเร็จ'}`)
        else ok++
      } catch { fails.push(`${label}: เกิดข้อผิดพลาด`) }
    }
    setSubmitting(false)
    if (ok > 0) {
      setDoneCount(ok); setFailMsgs(fails); setStep('done'); router.refresh()
    } else {
      setError(fails.join('\n') || 'บันทึกไม่สำเร็จ')
    }
  }

  const helpText = def.bqVerify
    ? 'กรอก Order ID เพื่อตรวจสอบ · Serial Number ไม่บังคับ · เพิ่มได้หลายออเดอร์'
    : def.orderId === 'off'
      ? 'กรอก Serial Number และแนบใบเสร็จ (จำเป็น) · ไม่ต้องมี Order ID · เพิ่มได้หลายรายการ'
      : 'กรอก Order ID และแนบใบเสร็จ (จำเป็น) · Serial Number ไม่บังคับ · เพิ่มได้หลายรายการ'

  function stateLabel(s: OrderEntry['state']) {
    if (s === 'verified') return '✓ ตรวจสอบแล้ว'
    if (s === 'manual') return 'รอแอดมินตรวจสอบ'
    return 'รอตรวจสอบ'
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
            ? `บันทึก ${doneCount} รายการเรียบร้อย — คะแนนจะถูกเพิ่มหลังตรวจสอบ`
            : 'รับข้อมูลแล้ว คะแนนจะถูกเพิ่มหลังการตรวจสอบ'}
        </p>
        {failMsgs.length > 0 && (
          <div style={{
            margin: '0 0 24px', padding: '10px 14px', maxWidth: 320,
            background: 'var(--amber-soft)', border: '1px solid rgba(154,110,31,0.20)',
            borderRadius: 'var(--r-md)', textAlign: 'left',
          }}>
            <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--amber)', margin: '0 0 4px' }}>
              {failMsgs.length} รายการไม่สำเร็จ
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
            {helpText}
          </p>
        </div>

        {/* ── Queued orders ── */}
        {orders.length > 0 && (
          <div className="surface" style={{ padding: 18 }}>
            <p className="kicker" style={{ margin: '0 0 12px' }}>รายการที่เพิ่มแล้ว ({orders.length})</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {orders.map(o => (
                <div key={o.key} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', background: 'var(--bg-soft)',
                  border: '1px solid var(--hair)', borderRadius: 'var(--r-md)',
                }}>
                  <PlatformLogo channel={o.channel} size={18} />
                  {o.receiptPreview && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={o.receiptPreview} alt="receipt" style={{
                      width: 32, height: 32, flexShrink: 0, objectFit: 'cover',
                      borderRadius: 'var(--r-sm)', border: '1px solid var(--hair)',
                    }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {o.order_sn || o.serial_number}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 10.5, color: 'var(--ink-mute)' }}>
                      {stateLabel(o.state)}
                      {o.order_sn && o.serial_number ? ` · SN ${o.serial_number}` : ''}
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
        {showOrderId && (
          <div className="surface" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <p className="kicker" style={{ margin: 0 }}>
                {orders.length > 0 ? 'เพิ่มออเดอร์ถัดไป' : 'Order ID'}
              </p>
              {!orderIdReq && (
                <span style={{ fontSize: 10, color: 'var(--ink-faint)', letterSpacing: '0.04em', fontWeight: 600 }}>ไม่จำเป็น</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="field" type="text" placeholder="เช่น 250123456789"
                value={orderSn}
                onChange={e => { setOrderSn(e.target.value); if (verifyStatus !== 'idle') { setVerifyStatus('idle'); setVerifiedData(null) } }}
                onKeyDown={e => e.key === 'Enter' && showVerify && verifyOrder()}
                style={{ flex: 1 }} />
              {showVerify && (
                <button onClick={verifyOrder} disabled={verifyStatus === 'loading' || !orderSn.trim()}
                  className="btn btn-ink tap-down" style={{ padding: '0 18px' }}>
                  {verifyStatus === 'loading' ? <Loader2 size={16} className="spinner" /> : <Search size={16} />}
                </button>
              )}
            </div>

            {/* Brand Shop: order id ไม่เรียลไทม์ — ไม่มีปุ่มค้นหา, แจ้งว่ารอตรวจสอบ */}
            {showOrderId && !showVerify && (
              <div style={{
                marginTop: 12, padding: 14, display: 'flex', gap: 10,
                background: 'var(--amber-soft)', border: '1px solid rgba(154,110,31,0.20)', borderRadius: 'var(--r-md)',
              }}>
                <Clock size={15} color="var(--amber)" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 11, color: 'var(--amber)', margin: 0, lineHeight: 1.5 }}>
                  หมายเลข Order ID ของ Brand Shop ไม่ใช่เรียลไทม์ — สถานะการสั่งซื้อจะได้รับการตรวจสอบภายใน 1–2 วัน
                </p>
              </div>
            )}

            {/* Verified BQ preview (online only) */}
            {showVerify && verifyStatus === 'verified' && verifiedData && (() => {
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

            {showVerify && verifyStatus === 'pending' && (
              <div style={{
                marginTop: 12, padding: 14, display: 'flex', gap: 10,
                background: 'var(--amber-soft)', border: '1px solid rgba(154,110,31,0.20)', borderRadius: 'var(--r-md)',
              }}>
                <Clock size={15} color="var(--amber)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--amber)', margin: '0 0 2px' }}>ยังไม่พบข้อมูลออเดอร์</p>
                  <p style={{ fontSize: 11, color: 'var(--amber)', margin: 0, lineHeight: 1.5 }}>
                    กรุณาตรวจสอบความถูกต้องของข้อมูล — สถานะการสั่งซื้อจะได้รับการตรวจสอบภายใน 1–2 วัน คุณลงทะเบียนต่อได้เลย
                  </p>
                </div>
              </div>
            )}
            {showVerify && verifyStatus === 'bq_error' && (
              <div style={{
                marginTop: 12, padding: 14, display: 'flex', gap: 10,
                background: 'var(--amber-soft)', border: '1px solid rgba(154,110,31,0.20)', borderRadius: 'var(--r-md)',
              }}>
                <Clock size={15} color="var(--amber)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--amber)', margin: '0 0 2px' }}>ตรวจสอบไม่สำเร็จชั่วคราว</p>
                  <p style={{ fontSize: 11, color: 'var(--amber)', margin: 0, lineHeight: 1.5 }}>
                    ลงทะเบียนต่อได้เลย — สถานะการสั่งซื้อจะได้รับการตรวจสอบภายใน 1–2 วัน
                  </p>
                </div>
              </div>
            )}
            {showVerify && verifyStatus === 'error' && (
              <div style={{
                marginTop: 12, padding: 14,
                background: 'var(--red-soft)', border: '1px solid rgba(139,58,58,0.18)', borderRadius: 'var(--r-md)',
              }}>
                <p style={{ fontSize: 12.5, color: 'var(--red)', margin: 0, fontWeight: 600 }}>
                  ไม่พบ Order ID นี้ กรุณาตรวจสอบอีกครั้ง
                </p>
              </div>
            )}
            {showVerify && verifyStatus === 'claimed' && (
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
        )}

        {/* ── Serial Number ── */}
        {showSnCard && (
          <div className="surface" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <p className="kicker" style={{ margin: 0 }}>Serial Number (SN)</p>
              <span style={{
                fontSize: 10, letterSpacing: '0.04em', fontWeight: snReq ? 700 : 600,
                color: snReq ? 'var(--red)' : 'var(--ink-faint)',
              }}>
                {snReq ? 'จำเป็น' : 'ไม่จำเป็น'}
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

        {/* ── Receipt (Brand Shop / หน้าร้าน — REQUIRED) ── */}
        {showReceipt && (
          <div className="surface" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <p className="kicker" style={{ margin: 0 }}>Receipt · ใบเสร็จ</p>
              <span style={{
                fontSize: 10, letterSpacing: '0.04em', fontWeight: receiptReq ? 700 : 600,
                color: receiptReq ? 'var(--red)' : 'var(--ink-faint)',
              }}>
                {receiptReq ? 'จำเป็น' : 'ไม่จำเป็น'}
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
                <button onClick={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setReceipt(null); setPreviewUrl(null) }} className="tap-down" style={{
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

        {/* ── Add-another ── */}
        {currentValid() && (
          <button onClick={addAnother} className="btn btn-ghost tap-down" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Plus size={16} /> เพิ่มรายการอีก
          </button>
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
        <button onClick={submitAll} disabled={submitting || totalEntries === 0}
          className="btn btn-ink tap-down">
          {submitting
            ? <><Loader2 size={14} className="spinner" /> กำลังบันทึก...</>
            : `ยืนยัน${totalEntries > 1 ? ` ${totalEntries} รายการ` : ''} ✓`}
        </button>
      </div>
    </div>
  )
}
