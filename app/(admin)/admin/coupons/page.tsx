'use client'
import { useState, useEffect, useMemo } from 'react'
import { Tag, Plus, X, BarChart3, Search } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface CouponStat {
  id: string; code: string; title: string; discount_type: string; discount_value: number;
  valid_until: string; recipient_count: number; used_count: number;
  expired_count: number; redemption_rate: number;
  users?: { full_name?: string; member_id?: string }
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<CouponStat[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [q, setQ] = useState('')
  const [form, setForm] = useState({
    user_id: '', title: '', discount_type: 'PERCENT',
    discount_value: '', valid_until: '', description: '', min_purchase: '0',
    theme: 'black',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function loadStats() {
    setLoading(true)
    const res = await fetch('/api/admin/coupons/stats')
    const data = await res.json()
    setCoupons(data.coupons || [])
    setLoading(false)
  }
  useEffect(() => { loadStats() }, [])

  const summary = useMemo(() => {
    const total = coupons.length
    const used  = coupons.reduce((s, c) => s + Number(c.used_count || 0), 0)
    const recipient = coupons.reduce((s, c) => s + Number(c.recipient_count || 0), 0)
    const rate = recipient > 0 ? ((used / recipient) * 100).toFixed(1) : '0'
    return { total, used, recipient, rate }
  }, [coupons])

  const filtered = q ? coupons.filter(c =>
    (c.title || '').toLowerCase().includes(q.toLowerCase()) ||
    (c.code || '').toLowerCase().includes(q.toLowerCase())
  ) : coupons

  async function createCoupon() {
    setSaving(true); setMsg('')
    const res = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (res.ok) { setMsg('สร้างคูปองสำเร็จ'); setShowForm(false); loadStats() }
    else setMsg(data.error || 'เกิดข้อผิดพลาด')
    setSaving(false)
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
        <div>
          <h1 className="admin-h1"><Tag size={18} style={{ verticalAlign: 'baseline' }} /> คูปอง</h1>
          <p className="admin-sub">{summary.total} คูปอง</p>
        </div>
        <button onClick={() => setShowForm(true)} className="admin-btn admin-btn-ink">
          <Plus size={14} /> สร้างคูปอง
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { lbl: 'Total coupons',  val: summary.total },
          { lbl: 'Recipients',     val: summary.recipient },
          { lbl: 'Used',           val: summary.used,    color: 'var(--green)' },
          { lbl: 'Redemption %',   val: `${summary.rate}%`, color: 'var(--gold-deep)' },
        ].map(s => (
          <div key={s.lbl} className="admin-card" style={{ padding: 14 }}>
            <p style={{ fontSize: 10, color: 'var(--ink-mute)', margin: 0, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>{s.lbl}</p>
            <p className="num" style={{ fontSize: 22, fontWeight: 800, margin: '6px 0 0', color: s.color || 'var(--ink)' }}>
              {typeof s.val === 'number' ? s.val.toLocaleString() : s.val}
            </p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 12, position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint)' }} />
        <input className="admin-field" placeholder="ค้นหาคูปอง..." value={q}
          onChange={e => setQ(e.target.value)} style={{ paddingLeft: 36 }} />
      </div>

      {/* Table */}
      <div className="admin-card" style={{ overflow: 'hidden' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>ชื่อ</th>
              <th>ส่วนลด</th>
              <th>ผู้รับ</th>
              <th>ใช้แล้ว</th>
              <th>หมดอายุ</th>
              <th>Redemption</th>
              <th>วันหมดอายุ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--ink-mute)' }}>กำลังโหลด...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--ink-mute)' }}>ยังไม่มีคูปอง</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id}>
                <td className="num" style={{ color: 'var(--gold-deep)', fontWeight: 700, fontSize: 11 }}>{c.code}</td>
                <td style={{ fontWeight: 600 }}>{c.title}</td>
                <td className="num" style={{ fontWeight: 700 }}>
                  {c.discount_type === 'PERCENT' ? `${c.discount_value}%` : `฿${c.discount_value}`}
                </td>
                <td className="num">{c.recipient_count}</td>
                <td className="num" style={{ color: 'var(--green)', fontWeight: 600 }}>{c.used_count}</td>
                <td className="num muted">{c.expired_count}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 4, background: 'var(--ink-ghost)', borderRadius: 'var(--r-pill)', overflow: 'hidden', minWidth: 60 }}>
                      <div style={{
                        height: '100%', width: `${Math.min(100, Number(c.redemption_rate || 0))}%`,
                        background: 'linear-gradient(90deg,var(--gold),var(--gold-soft))',
                      }} />
                    </div>
                    <span className="num" style={{ fontSize: 11, fontWeight: 700, minWidth: 40 }}>
                      {Number(c.redemption_rate || 0).toFixed(0)}%
                    </span>
                  </div>
                </td>
                <td className="muted" style={{ fontSize: 11 }}>{formatDate(c.valid_until)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create form modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,14,14,0.45)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="admin-card" style={{ width: '100%', maxWidth: 480, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 className="admin-h1" style={{ fontSize: 18 }}>สร้างคูปองใหม่</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} color="var(--ink-mute)" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input className="admin-field" placeholder="User ID (ว่าง = ส่งทุกคน)" value={form.user_id}
                onChange={e => setForm(s => ({...s, user_id: e.target.value}))} />
              <input className="admin-field" placeholder="ชื่อคูปอง *" value={form.title}
                onChange={e => setForm(s => ({...s, title: e.target.value}))} />
              <input className="admin-field" placeholder="รายละเอียด" value={form.description}
                onChange={e => setForm(s => ({...s, description: e.target.value}))} />
              <div style={{ display: 'flex', gap: 8 }}>
                <select className="admin-field" value={form.discount_type}
                  onChange={e => setForm(s => ({...s, discount_type: e.target.value}))} style={{ flex: 1 }}>
                  <option value="PERCENT">เปอร์เซ็นต์ (%)</option>
                  <option value="FIXED">จำนวนเงิน (฿)</option>
                </select>
                <input className="admin-field" type="number" placeholder="ส่วนลด *" value={form.discount_value}
                  onChange={e => setForm(s => ({...s, discount_value: e.target.value}))} style={{ flex: 1 }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="admin-field" type="number" placeholder="ยอดขั้นต่ำ" value={form.min_purchase}
                  onChange={e => setForm(s => ({...s, min_purchase: e.target.value}))} style={{ flex: 1 }} />
                <input className="admin-field" type="date" placeholder="หมดอายุ" value={form.valid_until}
                  onChange={e => setForm(s => ({...s, valid_until: e.target.value}))} style={{ flex: 1 }} />
              </div>

              {/* Theme color picker */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-mute)', margin: '0 0 8px' }}>
                  สีคูปอง
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                  {[
                    { key: 'black',    label: 'Black',    bg: 'linear-gradient(135deg,#1A1815,#0E0E0E)' },
                    { key: 'gold',     label: 'Gold',     bg: 'linear-gradient(135deg,#EADBB1,#A0782B)' },
                    { key: 'rose',     label: 'Rose',     bg: 'linear-gradient(135deg,#F8C8D8,#D97A95)' },
                    { key: 'lavender', label: 'Lavender', bg: 'linear-gradient(135deg,#C5B5E8,#7B5AB8)' },
                    { key: 'sage',     label: 'Sage',     bg: 'linear-gradient(135deg,#B0CFB0,#5C8A5C)' },
                    { key: 'coral',    label: 'Coral',    bg: 'linear-gradient(135deg,#F9B9A0,#D9603F)' },
                    { key: 'cream',    label: 'Cream',    bg: 'linear-gradient(135deg,#FAF3DC,#D4B978)' },
                    { key: 'navy',     label: 'Navy',     bg: 'linear-gradient(135deg,#4A6E92,#1A2C45)' },
                    { key: 'emerald',  label: 'Emerald',  bg: 'linear-gradient(135deg,#7DC9B0,#1F5C46)' },
                  ].map(t => (
                    <button key={t.key} type="button"
                      onClick={() => setForm(s => ({ ...s, theme: t.key }))}
                      title={t.label}
                      style={{
                        aspectRatio: '1', borderRadius: 'var(--r-md)',
                        background: t.bg,
                        border: form.theme === t.key ? '2.5px solid var(--ink)' : '2.5px solid transparent',
                        cursor: 'pointer',
                        position: 'relative',
                        boxShadow: form.theme === t.key ? '0 0 0 2px var(--gold), 0 4px 10px rgba(14,14,14,0.10)' : '0 2px 6px rgba(14,14,14,0.06)',
                        transition: 'all 0.15s ease',
                        padding: 0,
                      }}
                    >
                      {form.theme === t.key && (
                        <span style={{
                          position: 'absolute', inset: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: 14, fontWeight: 800,
                          textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                        }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {msg && <p style={{ fontSize: 12, marginTop: 12, color: msg.includes('สำเร็จ') ? 'var(--green)' : 'var(--red)' }}>{msg}</p>}

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button onClick={() => setShowForm(false)} className="admin-btn admin-btn-ghost" style={{ flex: 1 }}>ยกเลิก</button>
              <button onClick={createCoupon} disabled={saving || !form.title || !form.discount_value || !form.valid_until}
                className="admin-btn admin-btn-ink" style={{ flex: 2 }}>
                {saving ? 'กำลังสร้าง...' : 'สร้าง'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
