'use client'
import { useState, useEffect } from 'react'
import { Tag, Plus, X } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Coupon {
  id: string; code: string; title: string; discount_type: string;
  discount_value: number; valid_until: string; used_at?: string;
  users?: { full_name: string; member_id: string }
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    user_id: '', title: '', discount_type: 'PERCENT',
    discount_value: '', valid_until: '', description: '', min_purchase: '0',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function loadCoupons() {
    const res = await fetch('/api/admin/coupons')
    const data = await res.json()
    setCoupons(data.coupons || [])
    setLoading(false)
  }

  useEffect(() => { loadCoupons() }, [])

  async function createCoupon() {
    setSaving(true); setMsg('')
    const res = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (res.ok) {
      setMsg('สร้างคูปองสำเร็จ')
      setShowForm(false)
      loadCoupons()
    } else {
      setMsg(data.error || 'เกิดข้อผิดพลาด')
    }
    setSaving(false)
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">คูปอง & โปรโมชั่น</h1>
          <p className="text-gray-400 text-sm">{coupons.length} คูปอง</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-gray-900 px-4 py-2.5 rounded-lg font-semibold text-sm">
          <Plus size={16} /> สร้างคูปอง
        </button>
      </div>

      {/* Create form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold">สร้างคูปองใหม่</h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-gray-400" /></button>
            </div>

            {[
              { key: 'user_id', label: 'User ID (ว่าง = ส่งทุกคน)', ph: 'uuid ของ user หรือเว้นว่าง' },
              { key: 'title', label: 'ชื่อคูปอง', ph: 'เช่น ส่วนลดต้อนรับสมาชิกใหม่' },
              { key: 'description', label: 'รายละเอียด', ph: '' },
            ].map(({ key, label, ph }) => (
              <div key={key}>
                <label className="block text-sm text-gray-400 mb-1">{label}</label>
                <input type="text" placeholder={ph} value={form[key as keyof typeof form]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
            ))}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">ประเภท</label>
                <select value={form.discount_type} onChange={e => setForm(f => ({...f, discount_type: e.target.value}))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="PERCENT">เปอร์เซ็นต์ (%)</option>
                  <option value="FIXED">จำนวนเงิน (฿)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">ส่วนลด</label>
                <input type="number" placeholder="10" value={form.discount_value}
                  onChange={e => setForm(f => ({...f, discount_value: e.target.value}))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">ยอดขั้นต่ำ (฿)</label>
                <input type="number" value={form.min_purchase}
                  onChange={e => setForm(f => ({...f, min_purchase: e.target.value}))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">หมดอายุ</label>
                <input type="date" value={form.valid_until}
                  onChange={e => setForm(f => ({...f, valid_until: e.target.value}))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
            </div>

            {msg && <p className={`text-sm text-center ${msg.includes('สำเร็จ') ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>}

            <button onClick={createCoupon} disabled={saving || !form.title || !form.discount_value || !form.valid_until}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-900 font-semibold py-3 rounded-xl text-sm">
              {saving ? 'กำลังสร้าง...' : 'สร้างคูปอง'}
            </button>
          </div>
        </div>
      )}

      {/* Coupons table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/70">
              {['Code', 'ชื่อ', 'ส่วนลด', 'สมาชิก', 'หมดอายุ', 'สถานะ'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-gray-400 font-medium text-xs">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {coupons.map((c: Coupon) => (
              <tr key={c.id} className="border-b border-gray-800/40 hover:bg-gray-800/30">
                <td className="px-4 py-3 font-mono text-amber-400 text-xs font-bold">{c.code}</td>
                <td className="px-4 py-3 text-gray-300">{c.title}</td>
                <td className="px-4 py-3 text-white font-semibold">
                  {c.discount_type === 'PERCENT' ? `${c.discount_value}%` : `฿${c.discount_value}`}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{c.users?.full_name || 'ทุกคน'}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(c.valid_until)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.used_at ? 'bg-gray-800 text-gray-500' : new Date(c.valid_until) < new Date() ? 'bg-red-900/20 text-red-400' : 'bg-green-900/20 text-green-400'}`}>
                    {c.used_at ? 'ใช้แล้ว' : new Date(c.valid_until) < new Date() ? 'หมดอายุ' : 'ใช้ได้'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {coupons.length === 0 && !loading && (
          <div className="py-12 text-center text-gray-500">ยังไม่มีคูปอง</div>
        )}
      </div>
    </div>
  )
}
