'use client'
import { useState, useEffect, useRef } from 'react'
import { Plus, X, Edit2, Trash2, Image as ImageIcon, ExternalLink, Eye, EyeOff } from 'lucide-react'
import type { Promotion } from '@/types'
import { formatDate } from '@/lib/utils'

const LAYOUTS = [
  { value: 'hero', label: 'Hero Banner (full-width)' },
  { value: 'card', label: 'Card (carousel)' },
  { value: 'feed', label: 'Feed (vertical)' },
]

type FormState = {
  id?: string
  title: string
  description: string
  link_url: string
  original_price: string
  discounted_price: string
  discount_label: string
  badge_text: string
  sort_order: string
  layout: 'hero' | 'card' | 'feed'
  is_active: boolean
  show_on_home: boolean
  image_url: string
  image?: File | null
}

const empty: FormState = {
  title: '', description: '', link_url: '',
  original_price: '', discounted_price: '',
  discount_label: '', badge_text: '',
  sort_order: '0', layout: 'card',
  is_active: true, show_on_home: true,
  image_url: '', image: null,
}

export default function AdminPromotionsPage() {
  const [items, setItems] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(empty)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/promotions')
    const data = await res.json()
    setItems(data.promotions || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openCreate() {
    setForm(empty); setPreviewUrl(null); setShowForm(true); setMsg('')
  }
  function openEdit(p: Promotion) {
    setForm({
      id: p.id,
      title: p.title || '',
      description: p.description || '',
      link_url: p.link_url || '',
      original_price: p.original_price?.toString() || '',
      discounted_price: p.discounted_price?.toString() || '',
      discount_label: p.discount_label || '',
      badge_text: p.badge_text || '',
      sort_order: String(p.sort_order ?? 0),
      layout: p.layout,
      is_active: p.is_active,
      show_on_home: p.show_on_home ?? true,
      image_url: p.image_url || '',
    })
    setPreviewUrl(p.image_url || null)
    setShowForm(true); setMsg('')
  }

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setForm(s => ({ ...s, image: f }))
    setPreviewUrl(URL.createObjectURL(f))
  }

  async function save() {
    setSaving(true); setMsg('')
    const fd = new FormData()
    fd.append('title', form.title)
    fd.append('description', form.description)
    fd.append('link_url', form.link_url)
    fd.append('original_price', form.original_price)
    fd.append('discounted_price', form.discounted_price)
    fd.append('discount_label', form.discount_label)
    fd.append('badge_text', form.badge_text)
    fd.append('sort_order', form.sort_order)
    fd.append('layout', form.layout)
    fd.append('is_active', String(form.is_active))
    fd.append('show_on_home', String(form.show_on_home))
    if (form.image) fd.append('image', form.image)
    else if (form.image_url) fd.append('image_url', form.image_url)

    const url = form.id ? `/api/admin/promotions/${form.id}` : '/api/admin/promotions'
    const method = form.id ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, body: fd })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setMsg('บันทึกสำเร็จ')
      setTimeout(() => { setShowForm(false); load() }, 700)
    } else {
      setMsg(data.error || 'เกิดข้อผิดพลาด')
    }
  }

  async function toggleActive(p: Promotion) {
    await fetch(`/api/admin/promotions/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !p.is_active }),
    })
    load()
  }

  async function remove(id: string) {
    if (!confirm('ยืนยันการลบโปรโมชั่นนี้?')) return
    const res = await fetch(`/api/admin/promotions/${id}`, { method: 'DELETE' })
    if (res.ok) load()
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
        <div>
          <h1 className="admin-h1">โปรโมชั่น & โฆษณา</h1>
          <p className="admin-sub">{items.length} รายการ · จัดการแบนเนอร์ที่แสดงในหน้า home</p>
        </div>
        <button onClick={openCreate} className="admin-btn admin-btn-ink">
          <Plus size={14} /> สร้างโปรโมชั่น
        </button>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <p className="text-gray-500 text-sm">กำลังโหลด...</p>
        ) : items.length === 0 ? (
          <p className="text-gray-500 text-sm">ยังไม่มีโปรโมชั่น</p>
        ) : items.map(p => (
          <div key={p.id} className="admin-card rounded-xl overflow-hidden">
            <div className="flex">
              <div className="w-32 h-24 flex-shrink-0 bg-gray-800 relative">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600">
                    <ImageIcon size={20} />
                  </div>
                )}
                {p.badge_text && (
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-amber-500 text-gray-900 text-[9px] font-bold rounded">
                    {p.badge_text}
                  </span>
                )}
              </div>
              <div className="flex-1 p-3 min-w-0">
                <div className="flex items-start gap-2">
                  <p className="text-white font-semibold text-sm truncate flex-1">{p.title}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.is_active ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                    {p.is_active ? 'Active' : 'Off'}
                  </span>
                </div>
                <p className="text-gray-500 text-xs mt-0.5 truncate">
                  {p.layout.toUpperCase()} · sort {p.sort_order}
                </p>
                {p.discounted_price && (
                  <p className="text-amber-400 text-xs font-semibold mt-1">
                    {p.original_price && <span className="text-gray-600 line-through mr-1">฿{Number(p.original_price).toLocaleString()}</span>}
                    ฿{Number(p.discounted_price).toLocaleString()}
                  </p>
                )}
                <div className="flex items-center gap-1 mt-2">
                  <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => toggleActive(p)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded">
                    {p.is_active ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  {p.link_url && (
                    <a href={p.link_url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded">
                      <ExternalLink size={13} />
                    </a>
                  )}
                  <button onClick={() => remove(p.id)} className="p-1.5 text-red-400 hover:bg-red-900/20 rounded ml-auto">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-2xl space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold">{form.id ? 'แก้ไข' : 'สร้าง'}โปรโมชั่น</h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-gray-400" /></button>
            </div>

            {/* Image */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">รูปภาพ</label>
              {previewUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="" className="w-full h-40 object-cover" />
                  <button onClick={() => { setForm(s => ({...s, image: null, image_url: ''})); setPreviewUrl(null) }}
                    className="absolute top-2 right-2 w-7 h-7 bg-gray-900/80 rounded-full flex items-center justify-center">
                    <X size={14} className="text-white" />
                  </button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-700 hover:border-amber-500 rounded-xl p-8 flex flex-col items-center gap-2 text-gray-400 hover:text-amber-400">
                  <ImageIcon size={20} />
                  <span className="text-xs">คลิกเพื่อเลือกรูป</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />
            </div>

            {/* Title + description */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">ชื่อ <span className="text-red-400">*</span></label>
              <input type="text" value={form.title}
                onChange={e => setForm(s => ({...s, title: e.target.value}))}
                placeholder="เช่น Dreame X50 Ultra ลดสูงสุด 8,000 บาท"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">รายละเอียด</label>
              <textarea value={form.description}
                onChange={e => setForm(s => ({...s, description: e.target.value}))}
                rows={2}
                placeholder="คำอธิบายสั้น ๆ"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 resize-none" />
            </div>

            {/* Pricing row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">ราคาเดิม (฿)</label>
                <input type="number" value={form.original_price}
                  onChange={e => setForm(s => ({...s, original_price: e.target.value}))}
                  placeholder="40990"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">ราคาหลังลด (฿)</label>
                <input type="number" value={form.discounted_price}
                  onChange={e => setForm(s => ({...s, discounted_price: e.target.value}))}
                  placeholder="32990"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
            </div>

            {/* Labels row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Discount label</label>
                <input type="text" value={form.discount_label}
                  onChange={e => setForm(s => ({...s, discount_label: e.target.value}))}
                  placeholder="ลด 8,000 บาท"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Badge</label>
                <input type="text" value={form.badge_text}
                  onChange={e => setForm(s => ({...s, badge_text: e.target.value}))}
                  placeholder="HOT, BEST SELLING"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
            </div>

            {/* Link */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Link URL (ปลายทางเมื่อกดคลิก)</label>
              <input type="url" value={form.link_url}
                onChange={e => setForm(s => ({...s, link_url: e.target.value}))}
                placeholder="https://www.dreametech.com/products/..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
            </div>

            {/* Layout + sort + active */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1">รูปแบบการแสดง</label>
                <select value={form.layout}
                  onChange={e => setForm(s => ({...s, layout: e.target.value as FormState['layout']}))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                  {LAYOUTS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Order (ยิ่งมากยิ่งบน)</label>
                <input type="number" value={form.sort_order}
                  onChange={e => setForm(s => ({...s, sort_order: e.target.value}))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={form.is_active}
                  onChange={e => setForm(s => ({...s, is_active: e.target.checked}))} />
                เปิดใช้งาน
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={form.show_on_home}
                  onChange={e => setForm(s => ({...s, show_on_home: e.target.checked}))} />
                แสดงในหน้า home (uncheck = แสดงเฉพาะ /promotions)
              </label>
            </div>

            {msg && (
              <p className={`text-sm text-center ${msg.includes('สำเร็จ') ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>
            )}

            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-xl text-sm font-medium">
                ยกเลิก
              </button>
              <button onClick={save} disabled={saving || !form.title}
                className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-900 font-semibold py-2.5 rounded-xl text-sm">
                {saving ? 'กำลังบันทึก...' : (form.id ? 'อัพเดต' : 'สร้าง')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
