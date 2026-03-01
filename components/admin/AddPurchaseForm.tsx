'use client'
import { useState } from 'react'
import { Plus, X, CheckCircle, Upload } from 'lucide-react'

interface Props {
  userId: string
  userName: string
}

const CHANNELS = [
  { value: 'SHOPEE',  label: '🛍️ Shopee',   type: 'ONLINE' },
  { value: 'LAZADA',  label: '🛒 Lazada',    type: 'ONLINE' },
  { value: 'WEBSITE', label: '🌐 Website',   type: 'ONLINE' },
  { value: 'TIKTOK',  label: '🎵 TikTok',   type: 'ONLINE' },
  { value: 'STORE',   label: '🏪 หน้าร้าน', type: 'ONSITE' },
]

export default function AddPurchaseForm({ userId, userName }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [receipt, setReceipt] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [form, setForm] = useState({
    order_sn:      '',
    invoice_no:    '',
    channel:       'STORE',
    model_name:    '',
    sku:           '',
    serial_number: '',
    purchase_date: new Date().toISOString().split('T')[0],
    total_amount:  '',
    warranty_months: '12',
    admin_note:    '',
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
      total_amount: '', warranty_months: '12', admin_note: '',
    })
    setReceipt(null)
    setPreviewUrl(null)
    setDone(false)
  }

  async function submit() {
    if (!form.order_sn || !form.model_name || !form.serial_number) return
    setLoading(true)

    const fd = new FormData()
    fd.append('user_id',         userId)
    fd.append('order_sn',        form.order_sn)
    fd.append('invoice_no',      form.invoice_no)
    fd.append('channel',         form.channel)
    fd.append('channel_type',    selectedChannel?.type || 'ONSITE')
    fd.append('model_name',      form.model_name)
    fd.append('sku',             form.sku)
    fd.append('serial_number',   form.serial_number)
    fd.append('purchase_date',   form.purchase_date)
    fd.append('total_amount',    form.total_amount || '0')
    fd.append('warranty_months', form.warranty_months)
    fd.append('admin_note',      form.admin_note)
    if (receipt) fd.append('receipt', receipt)

    const res = await fetch('/api/admin/purchases', { method: 'POST', body: fd })
    setLoading(false)

    if (res.ok) {
      setDone(true)
      setTimeout(() => {
        setOpen(false)
        reset()
        window.location.reload()
      }, 1800)
    }
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-gray-900 font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
      >
        <Plus size={16} /> เพิ่มประวัติการซื้อ
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg my-8 shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div>
                <h2 className="text-white font-bold">เพิ่มประวัติการซื้อ</h2>
                <p className="text-gray-400 text-xs mt-0.5">สำหรับ {userName}</p>
              </div>
              <button onClick={() => { setOpen(false); reset() }}
                className="text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Success state */}
            {done ? (
              <div className="p-8 text-center">
                <CheckCircle size={48} className="text-green-400 mx-auto mb-3" />
                <p className="text-white font-semibold">เพิ่มประวัติสำเร็จ!</p>
                <p className="text-gray-400 text-sm mt-1">คะแนนถูกเพิ่มให้ลูกค้าแล้ว</p>
              </div>
            ) : (
              <div className="p-5 space-y-4">

                {/* Channel */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">ช่องทางการซื้อ</label>
                  <div className="grid grid-cols-3 gap-2">
                    {CHANNELS.map(c => (
                      <button key={c.value} onClick={() => setForm(f => ({ ...f, channel: c.value }))}
                        className={`py-2 px-2 rounded-lg text-xs text-left transition-colors border ${
                          form.channel === c.value
                            ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                        }`}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Order SN + Invoice */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Order ID <span className="text-red-400">*</span>
                    </label>
                    <input type="text" placeholder="เลขออเดอร์"
                      value={form.order_sn}
                      onChange={e => setForm(f => ({ ...f, order_sn: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Invoice No.</label>
                    <input type="text" placeholder="เลขใบเสร็จ"
                      value={form.invoice_no}
                      onChange={e => setForm(f => ({ ...f, invoice_no: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                    />
                  </div>
                </div>

                {/* Model + SKU */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      ชื่อสินค้า / Model <span className="text-red-400">*</span>
                    </label>
                    <input type="text" placeholder="เช่น Dreame D10s Pro"
                      value={form.model_name}
                      onChange={e => setForm(f => ({ ...f, model_name: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">SKU</label>
                    <input type="text" placeholder="เช่น RLS3D"
                      value={form.sku}
                      onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                    />
                  </div>
                </div>

                {/* Serial Number */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Serial Number <span className="text-red-400">*</span>
                  </label>
                  <input type="text" placeholder="Serial Number จากตัวเครื่อง"
                    value={form.serial_number}
                    onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600 font-mono"
                  />
                </div>

                {/* Date + Amount + Warranty */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">วันที่ซื้อ</label>
                    <input type="date"
                      value={form.purchase_date}
                      onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">ยอดรวม (฿)</label>
                    <input type="number" placeholder="0"
                      value={form.total_amount}
                      onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">ประกัน (เดือน)</label>
                    <select value={form.warranty_months}
                      onChange={e => setForm(f => ({ ...f, warranty_months: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500">
                      <option value="3">3 เดือน</option>
                      <option value="6">6 เดือน</option>
                      <option value="12">12 เดือน</option>
                      <option value="24">24 เดือน</option>
                    </select>
                  </div>
                </div>

                {/* Receipt upload */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">รูปใบเสร็จ (ถ้ามี)</label>
                  {!previewUrl ? (
                    <label className="block w-full border-2 border-dashed border-gray-700 hover:border-amber-500 rounded-xl p-4 text-center cursor-pointer transition-colors group">
                      <Upload size={20} className="text-gray-600 group-hover:text-amber-500 mx-auto mb-1 transition-colors" />
                      <p className="text-gray-500 text-xs">คลิกเพื่อเลือกไฟล์</p>
                      <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />
                    </label>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden border border-gray-700">
                      <img src={previewUrl} alt="receipt" className="w-full h-32 object-cover" />
                      <button onClick={() => { setReceipt(null); setPreviewUrl(null) }}
                        className="absolute top-2 right-2 w-6 h-6 bg-gray-900/80 rounded-full flex items-center justify-center">
                        <X size={12} className="text-white" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Admin note */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">หมายเหตุ (Admin)</label>
                  <textarea placeholder="บันทึกข้อมูลเพิ่มเติม เช่น ตรวจสอบจากใบเสร็จหน้าร้าน"
                    value={form.admin_note}
                    onChange={e => setForm(f => ({ ...f, admin_note: e.target.value }))}
                    rows={2}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600 resize-none"
                  />
                </div>

                {/* Points preview */}
                {form.total_amount && Number(form.total_amount) > 0 && (
                  <div className="bg-amber-900/20 border border-amber-800/40 rounded-lg px-4 py-2.5 flex items-center justify-between">
                    <span className="text-gray-400 text-xs">คะแนนที่จะได้รับ (ประมาณ)</span>
                    <span className="text-amber-400 font-bold text-sm">
                      +{Math.floor(Number(form.total_amount) / 100)} แต้ม
                    </span>
                  </div>
                )}

                {/* Required fields note */}
                <p className="text-gray-600 text-xs"><span className="text-red-400">*</span> จำเป็นต้องกรอก</p>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setOpen(false); reset() }}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2.5 rounded-xl text-sm transition-colors">
                    ยกเลิก
                  </button>
                  <button
                    onClick={submit}
                    disabled={loading || !form.order_sn || !form.model_name || !form.serial_number}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-gray-900 font-semibold py-2.5 rounded-xl text-sm transition-colors"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                        กำลังบันทึก...
                      </span>
                    ) : 'บันทึกประวัติ ✓'}
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
