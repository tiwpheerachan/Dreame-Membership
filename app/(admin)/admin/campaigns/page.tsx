'use client'
import { useState, useEffect } from 'react'
import { Send, CalendarHeart, Users, AlertTriangle } from 'lucide-react'

export default function CampaignsPage() {
  const [form, setForm] = useState({
    tier: '', min_lifetime: '', max_lifetime: '',
    no_purchase_days: '', has_tag: '', is_vip: false,
    title: '', description: '',
    discount_type: 'PERCENT', discount_value: '',
    min_purchase: '0', valid_until: '',
  })
  const [estimated, setEstimated] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  // live preview count
  useEffect(() => {
    const t = setTimeout(async () => {
      const sp = new URLSearchParams()
      if (form.tier) sp.set('tier', form.tier)
      if (form.min_lifetime) sp.set('min_lifetime', form.min_lifetime)
      if (form.max_lifetime) sp.set('max_lifetime', form.max_lifetime)
      if (form.has_tag) sp.set('has_tag', form.has_tag)
      if (form.is_vip) sp.set('is_vip', 'true')
      const r = await fetch(`/api/admin/campaigns/segment-coupon?${sp.toString()}`)
      const d = await r.json()
      if (r.ok) setEstimated(d.estimated)
    }, 300)
    return () => clearTimeout(t)
  }, [form.tier, form.min_lifetime, form.max_lifetime, form.has_tag, form.is_vip])

  async function send() {
    setSending(true); setMsg('')
    const payload = {
      tier: form.tier || undefined,
      min_lifetime: form.min_lifetime ? Number(form.min_lifetime) : undefined,
      max_lifetime: form.max_lifetime ? Number(form.max_lifetime) : undefined,
      no_purchase_days: form.no_purchase_days ? Number(form.no_purchase_days) : undefined,
      has_tag: form.has_tag || undefined,
      is_vip: form.is_vip,
      title: form.title,
      description: form.description,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      min_purchase: Number(form.min_purchase || 0),
      valid_until: form.valid_until,
    }
    const r = await fetch('/api/admin/campaigns/segment-coupon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const d = await r.json()
    setSending(false)
    setConfirmOpen(false)
    if (r.ok) setMsg(`ส่งคูปองให้ ${d.target_count} คนเรียบร้อย`)
    else setMsg(d.error || 'ไม่สำเร็จ')
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--admin-bg)' }}>
      <header className="border-b flex-shrink-0"
        style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <div className="px-6 lg:px-8 py-5">
          <p style={{ color: 'var(--admin-gold)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 4 }}>
            Marketing
          </p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--admin-ink)' }}>Targeted Campaigns</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--admin-ink-mute)' }}>
            ส่งคูปองตรงกลุ่ม — เลือกเงื่อนไข segment + กำหนดส่วนลด
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-5">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, maxWidth: 1100 }}>
        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="admin-card" style={{ padding: 20 }}>
            <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: 13 }}>1. Audience (เงื่อนไข segment)</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--ink-mute)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Tier</label>
                <select className="admin-field" value={form.tier} onChange={e => setForm(s => ({...s, tier: e.target.value}))}>
                  <option value="">ทั้งหมด</option>
                  <option value="SILVER">Silver</option>
                  <option value="GOLD">Gold</option>
                  <option value="PLATINUM">Platinum</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--ink-mute)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Tag</label>
                <input className="admin-field" placeholder="VIP, Wholesale, ..." value={form.has_tag}
                  onChange={e => setForm(s => ({...s, has_tag: e.target.value}))} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--ink-mute)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Lifetime points ขั้นต่ำ</label>
                <input className="admin-field" type="number" placeholder="0" value={form.min_lifetime}
                  onChange={e => setForm(s => ({...s, min_lifetime: e.target.value}))} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--ink-mute)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Lifetime points สูงสุด</label>
                <input className="admin-field" type="number" placeholder="∞" value={form.max_lifetime}
                  onChange={e => setForm(s => ({...s, max_lifetime: e.target.value}))} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--ink-mute)', display: 'block', marginBottom: 4, fontWeight: 600 }}>ไม่ซื้อภายใน X วัน (win-back)</label>
                <input className="admin-field" type="number" placeholder="60" value={form.no_purchase_days}
                  onChange={e => setForm(s => ({...s, no_purchase_days: e.target.value}))} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: form.is_vip ? 'var(--ink)' : 'var(--bg-soft)', color: form.is_vip ? '#fff' : 'var(--ink)', borderRadius: 'var(--r-md)', cursor: 'pointer', fontSize: 12, fontWeight: 600, alignSelf: 'flex-end' }}>
                <input type="checkbox" checked={form.is_vip}
                  onChange={e => setForm(s => ({...s, is_vip: e.target.checked}))} style={{ display: 'none' }} />
                VIP เท่านั้น
              </label>
            </div>
          </div>

          <div className="admin-card" style={{ padding: 20 }}>
            <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: 13 }}>2. Coupon spec</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input className="admin-field" placeholder="ชื่อคูปอง *" value={form.title}
                onChange={e => setForm(s => ({...s, title: e.target.value}))} />
              <input className="admin-field" placeholder="รายละเอียด" value={form.description}
                onChange={e => setForm(s => ({...s, description: e.target.value}))} />
              <div style={{ display: 'flex', gap: 10 }}>
                <select className="admin-field" value={form.discount_type}
                  onChange={e => setForm(s => ({...s, discount_type: e.target.value}))} style={{ flex: 1 }}>
                  <option value="PERCENT">เปอร์เซ็นต์ (%)</option>
                  <option value="FIXED">จำนวนเงิน (฿)</option>
                </select>
                <input className="admin-field" type="number" placeholder="ส่วนลด *" value={form.discount_value}
                  onChange={e => setForm(s => ({...s, discount_value: e.target.value}))} style={{ flex: 1 }} />
                <input className="admin-field" type="number" placeholder="ขั้นต่ำ" value={form.min_purchase}
                  onChange={e => setForm(s => ({...s, min_purchase: e.target.value}))} style={{ flex: 1 }} />
              </div>
              <input className="admin-field" type="date" value={form.valid_until}
                onChange={e => setForm(s => ({...s, valid_until: e.target.value}))} />
            </div>
          </div>

          {msg && <p style={{ fontSize: 12, color: msg.includes('เรียบร้อย') ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{msg}</p>}
        </div>

        {/* Preview */}
        <div className="admin-card" style={{ padding: 20, height: 'fit-content', position: 'sticky', top: 20 }}>
          <p style={{ margin: 0, fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700 }}>
            ส่งให้
          </p>
          <p className="num" style={{ fontSize: 36, fontWeight: 800, margin: '8px 0', color: 'var(--gold-deep)' }}>
            {estimated ?? '...'}
          </p>
          <p style={{ fontSize: 11, color: 'var(--ink-mute)', margin: '0 0 16px' }}>
            <Users size={11} style={{ verticalAlign: 'baseline' }} /> คนตามเงื่อนไข
          </p>
          <button onClick={() => setConfirmOpen(true)}
            disabled={sending || !form.title || !form.discount_value || !form.valid_until || !estimated}
            className="admin-btn admin-btn-ink" style={{ width: '100%' }}>
            <Send size={13} /> {sending ? 'กำลังส่ง...' : 'ส่งคูปอง'}
          </button>
          <p style={{ fontSize: 10, color: 'var(--admin-ink-faint)', margin: '8px 0 0', textAlign: 'center' }}>
            ⚠️ คนละ 1 รหัสคูปอง · กดส่งแล้วยกเลิกไม่ได้
          </p>
        </div>

        {/* Confirm modal */}
        {confirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(14,14,14,0.45)', backdropFilter: 'blur(6px)' }}>
            <div className="admin-card p-5 w-full max-w-md">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: '#FBE9E9' }}>
                  <AlertTriangle size={18} style={{ color: '#B14242' }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-sm" style={{ color: 'var(--admin-ink)' }}>
                    ยืนยันส่งคูปอง?
                  </h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--admin-ink-mute)' }}>
                    จะส่งคูปอง <strong>{form.title || '(ไม่มีชื่อ)'}</strong> ให้ <strong>{estimated} คน</strong>
                    <br />
                    {form.discount_type === 'PERCENT'
                      ? `ส่วนลด ${form.discount_value}%`
                      : `ส่วนลด ฿${Number(form.discount_value).toLocaleString()}`}
                    {Number(form.min_purchase) > 0 && ` · ขั้นต่ำ ฿${Number(form.min_purchase).toLocaleString()}`}
                    {' · '}หมดอายุ {form.valid_until}
                  </p>
                  <p className="text-xs mt-2" style={{ color: '#B14242' }}>
                    การกระทำนี้ไม่สามารถยกเลิกได้
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmOpen(false)} className="admin-btn admin-btn-ghost flex-1">
                  ยกเลิก
                </button>
                <button onClick={send} disabled={sending}
                  className="admin-btn admin-btn-ink flex-1">
                  {sending ? 'กำลังส่ง…' : `ส่ง ${estimated} คูปอง`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
