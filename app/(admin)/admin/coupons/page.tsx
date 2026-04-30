'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  Tag, Plus, X, Search, ChevronRight, Loader2, Trash2,
  CheckCircle, Clock, Users, AlertTriangle, Ticket,
  RotateCcw, Edit3, CalendarPlus, Save,
} from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils'
import Drawer from '@/components/admin/Drawer'

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface CouponRow {
  id: string
  user_id: string | null
  code: string
  title: string | null
  description: string | null
  discount_type: 'PERCENT' | 'FIXED'
  discount_value: number
  min_purchase: number | null
  valid_from: string
  valid_until: string
  used_at: string | null
  theme: string | null
  created_at: string
  users: { full_name: string | null; member_id: string | null } | null
}

type CampaignStatus = 'active' | 'fully_used' | 'expired'

interface Campaign {
  key: string
  title: string
  description: string | null
  discount_type: 'PERCENT' | 'FIXED'
  discount_value: number
  valid_until: string
  created_at: string  // earliest of the group
  theme: string | null
  coupons: CouponRow[]
  total: number
  used: number
  available: number
  expired: number
  status: CampaignStatus
  redemptionPct: number
}

type StatusFilter = 'all' | 'active' | 'fully_used' | 'expired'

// ────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<CouponRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [form, setForm] = useState({
    user_id: '', title: '', discount_type: 'PERCENT',
    discount_value: '', valid_until: '', description: '', min_purchase: '0',
    theme: 'black',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function loadCoupons() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/coupons')
      const data = await res.json()
      setCoupons(data.coupons || [])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { loadCoupons() }, [])

  // ── Group coupons by campaign key ──
  const campaigns: Campaign[] = useMemo(() => {
    const map = new Map<string, Campaign>()
    const today = new Date(); today.setHours(0, 0, 0, 0)

    for (const c of coupons) {
      const key = `${c.title || ''}|${c.valid_until}|${c.discount_type}|${c.discount_value}`
      let camp = map.get(key)
      if (!camp) {
        camp = {
          key,
          title: c.title || '(ไม่มีชื่อ)',
          description: c.description,
          discount_type: c.discount_type,
          discount_value: Number(c.discount_value),
          valid_until: c.valid_until,
          created_at: c.created_at,
          theme: c.theme,
          coupons: [],
          total: 0, used: 0, available: 0, expired: 0,
          status: 'active', redemptionPct: 0,
        }
        map.set(key, camp)
      }
      camp.coupons.push(c)
      camp.total++
      if (c.used_at) {
        camp.used++
      } else if (new Date(c.valid_until) < today) {
        camp.expired++
      } else {
        camp.available++
      }
      // earliest created_at
      if (c.created_at < camp.created_at) camp.created_at = c.created_at
    }

    const list = Array.from(map.values())
    for (const c of list) {
      c.redemptionPct = c.total > 0 ? Math.round((c.used / c.total) * 100) : 0
      // Status priority: active (still has unused & unexpired), then fully_used, else expired
      if (c.available > 0) c.status = 'active'
      else if (c.used === c.total) c.status = 'fully_used'
      else c.status = 'expired'
    }
    list.sort((a, b) => b.created_at.localeCompare(a.created_at))
    return list
  }, [coupons])

  const counts = useMemo(() => ({
    all:        campaigns.length,
    active:     campaigns.filter(c => c.status === 'active').length,
    fully_used: campaigns.filter(c => c.status === 'fully_used').length,
    expired:    campaigns.filter(c => c.status === 'expired').length,
  }), [campaigns])

  const filtered = useMemo(() => {
    let list = campaigns
    if (statusFilter !== 'all') list = list.filter(c => c.status === statusFilter)
    if (q) {
      const s = q.toLowerCase()
      list = list.filter(c =>
        c.title.toLowerCase().includes(s) ||
        c.coupons.some(x => x.code.toLowerCase().includes(s))
      )
    }
    return list
  }, [campaigns, statusFilter, q])

  const summary = useMemo(() => {
    const total = coupons.length
    const used = coupons.reduce((s, c) => s + (c.used_at ? 1 : 0), 0)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const expired = coupons.filter(c => !c.used_at && new Date(c.valid_until) < today).length
    const rate = total > 0 ? Math.round((used / total) * 100) : 0
    return { total, used, expired, rate }
  }, [coupons])

  const selected = useMemo(() => filtered.find(c => c.key === selectedKey)
    || campaigns.find(c => c.key === selectedKey)
    || null, [filtered, campaigns, selectedKey])

  async function createCoupon() {
    setSaving(true); setMsg('')
    const res = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (res.ok) { setMsg('สร้างคูปองสำเร็จ'); setShowForm(false); loadCoupons() }
    else setMsg(data.error || 'เกิดข้อผิดพลาด')
    setSaving(false)
  }

  async function deleteCoupon(id: string) {
    const res = await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setCoupons(prev => prev.filter(c => c.id !== id))
    } else {
      const data = await res.json()
      alert(data.error || 'ลบไม่สำเร็จ')
    }
  }

  async function deleteAllExpiredInCampaign(camp: Campaign) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const expired = camp.coupons.filter(c => !c.used_at && new Date(c.valid_until) < today)
    if (expired.length === 0) return
    if (!confirm(`ลบคูปองหมดอายุที่ยังไม่ได้ใช้ ${expired.length} ใบในแคมเปญนี้?`)) return

    const results = await Promise.allSettled(
      expired.map(c => fetch(`/api/admin/coupons/${c.id}`, { method: 'DELETE' }))
    )
    const okIds = new Set<string>()
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && (r.value as Response).ok) okIds.add(expired[i].id)
    })
    setCoupons(prev => prev.filter(c => !okIds.has(c.id)))
  }

  // PATCH a single coupon and merge the server response back into local state.
  // Returns true on success — caller can decide whether to close UI / refetch.
  async function patchCoupon(id: string, body: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'บันทึกไม่สำเร็จ')
        return false
      }
      // Merge updated fields without dropping the embedded user info we
      // already have (PATCH response doesn't re-fetch the join).
      setCoupons(prev => prev.map(c => c.id === id ? { ...c, ...data.coupon } : c))
      return true
    } catch {
      alert('เชื่อมต่อไม่ได้')
      return false
    }
  }

  // Bulk PATCH a list of coupons in parallel. Used for campaign-level
  // edits (extend valid_until, change title, etc.) where the same body
  // applies to every coupon in the campaign.
  async function bulkPatchCoupons(ids: string[], body: Record<string, unknown>): Promise<number> {
    const results = await Promise.allSettled(
      ids.map(id => fetch(`/api/admin/coupons/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => ({ id, ok: r.ok, data: await r.json().catch(() => ({})) })))
    )
    const okIds = new Set<string>()
    let firstError = ''
    results.forEach(r => {
      if (r.status === 'fulfilled') {
        const v = r.value
        if (v.ok) okIds.add(v.id)
        else if (!firstError) firstError = v.data?.error || 'บันทึกไม่สำเร็จ'
      }
    })
    if (okIds.size > 0) {
      // Apply the patch optimistically to every successful row.
      setCoupons(prev => prev.map(c => okIds.has(c.id) ? { ...c, ...body } : c))
    }
    if (okIds.size < ids.length && firstError) {
      alert(`บันทึกได้ ${okIds.size}/${ids.length} ใบ — ${firstError}`)
    }
    return okIds.size
  }

  // ────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
        <div>
          <h1 className="admin-h1"><Tag size={18} style={{ verticalAlign: 'baseline' }} /> คูปอง</h1>
          <p className="admin-sub">{campaigns.length} แคมเปญ · {summary.total} คูปองรวม</p>
        </div>
        <button onClick={() => setShowForm(true)} className="admin-btn admin-btn-ink">
          <Plus size={14} /> สร้างคูปอง
        </button>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { lbl: 'แคมเปญทั้งหมด', val: campaigns.length },
          { lbl: 'คูปองรวม',      val: summary.total },
          { lbl: 'ใช้แล้ว',       val: summary.used,    color: 'var(--green)' },
          { lbl: 'หมดอายุค้าง',  val: summary.expired, color: 'var(--red)' },
        ].map(s => (
          <div key={s.lbl} className="admin-card" style={{ padding: 14 }}>
            <p style={{ fontSize: 10, color: 'var(--ink-mute)', margin: 0, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>{s.lbl}</p>
            <p className="num" style={{ fontSize: 22, fontWeight: 800, margin: '6px 0 0', color: s.color || 'var(--ink)' }}>
              {s.val.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Status chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {([
          { key: 'all',        label: 'ทั้งหมด',     count: counts.all },
          { key: 'active',     label: 'ใช้งานได้',   count: counts.active },
          { key: 'fully_used', label: 'ใช้หมดแล้ว',  count: counts.fully_used },
          { key: 'expired',    label: 'หมดอายุ',     count: counts.expired },
        ] as Array<{ key: StatusFilter; label: string; count: number }>).map(c => {
          const active = statusFilter === c.key
          return (
            <button
              key={c.key}
              onClick={() => setStatusFilter(c.key)}
              className={`admin-btn ${active ? 'admin-btn-ink' : 'admin-btn-ghost'}`}
              style={{ padding: '6px 12px', fontSize: 12, gap: 6 }}
            >
              {c.label}
              <span style={{
                fontSize: 10.5, padding: '1px 7px', borderRadius: 100,
                background: active ? 'rgba(255,255,255,0.18)' : 'var(--bg-soft)',
                color: active ? '#fff' : 'var(--ink-mute)', fontWeight: 700,
              }}>{c.count}</span>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 12, position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint)' }} />
        <input className="admin-field" placeholder="ค้นหาแคมเปญ / โค้ด..." value={q}
          onChange={e => setQ(e.target.value)} style={{ paddingLeft: 36 }} />
      </div>

      {/* Campaign cards grid */}
      {loading ? (
        <div className="admin-card" style={{ padding: 60, textAlign: 'center', color: 'var(--ink-mute)' }}>
          <Loader2 size={24} className="spinner" style={{ margin: '0 auto 8px', display: 'block' }} />
          กำลังโหลด...
        </div>
      ) : filtered.length === 0 ? (
        <div className="admin-card" style={{ padding: 60, textAlign: 'center', color: 'var(--ink-mute)' }}>
          <Tag size={28} style={{ margin: '0 auto 8px', display: 'block', color: 'var(--ink-faint)' }} />
          <p style={{ margin: 0, fontSize: 13 }}>ไม่พบแคมเปญที่ตรงกัน</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {filtered.map(c => (
            <CampaignCard
              key={c.key} camp={c}
              onClick={() => setSelectedKey(c.key)}
            />
          ))}
        </div>
      )}

      {/* Drawer: campaign detail */}
      <Drawer
        open={!!selected}
        onClose={() => setSelectedKey(null)}
        title={selected?.title || ''}
        subtitle={selected
          ? `${selected.total} คูปอง · ${formatDiscount(selected.discount_type, selected.discount_value)} · หมด ${formatDate(selected.valid_until)}`
          : ''}
        width={680}
      >
        {selected && (
          <CampaignDetail
            camp={selected}
            onDeleteCoupon={deleteCoupon}
            onDeleteExpired={() => deleteAllExpiredInCampaign(selected)}
            onPatchCoupon={patchCoupon}
            onBulkPatch={bulkPatchCoupons}
          />
        )}
      </Drawer>

      {/* Create form modal */}
      {showForm && (
        <CreateCouponModal
          form={form} setForm={setForm}
          saving={saving} msg={msg}
          onClose={() => setShowForm(false)}
          onSubmit={createCoupon}
        />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Campaign card
// ────────────────────────────────────────────────────────────────

function statusPillProps(s: CampaignStatus): { label: string; cls: string; Icon: typeof Clock } {
  if (s === 'active')      return { label: 'ใช้งานได้',  cls: 'admin-pill admin-pill-green',  Icon: CheckCircle }
  if (s === 'fully_used')  return { label: 'ใช้หมดแล้ว', cls: 'admin-pill admin-pill-amber', Icon: Ticket }
  return { label: 'หมดอายุ', cls: 'admin-pill admin-pill-red', Icon: AlertTriangle }
}

function formatDiscount(type: 'PERCENT' | 'FIXED', value: number) {
  return type === 'PERCENT' ? `${value}%` : `฿${value.toLocaleString()}`
}

function CampaignCard({ camp, onClick }: { camp: Campaign; onClick: () => void }) {
  const { label: statusLabel, cls: statusCls, Icon: StatusIcon } = statusPillProps(camp.status)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const daysToExpire = Math.ceil((new Date(camp.valid_until).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  return (
    <button
      onClick={onClick}
      className="admin-card"
      style={{
        padding: 16, textAlign: 'left',
        background: '#fff', border: '1px solid var(--hair)',
        cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', flexDirection: 'column', gap: 10,
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--ink-mute)'
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(14,14,14,0.04)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--hair)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontWeight: 700, fontSize: 14, lineHeight: 1.3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {camp.title}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--ink-mute)' }}>
            หมดอายุ {formatDate(camp.valid_until)}
            {camp.status === 'active' && daysToExpire <= 7 && (
              <span style={{ color: 'var(--amber)', fontWeight: 600 }}> · เหลือ {daysToExpire} วัน</span>
            )}
          </p>
        </div>
        <span className={statusCls} style={{ fontSize: 10.5, flexShrink: 0 }}>
          <StatusIcon size={11} /> {statusLabel}
        </span>
      </div>

      {/* Discount */}
      <div style={{
        padding: '10px 12px', borderRadius: 'var(--r-md)',
        background: 'var(--bg-soft)',
        display: 'flex', alignItems: 'baseline', gap: 6,
      }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--gold-deep)' }}>
          {formatDiscount(camp.discount_type, camp.discount_value)}
        </span>
        <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>ส่วนลด</span>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, fontSize: 11 }}>
        <Stat label="ทั้งหมด" value={camp.total} />
        <Stat label="ใช้แล้ว" value={camp.used} color="var(--green)" />
        <Stat label="ค้าง"    value={camp.available + camp.expired} color="var(--ink-mute)" />
      </div>

      {/* Redemption bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-mute)', marginBottom: 4 }}>
          <span>Redemption</span>
          <span style={{ fontWeight: 700 }}>{camp.redemptionPct}%</span>
        </div>
        <div style={{ height: 4, background: 'var(--ink-ghost)', borderRadius: 'var(--r-pill)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${camp.redemptionPct}%`,
            background: 'linear-gradient(90deg,var(--gold),var(--gold-soft))',
          }} />
        </div>
      </div>
    </button>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ padding: '6px 8px', background: 'var(--bg-soft)', borderRadius: 'var(--r-sm)' }}>
      <p style={{ margin: 0, fontSize: 9.5, color: 'var(--ink-mute)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      <p className="num" style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700, color: color || 'var(--ink)' }}>
        {value.toLocaleString()}
      </p>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Campaign detail (drawer content)
// ────────────────────────────────────────────────────────────────

function CampaignDetail({
  camp, onDeleteCoupon, onDeleteExpired, onPatchCoupon, onBulkPatch,
}: {
  camp: Campaign
  onDeleteCoupon: (id: string) => void
  onDeleteExpired: () => void
  onPatchCoupon: (id: string, body: Record<string, unknown>) => Promise<boolean>
  onBulkPatch: (ids: string[], body: Record<string, unknown>) => Promise<number>
}) {
  const [tab, setTab] = useState<'all' | 'available' | 'used' | 'expired'>('all')
  const [activePanel, setActivePanel] = useState<null | 'extend' | 'edit'>(null)
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const list = useMemo(() => {
    const all = [...camp.coupons].sort((a, b) =>
      (a.users?.full_name || '').localeCompare(b.users?.full_name || '', 'th'))
    if (tab === 'used')      return all.filter(c => c.used_at)
    if (tab === 'expired')   return all.filter(c => !c.used_at && new Date(c.valid_until) < today)
    if (tab === 'available') return all.filter(c => !c.used_at && new Date(c.valid_until) >= today)
    return all
  }, [camp.coupons, tab, today])

  const expiredCount = camp.coupons.filter(c => !c.used_at && new Date(c.valid_until) < today).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Summary */}
      <div className="admin-card" style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <Stat label="ทั้งหมด" value={camp.total} />
        <Stat label="ใช้งานได้" value={camp.available} color="var(--green)" />
        <Stat label="ใช้แล้ว"    value={camp.used} color="var(--gold-deep)" />
        <Stat label="หมดอายุ"    value={camp.expired} color="var(--red)" />
      </div>

      {/* Description */}
      {camp.description && (
        <div className="admin-card" style={{ padding: 12 }}>
          <p style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 6px' }}>
            รายละเอียด
          </p>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5 }}>{camp.description}</p>
        </div>
      )}

      {/* Campaign-level actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button
          onClick={() => setActivePanel(activePanel === 'extend' ? null : 'extend')}
          className={`admin-btn ${activePanel === 'extend' ? 'admin-btn-ink' : 'admin-btn-ghost'}`}
          style={{ flex: '1 1 auto', padding: '7px 12px', fontSize: 12, gap: 6, justifyContent: 'center' }}
        >
          <CalendarPlus size={12} /> ต่ออายุทั้งแคมเปญ
        </button>
        <button
          onClick={() => setActivePanel(activePanel === 'edit' ? null : 'edit')}
          className={`admin-btn ${activePanel === 'edit' ? 'admin-btn-ink' : 'admin-btn-ghost'}`}
          style={{ flex: '1 1 auto', padding: '7px 12px', fontSize: 12, gap: 6, justifyContent: 'center' }}
        >
          <Edit3 size={12} /> แก้ไขแคมเปญ
        </button>
        {expiredCount > 0 && (
          <button
            onClick={onDeleteExpired}
            className="admin-btn admin-btn-ghost"
            style={{ flex: '1 1 100%', padding: '7px 12px', fontSize: 12, gap: 6, color: 'var(--red)', borderColor: 'rgba(139,58,58,0.20)', justifyContent: 'center' }}
          >
            <Trash2 size={12} /> ลบหมดอายุค้าง ({expiredCount} ใบ)
          </button>
        )}
      </div>

      {/* Inline edit panels */}
      {activePanel === 'extend' && (
        <ExtendCampaignPanel
          camp={camp} onBulkPatch={onBulkPatch}
          onClose={() => setActivePanel(null)}
        />
      )}
      {activePanel === 'edit' && (
        <EditCampaignPanel
          camp={camp} onBulkPatch={onBulkPatch}
          onClose={() => setActivePanel(null)}
        />
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-soft)', borderRadius: 'var(--r-md)' }}>
        {([
          ['all', `ทั้งหมด (${camp.total})`],
          ['available', `ใช้งานได้ (${camp.available})`],
          ['used', `ใช้แล้ว (${camp.used})`],
          ['expired', `หมดอายุ (${camp.expired})`],
        ] as const).map(([k, label]) => (
          <button
            key={k} onClick={() => setTab(k)}
            style={{
              flex: 1, padding: '6px 8px', fontSize: 11, fontWeight: 600,
              border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer',
              background: tab === k ? '#fff' : 'transparent',
              color: tab === k ? 'var(--ink)' : 'var(--ink-mute)',
              boxShadow: tab === k ? '0 1px 2px rgba(14,14,14,0.05)' : 'none',
              fontFamily: 'inherit', transition: 'all 0.12s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Coupon list */}
      {list.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--ink-mute)', fontSize: 12 }}>
          ไม่มีคูปองในหมวดนี้
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {list.map(c => (
            <CouponItem
              key={c.id} coupon={c}
              onDelete={onDeleteCoupon}
              onPatch={onPatchCoupon}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Inline panel: extend valid_until for the whole campaign ──
function ExtendCampaignPanel({
  camp, onBulkPatch, onClose,
}: {
  camp: Campaign
  onBulkPatch: (ids: string[], body: Record<string, unknown>) => Promise<number>
  onClose: () => void
}) {
  // Default to 30 days from today
  const defaultDate = new Date()
  defaultDate.setDate(defaultDate.getDate() + 30)
  const [date, setDate] = useState(defaultDate.toISOString().slice(0, 10))
  const [scope, setScope] = useState<'all' | 'expired_only'>('expired_only')
  const [saving, setSaving] = useState(false)

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const expired = camp.coupons.filter(c => !c.used_at && new Date(c.valid_until) < today)
  const targetIds = scope === 'expired_only'
    ? expired.map(c => c.id)
    : camp.coupons.filter(c => !c.used_at).map(c => c.id)

  async function submit() {
    if (!date || targetIds.length === 0) return
    setSaving(true)
    const ok = await onBulkPatch(targetIds, { valid_until: date })
    setSaving(false)
    if (ok > 0) onClose()
  }

  return (
    <div className="admin-card" style={{ padding: 14, background: 'var(--bg-soft)' }}>
      <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
        ต่ออายุคูปอง
      </p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <button
          onClick={() => setScope('expired_only')}
          className={`admin-btn ${scope === 'expired_only' ? 'admin-btn-ink' : 'admin-btn-ghost'}`}
          style={{ flex: 1, padding: '6px 10px', fontSize: 11.5 }}
        >
          เฉพาะหมดอายุ ({expired.length} ใบ)
        </button>
        <button
          onClick={() => setScope('all')}
          className={`admin-btn ${scope === 'all' ? 'admin-btn-ink' : 'admin-btn-ghost'}`}
          style={{ flex: 1, padding: '6px 10px', fontSize: 11.5 }}
        >
          ทุกใบที่ยังไม่ได้ใช้ ({camp.coupons.filter(c => !c.used_at).length} ใบ)
        </button>
      </div>
      <p style={{ fontSize: 10.5, color: 'var(--ink-mute)', margin: '0 0 4px', fontWeight: 600 }}>
        วันหมดอายุใหม่
      </p>
      <input
        type="date" value={date} onChange={e => setDate(e.target.value)}
        className="admin-field" style={{ width: '100%', fontSize: 12, marginBottom: 10 }}
      />
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={submit}
          disabled={saving || !date || targetIds.length === 0}
          className="admin-btn admin-btn-ink"
          style={{ flex: 1, padding: '7px 10px', fontSize: 12, gap: 4 }}
        >
          {saving ? <Loader2 size={11} className="spinner" /> : <Save size={11} />}
          ต่ออายุ {targetIds.length} ใบ
        </button>
        <button onClick={onClose} className="admin-btn admin-btn-ghost"
          style={{ flex: 1, padding: '7px 10px', fontSize: 12 }}>
          ยกเลิก
        </button>
      </div>
    </div>
  )
}

// ── Inline panel: edit shared fields across the whole campaign ──
function EditCampaignPanel({
  camp, onBulkPatch, onClose,
}: {
  camp: Campaign
  onBulkPatch: (ids: string[], body: Record<string, unknown>) => Promise<number>
  onClose: () => void
}) {
  const [title, setTitle] = useState(camp.title === '(ไม่มีชื่อ)' ? '' : camp.title)
  const [description, setDescription] = useState(camp.description || '')
  const [discountValue, setDiscountValue] = useState(String(camp.discount_value))
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>(camp.discount_type)
  const [validUntil, setValidUntil] = useState(camp.valid_until)
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    const ids = camp.coupons.map(c => c.id)
    const body: Record<string, unknown> = {
      title: title || null,
      description: description || null,
      discount_type: discountType,
      discount_value: Number(discountValue) || 0,
      valid_until: validUntil,
    }
    const ok = await onBulkPatch(ids, body)
    setSaving(false)
    if (ok > 0) onClose()
  }

  return (
    <div className="admin-card" style={{ padding: 14, background: 'var(--bg-soft)' }}>
      <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
        แก้ไขแคมเปญ ({camp.total} ใบ)
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ gridColumn: 'span 2' }}>
          <Label>ชื่อคูปอง</Label>
          <input className="admin-field" style={{ width: '100%', fontSize: 12 }}
            value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <Label>รายละเอียด</Label>
          <textarea className="admin-field" style={{ width: '100%', fontSize: 12, resize: 'vertical' }}
            rows={2} value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div>
          <Label>ประเภทส่วนลด</Label>
          <select className="admin-field" style={{ width: '100%', fontSize: 12 }}
            value={discountType} onChange={e => setDiscountType(e.target.value as 'PERCENT' | 'FIXED')}>
            <option value="PERCENT">เปอร์เซ็นต์</option>
            <option value="FIXED">จำนวนเงิน</option>
          </select>
        </div>
        <div>
          <Label>มูลค่าส่วนลด</Label>
          <input type="number" className="admin-field" style={{ width: '100%', fontSize: 12 }}
            value={discountValue} onChange={e => setDiscountValue(e.target.value)} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <Label>หมดอายุ</Label>
          <input type="date" className="admin-field" style={{ width: '100%', fontSize: 12 }}
            value={validUntil} onChange={e => setValidUntil(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button onClick={submit} disabled={saving} className="admin-btn admin-btn-ink"
          style={{ flex: 1, padding: '7px 10px', fontSize: 12, gap: 4 }}>
          {saving ? <Loader2 size={11} className="spinner" /> : <Save size={11} />}
          บันทึกทั้งแคมเปญ
        </button>
        <button onClick={onClose} className="admin-btn admin-btn-ghost"
          style={{ flex: 1, padding: '7px 10px', fontSize: 12 }}>
          ยกเลิก
        </button>
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 9.5, color: 'var(--ink-mute)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 4px' }}>
      {children}
    </p>
  )
}

function CouponItem({
  coupon, onDelete, onPatch,
}: {
  coupon: CouponRow
  onDelete: (id: string) => void
  onPatch: (id: string, body: Record<string, unknown>) => Promise<boolean>
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const isUsed = !!coupon.used_at
  const isExpired = !isUsed && new Date(coupon.valid_until) < today
  const [confirming, setConfirming] = useState<null | 'delete' | 'restore'>(null)
  const [busy, setBusy] = useState(false)

  const status = isUsed ? 'used' : isExpired ? 'expired' : 'active'
  const cfg = {
    used:    { label: 'ใช้แล้ว',    color: 'var(--gold-deep)', Icon: Ticket },
    expired: { label: 'หมดอายุ',    color: 'var(--red)',       Icon: AlertTriangle },
    active:  { label: 'ใช้งานได้',  color: 'var(--green)',     Icon: CheckCircle },
  }[status]

  async function doRestore() {
    setBusy(true)
    await onPatch(coupon.id, { mode: 'restore' })
    setBusy(false)
    setConfirming(null)
  }

  return (
    <div className="admin-card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <p className="num" style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--gold-deep)' }}>
              {coupon.code}
            </p>
            <span style={{ fontSize: 10.5, color: cfg.color, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <cfg.Icon size={11} /> {cfg.label}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <Users size={11} style={{ verticalAlign: 'middle', marginRight: 4, color: 'var(--ink-mute)' }} />
            {coupon.users?.full_name || (coupon.user_id ? '(ไม่พบชื่อ)' : '(ไม่ระบุผู้รับ)')}
            {coupon.users?.member_id && (
              <span className="num muted" style={{ marginLeft: 6, fontSize: 10.5 }}>
                {coupon.users.member_id}
              </span>
            )}
          </p>
          {coupon.used_at && (
            <p style={{ margin: '4px 0 0', fontSize: 10.5, color: 'var(--ink-mute)' }}>
              ใช้เมื่อ {formatDateTime(coupon.used_at)}
            </p>
          )}
        </div>

        {confirming === 'delete' ? (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button
              onClick={() => { onDelete(coupon.id); setConfirming(null) }}
              className="admin-btn admin-btn-danger"
              style={{ padding: '4px 10px', fontSize: 11, gap: 3 }}
            >
              <Trash2 size={10} /> ลบ
            </button>
            <button
              onClick={() => setConfirming(null)}
              className="admin-btn admin-btn-ghost"
              style={{ padding: '4px 10px', fontSize: 11 }}
            >
              ยกเลิก
            </button>
          </div>
        ) : confirming === 'restore' ? (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button
              onClick={doRestore} disabled={busy}
              className="admin-btn admin-btn-ink"
              style={{ padding: '4px 10px', fontSize: 11, gap: 3 }}
            >
              {busy ? <Loader2 size={10} className="spinner" /> : <RotateCcw size={10} />} คืนสภาพ
            </button>
            <button
              onClick={() => setConfirming(null)}
              className="admin-btn admin-btn-ghost"
              style={{ padding: '4px 10px', fontSize: 11 }}
            >
              ยกเลิก
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {isUsed && (
              <button
                onClick={() => setConfirming('restore')}
                className="admin-btn admin-btn-ghost"
                title="คืนสภาพ (ทำให้ใช้ได้อีกครั้ง)"
                style={{ padding: '4px 8px', fontSize: 11, gap: 3, color: 'var(--green)', borderColor: 'rgba(46,122,61,0.20)' }}
              >
                <RotateCcw size={10} /> คืน
              </button>
            )}
            {(isExpired || isUsed) && (
              <button
                onClick={() => setConfirming('delete')}
                className="admin-btn admin-btn-ghost"
                title="ลบคูปองนี้"
                style={{ padding: '4px 8px', fontSize: 11, gap: 3, color: 'var(--red)', borderColor: 'rgba(139,58,58,0.18)' }}
              >
                <Trash2 size={10} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Create coupon modal (extracted from previous version)
// ────────────────────────────────────────────────────────────────

function CreateCouponModal({
  form, setForm, saving, msg, onClose, onSubmit,
}: {
  form: { user_id: string; title: string; discount_type: string; discount_value: string; valid_until: string; description: string; min_purchase: string; theme: string }
  setForm: React.Dispatch<React.SetStateAction<{ user_id: string; title: string; discount_type: string; discount_value: string; valid_until: string; description: string; min_purchase: string; theme: string }>>
  saving: boolean
  msg: string
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,14,14,0.45)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="admin-card" style={{ width: '100%', maxWidth: 480, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 className="admin-h1" style={{ fontSize: 18 }}>สร้างคูปองใหม่</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={18} color="var(--ink-mute)" />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input className="admin-field" placeholder="User ID (ว่าง = ส่งทุกคน)" value={form.user_id}
            onChange={e => setForm(s => ({ ...s, user_id: e.target.value }))} />
          <input className="admin-field" placeholder="ชื่อคูปอง *" value={form.title}
            onChange={e => setForm(s => ({ ...s, title: e.target.value }))} />
          <input className="admin-field" placeholder="รายละเอียด" value={form.description}
            onChange={e => setForm(s => ({ ...s, description: e.target.value }))} />
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="admin-field" value={form.discount_type}
              onChange={e => setForm(s => ({ ...s, discount_type: e.target.value }))} style={{ flex: 1 }}>
              <option value="PERCENT">เปอร์เซ็นต์ (%)</option>
              <option value="FIXED">จำนวนเงิน (฿)</option>
            </select>
            <input className="admin-field" type="number" placeholder="ส่วนลด *" value={form.discount_value}
              onChange={e => setForm(s => ({ ...s, discount_value: e.target.value }))} style={{ flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="admin-field" type="number" placeholder="ยอดขั้นต่ำ" value={form.min_purchase}
              onChange={e => setForm(s => ({ ...s, min_purchase: e.target.value }))} style={{ flex: 1 }} />
            <input className="admin-field" type="date" placeholder="หมดอายุ" value={form.valid_until}
              onChange={e => setForm(s => ({ ...s, valid_until: e.target.value }))} style={{ flex: 1 }} />
          </div>

          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-mute)', margin: '0 0 8px' }}>
              สีคูปอง
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {[
                { key: 'black',    bg: 'linear-gradient(135deg,#1A1815,#0E0E0E)' },
                { key: 'gold',     bg: 'linear-gradient(135deg,#EADBB1,#A0782B)' },
                { key: 'rose',     bg: 'linear-gradient(135deg,#F8C8D8,#D97A95)' },
                { key: 'lavender', bg: 'linear-gradient(135deg,#C5B5E8,#7B5AB8)' },
                { key: 'sage',     bg: 'linear-gradient(135deg,#B0CFB0,#5C8A5C)' },
                { key: 'coral',    bg: 'linear-gradient(135deg,#F9B9A0,#D9603F)' },
                { key: 'cream',    bg: 'linear-gradient(135deg,#FAF3DC,#D4B978)' },
                { key: 'navy',     bg: 'linear-gradient(135deg,#4A6E92,#1A2C45)' },
                { key: 'emerald',  bg: 'linear-gradient(135deg,#7DC9B0,#1F5C46)' },
              ].map(t => (
                <button key={t.key} type="button"
                  onClick={() => setForm(s => ({ ...s, theme: t.key }))}
                  style={{
                    aspectRatio: '1', borderRadius: 'var(--r-md)',
                    background: t.bg,
                    border: form.theme === t.key ? '2.5px solid var(--ink)' : '2.5px solid transparent',
                    cursor: 'pointer', position: 'relative',
                    boxShadow: form.theme === t.key ? '0 0 0 2px var(--gold), 0 4px 10px rgba(14,14,14,0.10)' : '0 2px 6px rgba(14,14,14,0.06)',
                    transition: 'all 0.15s ease', padding: 0,
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
          <button onClick={onClose} className="admin-btn admin-btn-ghost" style={{ flex: 1 }}>ยกเลิก</button>
          <button onClick={onSubmit} disabled={saving || !form.title || !form.discount_value || !form.valid_until}
            className="admin-btn admin-btn-ink" style={{ flex: 2 }}>
            {saving ? 'กำลังสร้าง...' : 'สร้าง'}
          </button>
        </div>
      </div>
    </div>
  )
}
