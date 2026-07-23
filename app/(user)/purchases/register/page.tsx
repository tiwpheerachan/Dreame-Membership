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
  lookupBy: 'order' | 'serial' | null  // ค้นหา BQ ด้วยอะไร (order id / serial / ไม่ค้น)
  autoAward: boolean                    // เจอใน BQ แล้วให้แต้มทันทีไหม (เฉพาะออนไลน์)
  channelType: 'ONLINE' | 'ONSITE'
}

// Matrix (ยืนยันกับลูกค้าแล้ว):
//   Platform (Shopee/Lazada/TikTok) : OrderID บังคับ · SN ไม่บังคับ · ใบเสร็จ ไม่ต้อง · ค้น BQ (order) · ให้แต้มอัตโนมัติ
//   Website (Shopify)               : OrderID บังคับ · SN ไม่บังคับ · ใบเสร็จ ไม่ต้อง · ค้น BQ (order) · ให้แต้มอัตโนมัติ
//   หน้าร้าน (รวม Brand Shop)          : OrderID ไม่บังคับ · SN บังคับ · ใบเสร็จ บังคับ · ค้น BQ (serial) · รอแอดมินยืนยัน
//     → ปุ่มเดียว ค้นด้วย SN แล้วระบบแยกเองจาก BQ shop_type ว่าเป็น Brand Shop
//       (คิดแต้ม 2×) หรือหน้าร้านทั่วไป (1×) — แอดมินหน้ารอตรวจสอบเห็นแยกให้
const CHANNELS: ChannelDef[] = [
  { value: 'SHOPEE',    label: 'Shopee',     orderId: 'req', sn: 'opt', receipt: 'off', lookupBy: 'order',  autoAward: true,  channelType: 'ONLINE' },
  { value: 'LAZADA',    label: 'Lazada',     orderId: 'req', sn: 'opt', receipt: 'off', lookupBy: 'order',  autoAward: true,  channelType: 'ONLINE' },
  { value: 'TIKTOK',    label: 'TikTok',     orderId: 'req', sn: 'opt', receipt: 'off', lookupBy: 'order',  autoAward: true,  channelType: 'ONLINE' },
  { value: 'WEBSITE',   label: 'Website',    orderId: 'req', sn: 'opt', receipt: 'off', lookupBy: 'order',  autoAward: true,  channelType: 'ONLINE' },
  { value: 'STORE',     label: 'หน้าร้าน',    orderId: 'opt', sn: 'req', receipt: 'req', lookupBy: 'serial', autoAward: false, channelType: 'ONSITE' },
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
}

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('form')
  const [channel, setChannel] = useState('SHOPEE')
  const def = defOf(channel)

  // ── shared "current entry" inputs ──
  const [orderSn, setOrderSn] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  // Multiple SNs per order (an order can ship several products). Order-based
  // channels collect a list here; หน้าร้าน keeps a single SN (its lookup key).
  const [serialList, setSerialList] = useState<string[]>([])
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle')
  const [verifyMsg, setVerifyMsg] = useState('')
  const [verifiedData, setVerifiedData] = useState<Record<string, unknown> | null>(null)
  // ใบเสร็จหลายรูป (ใช้ร่วมทุกซีเรียลของหน้าร้าน)
  const [receipts, setReceipts] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  // หน้าร้าน: ค้นด้วย Order ID → ดึงซีเรียลของออเดอร์มาให้อัตโนมัติ
  const [orderSearchStatus, setOrderSearchStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [orderSearchMsg, setOrderSearchMsg] = useState('')

  // ── queue of orders ──
  const [orders, setOrders] = useState<OrderEntry[]>([])
  const keyRef = useRef(0)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [doneCount, setDoneCount] = useState(0)
  const [failMsgs, setFailMsgs] = useState<string[]>([])

  // Derived per-channel flags
  const showOrderId    = def.orderId !== 'off'
  const orderIdReq     = def.orderId === 'req'
  const snReq          = def.sn === 'req'
  const showReceipt    = def.receipt !== 'off'
  const receiptReq     = def.receipt === 'req'
  const lookupOnOrder  = def.lookupBy === 'order'   // ค้น BQ ด้วย Order ID
  const lookupOnSerial = def.lookupBy === 'serial'  // ค้น BQ ด้วย Serial Number (หน้าร้าน)
  const showVerify     = def.lookupBy !== null      // ทุกช่องค้น BQ ได้
  const autoAward      = def.autoAward              // ออนไลน์เท่านั้นที่ให้แต้มอัตโนมัติ

  // Order-ID step satisfied enough to reveal SN/receipt.
  // ONLINE (auto-award): needs a resolved verify state. ONSITE: always ready
  // (การค้น BQ เป็นแค่ข้อมูลประกอบ ไม่บังคับ — ลูกค้ากรอกใบเสร็จแล้วส่งได้เลย).
  const currentReady = !autoAward
    || verifyStatus === 'verified' || verifyStatus === 'pending' || verifyStatus === 'bq_error'

  // Show SN card: for req channels always; for opt channels once the order-id step is ready.
  const showSnCard = def.sn !== 'off' && (snReq || currentReady)

  // Is the "current entry" complete enough to add/submit?
  function currentValid(): boolean {
    if (orderIdReq && !orderSn.trim()) return false
    if (snReq && !serialNumber.trim()) return false
    // ซีเรียล/ออเดอร์ที่ระบบแจ้งว่าซ้ำแล้ว ห้ามเพิ่ม/ส่ง (กัน 409 ตอน submit)
    if (verifyStatus === 'claimed') return false
    // ใบเสร็จ (หน้าร้าน) ใช้ร่วมทุกรายการ → เช็คเป็น gate รวมตอน submit (canSubmit)
    // ONLINE must resolve the BQ verify so bq_data attaches for auto-award.
    // ONSITE (หน้าร้าน) don't require the search — admin confirms them.
    if (autoAward && !(verifyStatus === 'verified' || verifyStatus === 'pending' || verifyStatus === 'bq_error')) return false
    return true
  }

  const entryKey = () => orderSn.trim() || serialNumber.trim()

  // ล้างช่องกรอกปัจจุบัน (ไม่แตะใบเสร็จ — ใบเสร็จเป็น shared, ล้างตอนเปลี่ยนช่องทาง)
  function resetCurrent() {
    setOrderSn(''); setSerialNumber(''); setSerialList([]); setVerifyStatus('idle'); setVerifyMsg(''); setVerifiedData(null)
    setOrderSearchStatus('idle'); setOrderSearchMsg('')
  }

  function clearReceipts() {
    previewUrls.forEach(u => URL.revokeObjectURL(u))
    setReceipts([]); setPreviewUrls([])
  }

  // Order-based channels: add the typed SN to the list (1 order → many SNs).
  function addSerial() {
    const s = serialNumber.trim()
    if (!s || serialList.includes(s)) { setSerialNumber(''); return }
    setSerialList(prev => [...prev, s])
    setSerialNumber('')
  }
  function removeSerial(s: string) {
    setSerialList(prev => prev.filter(x => x !== s))
  }
  // All SNs for the current entry (list + anything still typed but not added).
  function collectSerials(): string[] {
    const typed = serialNumber.trim()
    return typed && !serialList.includes(typed) ? [...serialList, typed] : serialList
  }

  function switchChannel(v: string) {
    if (v === channel) return
    setChannel(v); setError('')
    clearReceipts()  // ใบเสร็จของช่องเดิมถูกทิ้งเมื่อเปลี่ยนช่องทาง
    resetCurrent()
  }

  async function verifyOrder() {
    // Brand Shop searches by Order ID; หน้าร้าน searches by Serial Number.
    const q = lookupOnSerial ? serialNumber.trim() : orderSn.trim()
    if (!q) return
    if (orders.some(o => (o.order_sn || o.serial_number) === q)) {
      setVerifyStatus('claimed')
      setVerifyMsg(lookupOnSerial ? 'คุณเพิ่ม Serial Number นี้ไว้แล้ว' : 'คุณเพิ่มออเดอร์นี้ไว้แล้ว')
      return
    }
    setVerifyStatus('loading')
    try {
      const res = await fetch('/api/purchases/verify-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lookupOnSerial ? { serial_number: q, channel } : { order_sn: q, channel }),
      })
      const data = await res.json()
      if (data.status === 'VERIFIED') { setVerifiedData(data.order); setVerifyStatus('verified') }
      else if (data.status === 'ALREADY_CLAIMED') { setVerifyMsg(data.message || 'รายการนี้ถูกใช้ลงทะเบียนไปแล้ว'); setVerifyStatus('claimed') }
      else if (data.status === 'PENDING') setVerifyStatus('pending')
      else if (data.status === 'BQ_ERROR') setVerifyStatus('bq_error')
      else setVerifyStatus('error')
    } catch { setVerifyStatus('error') }
  }

  // หน้าร้าน: ค้นออเดอร์ด้วย Order ID → ดึงซีเรียลทั้งหมดมาเข้าคิวให้อัตโนมัติ
  async function searchStoreOrder() {
    const oid = orderSn.trim()
    if (!oid) return
    setOrderSearchStatus('loading'); setOrderSearchMsg(''); setError('')
    try {
      const res = await fetch('/api/purchases/verify-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_sn: oid, channel: 'STORE', lookup: 'order' }),
      })
      const data = await res.json()
      if (data.status === 'FOUND_ORDER') {
        type Unit = { serial: string; item_name: string; item_sku: string; model_name: string; unit_price: number; image_url: string | null; claimed: boolean }
        const units = (data.units || []) as Unit[]
        const fresh = units.filter(u => !u.claimed && !orders.some(o => o.serial_number === u.serial))
        if (fresh.length > 0) {
          const newEntries: OrderEntry[] = fresh.map(u => ({
            key: `o${keyRef.current++}`,
            channel: 'STORE',
            order_sn: '',
            serial_number: u.serial,
            bqData: {
              order_sn: data.order_sn, platform: data.platform, order_date: data.order_date,
              shop_type: data.shop_type, total_amount: u.unit_price,
              items: [{
                item_id: '', model_id: '', item_name: u.item_name, item_sku: u.item_sku,
                model_name: u.model_name, model_sku: '', quantity: 1, price: u.unit_price,
                buyer_paid: u.unit_price, image_url: u.image_url,
              }],
            },
            state: 'manual',
          }))
          setOrders(prev => [...prev, ...newEntries])
          setOrderSn('')
        }
        const skipped = units.length - fresh.length
        setOrderSearchStatus('done')
        setOrderSearchMsg(
          units.length === 0
            ? 'ออเดอร์นี้ไม่มี Serial Number ในระบบ — กรอก SN เองได้เลย'
            : `พบ ${units.length} ซีเรียล · เพิ่มให้ ${fresh.length}${skipped > 0 ? ` · ข้ามที่ลงแล้ว ${skipped}` : ''}`,
        )
      } else if (data.status === 'ORDER_NOT_FOUND' || data.status === 'BQ_ERROR') {
        setOrderSearchStatus('error'); setOrderSearchMsg(data.message || 'ไม่พบออเดอร์')
      } else {
        setOrderSearchStatus('error'); setOrderSearchMsg('ค้นหาไม่สำเร็จ')
      }
    } catch {
      setOrderSearchStatus('error'); setOrderSearchMsg('เกิดข้อผิดพลาด')
    }
  }

  function makeEntry(key: string): OrderEntry {
    // หน้าร้าน = single SN (its lookup key). Order-based = the collected list.
    const serials = lookupOnSerial ? [serialNumber.trim()].filter(Boolean) : collectSerials()
    return {
      key,
      channel,
      order_sn: orderSn.trim(),
      serial_number: serials.join(', '),
      // Keep the BQ data even for Brand Shop/หน้าร้าน — admin sees the product —
      // but their state is 'manual' (รอแอดมินยืนยัน), never auto-verified.
      bqData: verifiedData,
      state: autoAward ? (verifyStatus as OrderEntry['state']) : 'manual',
    }
  }

  // Push the current (valid) entry into the queue and clear inputs for the next.
  function addAnother() {
    if (!currentValid()) return
    const k = entryKey()
    if (orders.some(o => (o.order_sn || o.serial_number) === k)) {
      setError(lookupOnSerial ? 'ซีเรียลนี้ถูกเพิ่มไว้แล้ว' : 'รายการนี้ถูกเพิ่มไว้แล้ว'); return
    }
    setError('')
    setOrders(prev => [...prev, makeEntry(`o${keyRef.current++}`)])
    if (lookupOnSerial) {
      // หน้าร้าน: เก็บใบเสร็จ(ใช้ร่วม)ไว้ — ล้างแค่ช่องซีเรียล + ผลค้นหา เพื่อกรอกตัวถัดไป
      setSerialNumber(''); setVerifyStatus('idle'); setVerifyMsg(''); setVerifiedData(null)
    } else {
      resetCurrent()
    }
  }

  function removeOrder(key: string) {
    setOrders(prev => prev.filter(x => x.key !== key))
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setReceipts(prev => [...prev, ...files])
    setPreviewUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
    if (fileRef.current) fileRef.current.value = ''  // อนุญาตให้เลือกไฟล์เดิมซ้ำได้
  }

  function removeReceipt(idx: number) {
    setPreviewUrls(prev => { if (prev[idx]) URL.revokeObjectURL(prev[idx]); return prev.filter((_, i) => i !== idx) })
    setReceipts(prev => prev.filter((_, i) => i !== idx))
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
  // หน้าร้าน: ต้องมีใบเสร็จอย่างน้อย 1 รูป (ใช้ร่วมทุกซีเรียล) ก่อนยืนยัน
  const receiptMissing = receiptReq && receipts.length === 0
  const canSubmit = totalEntries > 0 && !receiptMissing

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
        // ใบเสร็จ (หน้าร้าน) ใช้ร่วมทุกรายการ — แนบทุกรูปให้ทุก registration
        if (d.receipt !== 'off') receipts.forEach(f => fd.append('receipt', f))
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

  const helpText = autoAward
    ? 'กรอก Order ID เพื่อตรวจสอบ · Serial Number ไม่บังคับ · เพิ่มได้หลายออเดอร์'
    : lookupOnSerial
      ? 'กรอก Serial Number (ค้นหาสินค้าได้) · เพิ่มได้หลายซีเรียล · แนบใบเสร็จได้หลายรูปใช้ร่วมกัน · Order ID กรอกหรือไม่ก็ได้ · รอแอดมินยืนยัน'
      : 'กรอก Order ID (ค้นหาสินค้าได้) และแนบใบเสร็จ · Serial Number ไม่บังคับ · รอแอดมินยืนยัน'

  function stateLabel(s: OrderEntry['state']) {
    if (s === 'verified') return '✓ ตรวจสอบแล้ว'
    if (s === 'manual') return 'รอแอดมินตรวจสอบ'
    return 'รอตรวจสอบ'
  }

  // Shared BQ-lookup result UI — rendered under whichever field does the lookup
  // (Order ID for online/Brand Shop, Serial Number for หน้าร้าน).
  function renderVerifyResult() {
    if (verifyStatus === 'verified' && verifiedData) {
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
              {autoAward ? 'ตรวจสอบสำเร็จ' : 'พบข้อมูลสินค้าในระบบ'}
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
          {!autoAward && (
            <p style={{ fontSize: 11, color: 'var(--amber)', margin: '10px 0 0', lineHeight: 1.5, fontWeight: 600 }}>
              ⏳ พบข้อมูลแล้ว — แนบใบเสร็จและกดยืนยัน จากนั้นรอแอดมินตรวจสอบอีกครั้ง
            </p>
          )}
        </div>
      )
    }
    if (verifyStatus === 'pending') {
      return (
        <div style={{
          marginTop: 12, padding: 14, display: 'flex', gap: 10,
          background: 'var(--amber-soft)', border: '1px solid rgba(154,110,31,0.20)', borderRadius: 'var(--r-md)',
        }}>
          <Clock size={15} color="var(--amber)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--amber)', margin: '0 0 2px' }}>ยังไม่พบข้อมูลในระบบ</p>
            <p style={{ fontSize: 11, color: 'var(--amber)', margin: 0, lineHeight: 1.5 }}>
              กรุณาตรวจสอบความถูกต้องของข้อมูล — สถานะการสั่งซื้อจะได้รับการตรวจสอบภายใน 1–2 วัน คุณลงทะเบียนต่อได้เลย
            </p>
          </div>
        </div>
      )
    }
    if (verifyStatus === 'bq_error') {
      return (
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
      )
    }
    if (verifyStatus === 'error') {
      return (
        <div style={{
          marginTop: 12, padding: 14,
          background: 'var(--red-soft)', border: '1px solid rgba(139,58,58,0.18)', borderRadius: 'var(--r-md)',
        }}>
          <p style={{ fontSize: 12.5, color: 'var(--red)', margin: 0, fontWeight: 600 }}>
            {lookupOnSerial ? 'ไม่พบ Serial Number นี้ กรุณาตรวจสอบอีกครั้ง' : 'ไม่พบ Order ID นี้ กรุณาตรวจสอบอีกครั้ง'}
          </p>
        </div>
      )
    }
    if (verifyStatus === 'claimed') {
      return (
        <div style={{
          marginTop: 12, padding: 14, display: 'flex', gap: 10,
          background: 'var(--red-soft)', border: '1px solid rgba(139,58,58,0.18)', borderRadius: 'var(--r-md)',
        }}>
          <X size={15} color="var(--red)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--red)', margin: '0 0 2px' }}>รายการนี้ใช้ไม่ได้</p>
            <p style={{ fontSize: 11, color: 'var(--red)', margin: 0 }}>
              {verifyMsg || 'รายการนี้ถูกใช้ลงทะเบียนไปแล้ว ไม่สามารถใช้ซ้ำได้'}
            </p>
          </div>
        </div>
      )
    }
    return null
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
              {orders.map(o => {
                const items = (o.bqData?.items as Array<Record<string, unknown>> | undefined) || []
                const it = items[0] || {}
                const img = (it.image_url as string | null) || null
                const name = (it.item_name as string) || (it.model_name as string) || ''
                const price = Number(it.price || o.bqData?.total_amount || 0)
                const primary = o.order_sn || o.serial_number
                const snCount = o.order_sn ? o.serial_number.split(',').filter(s => s.trim()).length : 0
                return (
                  <div key={o.key} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', background: 'var(--bg-soft)',
                    border: '1px solid var(--hair)', borderRadius: 'var(--r-md)',
                  }}>
                    {/* รูปสินค้า (ถ้ามีใน BQ) ไม่งั้นโลโก้ช่องทาง */}
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={name || 'product'} style={{
                        width: 44, height: 44, flexShrink: 0, objectFit: 'cover',
                        borderRadius: 'var(--r-sm)', background: '#fff', border: '1px solid var(--hair)',
                      }} />
                    ) : (
                      <div style={{
                        width: 44, height: 44, flexShrink: 0, borderRadius: 'var(--r-sm)',
                        background: '#fff', border: '1px solid var(--hair)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <PlatformLogo channel={o.channel} size={22} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {name || primary}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 10.5, color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {primary}{snCount > 0 ? ` · ${snCount} SN` : ''}{price > 0 ? ` · ฿${price.toLocaleString()}` : ''}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 10, color: o.state === 'verified' ? 'var(--green)' : 'var(--ink-faint)', fontWeight: 600 }}>
                        {stateLabel(o.state)}
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
                )
              })}
            </div>
          </div>
        )}

        {/* ── Order ID card ── */}
        {showOrderId && (
          <div className="surface" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <p className="kicker" style={{ margin: 0 }}>
                {!lookupOnSerial && orders.length > 0 ? 'เพิ่มออเดอร์ถัดไป' : 'Order ID'}
              </p>
              {!orderIdReq && (
                <span style={{ fontSize: 10, color: 'var(--ink-faint)', letterSpacing: '0.04em', fontWeight: 600 }}>ไม่จำเป็น</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="field" type="text" placeholder="เช่น 250123456789"
                value={orderSn}
                onChange={e => {
                  setOrderSn(e.target.value)
                  if (verifyStatus !== 'idle') { setVerifyStatus('idle'); setVerifiedData(null) }
                  if (orderSearchStatus !== 'idle') { setOrderSearchStatus('idle'); setOrderSearchMsg('') }
                }}
                onKeyDown={e => {
                  if (e.key !== 'Enter') return
                  if (lookupOnOrder) verifyOrder()
                  else if (lookupOnSerial && orderSn.trim()) searchStoreOrder()
                }}
                style={{ flex: 1 }} />
              {lookupOnOrder && (
                <button onClick={verifyOrder} disabled={verifyStatus === 'loading' || !orderSn.trim()}
                  className="btn btn-ink tap-down" style={{ padding: '0 18px' }}>
                  {verifyStatus === 'loading' ? <Loader2 size={16} className="spinner" /> : <Search size={16} />}
                </button>
              )}
              {/* หน้าร้าน: ค้นด้วย Order ID → ดึงซีเรียลมาให้ */}
              {lookupOnSerial && (
                <button onClick={searchStoreOrder} disabled={orderSearchStatus === 'loading' || !orderSn.trim()}
                  className="btn btn-ink tap-down" style={{ padding: '0 18px' }} title="ค้นออเดอร์เพื่อดึงซีเรียล">
                  {orderSearchStatus === 'loading' ? <Loader2 size={16} className="spinner" /> : <Search size={16} />}
                </button>
              )}
            </div>

            {lookupOnSerial && (
              <p style={{ fontSize: 10.5, color: 'var(--ink-mute)', margin: '8px 0 0', lineHeight: 1.5 }}>
                มี Order ID? กด <strong>ค้นหา</strong> เพื่อดึง Serial Number ทั้งหมดของออเดอร์มาให้อัตโนมัติ
              </p>
            )}
            {lookupOnSerial && orderSearchMsg && (
              <div style={{
                marginTop: 10, padding: '10px 12px', borderRadius: 'var(--r-md)',
                background: orderSearchStatus === 'error' ? 'var(--red-soft)' : 'var(--green-soft)',
                border: `1px solid ${orderSearchStatus === 'error' ? 'rgba(139,58,58,0.18)' : 'rgba(64,107,63,0.18)'}`,
              }}>
                <p style={{ margin: 0, fontSize: 11.5, fontWeight: 600, color: orderSearchStatus === 'error' ? 'var(--red)' : 'var(--green)' }}>
                  {orderSearchStatus !== 'error' && '✓ '}{orderSearchMsg}
                </p>
              </div>
            )}

            {lookupOnOrder && renderVerifyResult()}
          </div>
        )}

        {/* ── Serial Number ── */}
        {showSnCard && (
          <div className="surface" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <p className="kicker" style={{ margin: 0 }}>
                Serial Number (SN){!lookupOnSerial && serialList.length > 0 ? ` · ${serialList.length}` : ''}
              </p>
              <span style={{
                fontSize: 10, letterSpacing: '0.04em', fontWeight: snReq ? 700 : 600,
                color: snReq ? 'var(--red)' : 'var(--ink-faint)',
              }}>
                {snReq ? 'จำเป็น' : 'ไม่จำเป็น'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="field" type="text" placeholder="เช่น SN-ABCD1234567"
                value={serialNumber}
                onChange={e => { setSerialNumber(e.target.value.toUpperCase()); if (lookupOnSerial && verifyStatus !== 'idle') { setVerifyStatus('idle'); setVerifiedData(null) } }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); lookupOnSerial ? verifyOrder() : addSerial() } }}
                autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={50}
                style={{ flex: 1, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}
              />
              {lookupOnSerial ? (
                <button onClick={verifyOrder} disabled={verifyStatus === 'loading' || !serialNumber.trim()}
                  className="btn btn-ink tap-down" style={{ padding: '0 18px' }}>
                  {verifyStatus === 'loading' ? <Loader2 size={16} className="spinner" /> : <Search size={16} />}
                </button>
              ) : (
                <button onClick={addSerial} disabled={!serialNumber.trim()}
                  className="btn btn-ink tap-down" style={{ padding: '0 16px' }} title="เพิ่ม SN">
                  <Plus size={16} />
                </button>
              )}
            </div>

            {/* Added SNs (order-based: 1 order → many SNs) */}
            {!lookupOnSerial && serialList.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {serialList.map(s => (
                  <span key={s} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '5px 8px 5px 10px', background: 'var(--bg-soft)',
                    border: '1px solid var(--hair)', borderRadius: 'var(--r-pill)',
                    fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--ink)',
                  }}>
                    {s}
                    <button onClick={() => removeSerial(s)} className="tap-down" style={{
                      width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                      background: '#fff', border: '1px solid var(--line)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--red)', cursor: 'pointer', padding: 0,
                    }}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <p style={{ fontSize: 10.5, color: 'var(--ink-mute)', margin: '8px 0 0', lineHeight: 1.5 }}>
              {lookupOnSerial
                ? <>เลขเครื่องด้านล่าง/หลังกล่องสินค้า — กด <strong>ค้นหา</strong> เพื่อดึงข้อมูลสินค้า (ถ้ามีในระบบ)</>
                : <>เลขเครื่องด้านล่าง/หลังกล่องสินค้า — <strong>1 ออเดอร์ใส่ได้หลาย SN</strong> (กด + เพื่อเพิ่มทีละตัว)</>}
            </p>
            {lookupOnSerial && renderVerifyResult()}

            {/* หน้าร้าน: เพิ่มซีเรียลถัดไป (ใช้ใบเสร็จใบเดียวร่วมกัน) */}
            {lookupOnSerial && currentValid() && (
              <button onClick={addAnother} className="btn btn-ghost tap-down"
                style={{ marginTop: 12, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Plus size={16} /> เพิ่มซีเรียลนี้ แล้วกรอกตัวถัดไป
              </button>
            )}
          </div>
        )}

        {/* ── Receipt (หน้าร้าน — REQUIRED, ใช้ร่วมทุกซีเรียล) ── */}
        {showReceipt && (
          <div className="surface" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <p className="kicker" style={{ margin: 0 }}>
                Receipt · ใบเสร็จ{previewUrls.length > 0 ? ` (${previewUrls.length})` : ''}{lookupOnSerial && orders.length > 0 ? ' · ใช้ร่วมทุกซีเรียล' : ''}
              </p>
              <span style={{
                fontSize: 10, letterSpacing: '0.04em', fontWeight: receiptReq ? 700 : 600,
                color: receiptReq ? 'var(--red)' : 'var(--ink-faint)',
              }}>
                {receiptReq ? 'จำเป็น' : 'ไม่จำเป็น'}
              </span>
            </div>

            {previewUrls.length === 0 ? (
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
                  กดเพื่อเลือกรูปใบเสร็จ (เลือกได้หลายรูป)
                </p>
                <p className="serif-i" style={{ fontSize: 11, color: 'var(--ink-mute)', margin: 0 }}>
                  JPG · PNG · PDF · ไม่เกิน 10MB/รูป
                </p>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: 8 }}>
                  {previewUrls.map((url, i) => (
                    <div key={url} style={{ position: 'relative', aspectRatio: '1', borderRadius: 'var(--r-md)', overflow: 'hidden', border: '1px solid var(--hair)', background: 'var(--bg-soft)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`receipt ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button onClick={() => removeReceipt(i)} className="tap-down" style={{
                        position: 'absolute', top: 4, right: 4,
                        width: 24, height: 24, borderRadius: '50%',
                        background: 'rgba(10,9,7,0.85)', border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', backdropFilter: 'blur(8px)',
                      }}>
                        <X size={12} color="#fff" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => fileRef.current?.click()} className="tap-down" style={{
                    aspectRatio: '1', borderRadius: 'var(--r-md)', border: '2px dashed var(--line)',
                    background: 'var(--bg-soft)', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', color: 'var(--gold-deep)',
                  }}>
                    <Plus size={20} />
                    <span style={{ fontSize: 10.5, fontWeight: 600 }}>เพิ่มรูป</span>
                  </button>
                </div>
                <p style={{ fontSize: 10.5, color: 'var(--ink-mute)', margin: '8px 0 0' }}>
                  แนบได้หลายรูป (เช่น ใบเสร็จยาว/หลายหน้า) — ใช้กับทุกรายการที่ลงทะเบียนครั้งนี้
                </p>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*,.pdf" multiple style={{ display: 'none' }} onChange={handleFile} />
          </div>
        )}

        {/* ── Add-another (online multi-order; หน้าร้าน ใช้ปุ่มในการ์ด SN แทน) ── */}
        {!lookupOnSerial && currentValid() && (
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

        {/* หน้าร้าน: เตือนแนบใบเสร็จเมื่อมีซีเรียลแล้วแต่ยังไม่แนบ */}
        {receiptMissing && totalEntries > 0 && (
          <p style={{ fontSize: 12, color: 'var(--red)', margin: '0 0 -4px', textAlign: 'center' }}>
            ⚠️ แนบใบเสร็จก่อนยืนยัน (ใช้ใบเดียวกับทุกซีเรียล)
          </p>
        )}

        {/* ── Submit ── */}
        <button onClick={submitAll} disabled={submitting || !canSubmit}
          className="btn btn-ink tap-down">
          {submitting
            ? <><Loader2 size={14} className="spinner" /> กำลังบันทึก...</>
            : `ยืนยัน${totalEntries > 1 ? ` ${totalEntries} รายการ` : ''} ✓`}
        </button>
      </div>
    </div>
  )
}
