'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, Upload, CheckCircle, Clock, X } from 'lucide-react'
import Link from 'next/link'

type Step = 'order' | 'details' | 'upload' | 'done'
type VerifyStatus = 'idle' | 'loading' | 'verified' | 'pending' | 'error'

const CHANNELS = [
  { value: 'SHOPEE', label: '🛍️ Shopee', type: 'ONLINE' },
  { value: 'LAZADA', label: '🛒 Lazada', type: 'ONLINE' },
  { value: 'WEBSITE', label: '🌐 Website', type: 'ONLINE' },
  { value: 'TIKTOK', label: '🎵 TikTok', type: 'ONLINE' },
  { value: 'STORE', label: '🏪 หน้าร้าน', type: 'ONSITE' },
]

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('order')
  const [orderSn, setOrderSn] = useState('')
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle')
  const [verifiedData, setVerifiedData] = useState<Record<string, unknown> | null>(null)
  const [channel, setChannel] = useState('SHOPEE')
  const [form, setForm] = useState({ serialNumber: '', invoiceNo: '', address: '' })
  const [receipt, setReceipt] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const selectedChannel = CHANNELS.find(c => c.value === channel)

  async function verifyOrder() {
    if (!orderSn.trim()) return
    setVerifyStatus('loading')
    try {
      const res = await fetch('/api/purchases/verify-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_sn: orderSn, channel }),
      })
      const data = await res.json()
      if (data.status === 'VERIFIED') {
        setVerifiedData(data.order)
        setVerifyStatus('verified')
      } else if (data.status === 'PENDING') {
        setVerifyStatus('pending')
      } else {
        setVerifyStatus('error')
      }
    } catch {
      setVerifyStatus('error')
    }
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
      fd.append('serial_number', form.serialNumber)
      fd.append('invoice_no', form.invoiceNo)
      fd.append('address', form.address)
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

  if (step === 'done') return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <CheckCircle size={64} className="text-green-400 mb-4" />
      <h2 className="text-white text-xl font-bold mb-2">ลงทะเบียนสำเร็จ!</h2>
      <p className="text-gray-400 text-sm mb-6">
        {verifyStatus === 'verified'
          ? 'ยืนยันสินค้าเรียบร้อย คะแนนจะถูกเพิ่มภายใน 24 ชั่วโมง'
          : 'รับข้อมูลแล้ว กำลังตรวจสอบ อาจใช้เวลาสูงสุด 6 ชั่วโมง'}
      </p>
      <button onClick={() => router.push('/purchases')} className="bg-amber-500 text-gray-900 px-8 py-3 rounded-xl font-semibold">
        ดูประวัติสินค้า
      </button>
    </div>
  )

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 pt-4">
        <Link href="/purchases"><ArrowLeft size={20} className="text-gray-400" /></Link>
        <h1 className="text-white text-xl font-bold">ลงทะเบียนสินค้า</h1>
      </div>

      {/* Progress */}
      <div className="flex gap-1">
        {['order','details','upload'].map((s,i) => (
          <div key={s} className={`flex-1 h-1 rounded-full ${['order','details','upload'].indexOf(step) >= i ? 'bg-amber-500' : 'bg-gray-800'}`} />
        ))}
      </div>

      {/* Step 1: Order verification */}
      {step === 'order' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">ช่องทางการซื้อ</label>
            <div className="grid grid-cols-2 gap-2">
              {CHANNELS.map(c => (
                <button key={c.value} onClick={() => setChannel(c.value)}
                  className={`py-2.5 px-3 rounded-lg text-sm text-left transition-colors border ${channel === c.value ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Order ID / หมายเลขคำสั่งซื้อ</label>
            <div className="flex gap-2">
              <input type="text" placeholder="เช่น 250123456789" value={orderSn} onChange={e => setOrderSn(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && verifyOrder()}
                className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 text-sm font-mono" />
              <button onClick={verifyOrder} disabled={verifyStatus === 'loading' || !orderSn.trim()}
                className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-900 px-4 rounded-lg font-semibold">
                <Search size={18} />
              </button>
            </div>
          </div>

          {/* Verification result */}
          {verifyStatus === 'loading' && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center text-gray-400 text-sm">
              <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              กำลังตรวจสอบในระบบ...
            </div>
          )}
          {verifyStatus === 'verified' && verifiedData && (
            <div className="bg-green-900/20 border border-green-800/50 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-green-400 font-semibold text-sm">
                <CheckCircle size={16} /> ตรวจสอบสำเร็จ
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-gray-300"><span className="text-gray-500">Platform: </span>{verifiedData.platform as string}</p>
                <p className="text-gray-300"><span className="text-gray-500">ยอดรวม: </span>฿{Number(verifiedData.total_amount).toLocaleString()}</p>
                {Array.isArray(verifiedData.items) && (verifiedData.items as Record<string, unknown>[]).slice(0,2).map((item, i) => (
                  <p key={i} className="text-gray-300"><span className="text-gray-500">สินค้า: </span>{item.item_name as string}</p>
                ))}
              </div>
            </div>
          )}
          {verifyStatus === 'pending' && (
            <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-xl p-4 flex items-start gap-3">
              <Clock size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-yellow-400 font-medium">ยังไม่พบข้อมูลใน BigQuery</p>
                <p className="text-gray-400 mt-1">ออเดอร์อาจยังไม่ sync ระบบจะตรวจสอบอัตโนมัติทุก 1 ชั่วโมง คุณยังสามารถลงทะเบียนต่อได้</p>
              </div>
            </div>
          )}
          {verifyStatus === 'error' && (
            <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-4">
              <p className="text-red-400 text-sm">ไม่พบ Order ID นี้ กรุณาตรวจสอบอีกครั้ง</p>
            </div>
          )}

          {(verifyStatus === 'verified' || verifyStatus === 'pending') && (
            <button onClick={() => setStep('details')} className="w-full bg-amber-500 hover:bg-amber-400 text-gray-900 font-semibold py-3 rounded-xl">
              ถัดไป →
            </button>
          )}
        </div>
      )}

      {/* Step 2: Details */}
      {step === 'details' && (
        <div className="space-y-4">
          <h2 className="text-white font-semibold">ข้อมูลสินค้า</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Serial Number <span className="text-red-400">*</span></label>
              <input type="text" placeholder="กรอก Serial Number จากตัวเครื่อง"
                value={form.serialNumber} onChange={e => setForm(f => ({...f, serialNumber: e.target.value}))}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Invoice No. (ถ้ามี)</label>
              <input type="text" placeholder="เลขที่ใบเสร็จ/ใบกำกับ"
                value={form.invoiceNo} onChange={e => setForm(f => ({...f, invoiceNo: e.target.value}))}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">ที่อยู่สำหรับจัดส่ง (ถ้าแตกต่างจาก Profile)</label>
              <textarea placeholder="บ้านเลขที่ ถนน แขวง เขต จังหวัด รหัสไปรษณีย์"
                value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))}
                rows={3}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 text-sm resize-none" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep('order')} className="flex-1 bg-gray-800 text-gray-300 py-3 rounded-xl font-medium">← กลับ</button>
            <button onClick={() => setStep('upload')} disabled={!form.serialNumber.trim()}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-900 font-semibold py-3 rounded-xl">ถัดไป →</button>
          </div>
        </div>
      )}

      {/* Step 3: Upload */}
      {step === 'upload' && (
        <div className="space-y-4">
          <h2 className="text-white font-semibold">อัพโหลดใบเสร็จ</h2>

          {!previewUrl ? (
            <button onClick={() => fileRef.current?.click()}
              className="w-full bg-gray-900 border-2 border-dashed border-gray-700 hover:border-amber-500 rounded-xl p-8 text-center transition-colors group">
              <Upload size={32} className="text-gray-600 group-hover:text-amber-500 mx-auto mb-3 transition-colors" />
              <p className="text-gray-400 text-sm">กดเพื่อเลือกรูปใบเสร็จ</p>
              <p className="text-gray-600 text-xs mt-1">JPG, PNG, PDF • ไม่เกิน 10MB</p>
            </button>
          ) : (
            <div className="relative rounded-xl overflow-hidden">
              <img src={previewUrl} alt="receipt" className="w-full object-contain max-h-64" />
              <button onClick={() => { setReceipt(null); setPreviewUrl(null) }}
                className="absolute top-2 right-2 w-7 h-7 bg-gray-900/80 rounded-full flex items-center justify-center">
                <X size={14} className="text-white" />
              </button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />

          {error && <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3">
            <button onClick={() => setStep('details')} className="flex-1 bg-gray-800 text-gray-300 py-3 rounded-xl font-medium">← กลับ</button>
            <button onClick={submit} disabled={submitting}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-900 font-semibold py-3 rounded-xl">
              {submitting ? 'กำลังบันทึก...' : 'ยืนยัน ✓'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
