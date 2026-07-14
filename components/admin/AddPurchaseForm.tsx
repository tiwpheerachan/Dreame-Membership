'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, CheckCircle, Upload } from 'lucide-react'
import PlatformLogo from './PlatformLogo'

interface Props {
  userId: string
  userName: string
}

const CHANNELS = [
  { value: 'SHOPEE',  label: 'Shopee',     type: 'ONLINE' },
  { value: 'LAZADA',  label: 'Lazada',     type: 'ONLINE' },
  { value: 'WEBSITE', label: 'Website',    type: 'ONLINE' },
  { value: 'TIKTOK',  label: 'TikTok',     type: 'ONLINE' },
  { value: 'BRANDSHOP', label: 'Brand Shop', type: 'ONSITE' },
  { value: 'STORE',   label: 'หน้าร้าน',   type: 'ONSITE' },
]

const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--admin-ink-mute)', marginBottom: 4 } as const

export default function AddPurchaseForm({ userId, userName }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [receipt, setReceipt] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [form, setForm] = useState({
    order_sn: '', invoice_no: '', channel: 'STORE',
    model_name: '', sku: '', serial_number: '',
    purchase_date: new Date().toISOString().split('T')[0],
    total_amount: '', warranty_months: '24', admin_note: '',
  })

  const selectedChannel = CHANNELS.find(c => c.value === form.channel)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setReceipt(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  function reset() {
    setForm({
      order_sn: '', invoice_no: '', channel: 'STORE',
      model_name: '', sku: '', serial_number: '',
      purchase_date: new Date().toISOString().split('T')[0],
      total_amount: '', warranty_months: '24', admin_note: '',
    })
    setReceipt(null); setPreviewUrl(null); setDone(false)
  }

  async function submit() {
    if (!form.order_sn || !form.model_name || !form.serial_number) return
    setLoading(true)
    const fd = new FormData()
    fd.append('user_id', userId)
    Object.entries(form).forEach(([k, v]) => fd.append(k, v))
    fd.append('channel_type', selectedChannel?.type || 'ONSITE')
    if (receipt) fd.append('receipt', receipt)
    const res = await fetch('/api/admin/purchases', { method: 'POST', body: fd })
    setLoading(false)
    if (res.ok) {
      setDone(true)
      setTimeout(() => {
        setOpen(false); reset()
        router.refresh()
      }, 1400)
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="admin-btn admin-btn-gold">
        <Plus size={16} /> เพิ่มประวัติการซื้อ
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
          style={{ background: 'rgba(14,14,14,0.45)', backdropFilter: 'blur(6px)' }}>
          <div className="admin-card w-full max-w-lg my-8" style={{ padding: 0 }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid var(--admin-border)' }}>
              <div>
                <h2 className="font-bold" style={{ color: 'var(--admin-ink)' }}>เพิ่มประวัติการซื้อ</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--admin-ink-mute)' }}>
                  สำหรับ {userName}
                </p>
              </div>
              <button onClick={() => { setOpen(false); reset() }}
                className="transition-colors p-1.5 rounded-lg"
                style={{ color: 'var(--admin-ink-faint)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--admin-ink)'; e.currentTarget.style.background = 'var(--admin-bg)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--admin-ink-faint)'; e.currentTarget.style.background = 'transparent' }}>
                <X size={18} />
              </button>
            </div>

            {done ? (
              <div className="p-8 text-center">
                <CheckCircle size={48} style={{ color: '#3A8E5A' }} className="mx-auto mb-3" />
                <p className="font-semibold" style={{ color: 'var(--admin-ink)' }}>เพิ่มประวัติสำเร็จ!</p>
                <p className="text-sm mt-1" style={{ color: 'var(--admin-ink-mute)' }}>
                  คะแนนถูกเพิ่มให้ลูกค้าแล้ว
                </p>
              </div>
            ) : (
              <div className="p-5 space-y-4">

                {/* Channel */}
                <div>
                  <label style={labelStyle}>ช่องทางการซื้อ</label>
                  <div className="grid grid-cols-3 gap-2">
                    {CHANNELS.map(c => {
                      const active = form.channel === c.value
                      return (
                        <button key={c.value} onClick={() => setForm(f => ({ ...f, channel: c.value }))}
                          className="py-2 px-2 rounded-lg text-xs text-left transition-colors flex items-center gap-2"
                          style={{
                            background: active ? 'rgba(201,155,62,0.12)' : 'var(--admin-card)',
                            border: `1px solid ${active ? 'var(--admin-gold)' : 'var(--admin-border)'}`,
                            color: active ? 'var(--admin-gold-deep)' : 'var(--admin-ink-mute)',
                            fontWeight: active ? 600 : 400,
                          }}>
                          <PlatformLogo channel={c.value} size={16} />
                          {c.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Order SN + Invoice */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>Order ID <span style={{ color: '#B14242' }}>*</span></label>
                    <input type="text" placeholder="เลขออเดอร์" value={form.order_sn}
                      onChange={e => setForm(f => ({ ...f, order_sn: e.target.value }))}
                      className="admin-field" />
                  </div>
                  <div>
                    <label style={labelStyle}>Invoice No.</label>
                    <input type="text" placeholder="เลขใบเสร็จ" value={form.invoice_no}
                      onChange={e => setForm(f => ({ ...f, invoice_no: e.target.value }))}
                      className="admin-field" />
                  </div>
                </div>

                {/* Model + SKU */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>ชื่อสินค้า / Model <span style={{ color: '#B14242' }}>*</span></label>
                    <input type="text" placeholder="เช่น Dreame D10s Pro" value={form.model_name}
                      onChange={e => setForm(f => ({ ...f, model_name: e.target.value }))}
                      className="admin-field" />
                  </div>
                  <div>
                    <label style={labelStyle}>SKU</label>
                    <input type="text" placeholder="เช่น RLS3D" value={form.sku}
                      onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                      className="admin-field" />
                  </div>
                </div>

                {/* Serial */}
                <div>
                  <label style={labelStyle}>Serial Number <span style={{ color: '#B14242' }}>*</span></label>
                  <input type="text" placeholder="Serial Number จากตัวเครื่อง" value={form.serial_number}
                    onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))}
                    className="admin-field" style={{ fontFamily: 'var(--font-mono)' }} />
                </div>

                {/* Date / Amount / Warranty */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label style={labelStyle}>วันที่ซื้อ</label>
                    <input type="date" value={form.purchase_date}
                      onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))}
                      className="admin-field" />
                  </div>
                  <div>
                    <label style={labelStyle}>ยอดรวม (฿)</label>
                    <input type="number" placeholder="0" value={form.total_amount}
                      onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))}
                      className="admin-field" />
                  </div>
                  <div>
                    <label style={labelStyle}>ประกัน (เดือน)</label>
                    <select value={form.warranty_months}
                      onChange={e => setForm(f => ({ ...f, warranty_months: e.target.value }))}
                      className="admin-field">
                      <option value="3">3 เดือน</option>
                      <option value="6">6 เดือน</option>
                      <option value="12">12 เดือน</option>
                      <option value="24">24 เดือน</option>
                    </select>
                  </div>
                </div>

                {/* Receipt upload */}
                <div>
                  <label style={labelStyle}>รูปใบเสร็จ (ถ้ามี)</label>
                  {!previewUrl ? (
                    <label className="block w-full rounded-xl p-4 text-center cursor-pointer transition-colors group"
                      style={{ border: '2px dashed var(--admin-border)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--admin-gold)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--admin-border)' }}>
                      <Upload size={20} style={{ color: 'var(--admin-ink-faint)' }} className="mx-auto mb-1" />
                      <p className="text-xs" style={{ color: 'var(--admin-ink-mute)' }}>คลิกเพื่อเลือกไฟล์</p>
                      <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />
                    </label>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden" style={{ border: '1px solid var(--admin-border)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewUrl} alt="receipt" className="w-full h-32 object-cover" />
                      <button onClick={() => { setReceipt(null); setPreviewUrl(null) }}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(14,14,14,0.7)' }}>
                        <X size={12} style={{ color: '#fff' }} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Note */}
                <div>
                  <label style={labelStyle}>หมายเหตุ (Admin)</label>
                  <textarea placeholder="บันทึกข้อมูลเพิ่มเติม" value={form.admin_note}
                    onChange={e => setForm(f => ({ ...f, admin_note: e.target.value }))}
                    rows={2} className="admin-field resize-none" />
                </div>

                {/* Points preview */}
                {form.total_amount && Number(form.total_amount) > 0 && (
                  <div className="rounded-lg px-4 py-2.5 flex items-center justify-between"
                    style={{ background: 'rgba(201,155,62,0.10)', border: '1px solid rgba(201,155,62,0.22)' }}>
                    <span className="text-xs" style={{ color: 'var(--admin-ink-mute)' }}>
                      คะแนนที่จะได้รับ (ประมาณ)
                    </span>
                    <span className="font-bold text-sm" style={{ color: 'var(--admin-gold-deep)' }}>
                      +{Math.floor(Number(form.total_amount) / 100)} แต้ม
                    </span>
                  </div>
                )}

                <p className="text-xs" style={{ color: 'var(--admin-ink-faint)' }}>
                  <span style={{ color: '#B14242' }}>*</span> จำเป็นต้องกรอก
                </p>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setOpen(false); reset() }} className="admin-btn admin-btn-ghost flex-1">
                    ยกเลิก
                  </button>
                  <button onClick={submit}
                    disabled={loading || !form.order_sn || !form.model_name || !form.serial_number}
                    className="admin-btn admin-btn-gold flex-1">
                    {loading
                      ? <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 rounded-full animate-spin"
                            style={{ border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff' }} />
                          กำลังบันทึก…
                        </span>
                      : 'บันทึก'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
