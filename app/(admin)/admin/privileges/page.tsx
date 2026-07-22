'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, Check, Sparkles, Phone, Store, Loader2, Bell, ChevronDown, ArrowDownUp, CalendarDays, Plus, Trash2, RotateCcw, X } from 'lucide-react'
import {
  effectiveStatus, daysBetween, formatThaiDate, countdownText,
  REMIND_DAYS_BEFORE, type RefillRound, type EffectiveRoundStatus,
} from '@/lib/refill'

interface Priv {
  id: string
  customer_name: string | null
  phone: string
  transaction_id: string | null
  model: string | null
  branch: string | null
  order_amount: number | null
  purchased_at: string
  total_rounds: number
  source?: string | null
  deleted_at?: string | null
  rounds: RefillRound[]
}

const EMPTY_FORM = { customer_name: '', phone: '', model: '', order_amount: '', purchased_at: '', branch: '' }

// สี + label ต่อสถานะ (compact chip)
const CHIP: Record<EffectiveRoundStatus, { bg: string; color: string; border: string; label: string }> = {
  claimed:   { bg: 'rgba(58,142,90,0.12)',  color: '#2E7A3D', border: 'rgba(58,142,90,0.30)',  label: 'รับแล้ว' },
  claimable: { bg: 'rgba(201,155,62,0.16)', color: '#B07823', border: 'rgba(201,155,62,0.40)', label: 'รับได้' },
  upcoming:  { bg: 'var(--admin-bg)',       color: 'var(--admin-ink-mute)', border: 'var(--admin-border)', label: '' },
  expired:   { bg: 'rgba(177,66,66,0.10)',  color: '#B14242', border: 'rgba(177,66,66,0.25)',  label: 'หมดสิทธิ' },
}

export default function AdminPrivilegesPage() {
  const [privs, setPrivs] = useState<Priv[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'due' | 'all' | 'trash'>('all')
  const [busy, setBusy] = useState<string | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [notMigrated, setNotMigrated] = useState(false)
  // เรียงตามวันที่ซื้อ (purchased_at) — เริ่มต้น ใหม่→เก่า
  const [sortDir, setSortDir] = useState<'new' | 'old'>('new')
  // เพิ่มสิทธิเอง
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  const isTrash = tab === 'trash'

  const load = useCallback(async (query: string, trash: boolean) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (trash) qs.set('deleted', '1')
      if (query) qs.set('q', query)
      const r = await fetch(`/api/admin/privileges${qs.toString() ? `?${qs}` : ''}`)
      const d = await r.json()
      setNotMigrated(!!d.not_migrated)
      setPrivs(d.privileges || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { const t = setTimeout(() => load(q, isTrash), 250); return () => clearTimeout(t) }, [q, isTrash, load])

  const act = useCallback(async (roundId: string, action: 'claim' | 'unclaim') => {
    setOpenMenu(null)
    setBusy(roundId)
    try {
      const r = await fetch(`/api/admin/privileges/${roundId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const d = await r.json()
      if (!r.ok) { alert(d.error || 'error'); return }
      setPrivs(prev => prev.map(p => ({
        ...p,
        rounds: p.rounds.map(rd => rd.id === roundId
          ? { ...rd, status: d.status, claimed_at: action === 'claim' ? new Date().toISOString() : null }
          : rd),
      })))
    } finally { setBusy(null) }
  }, [])

  const createPriv = useCallback(async () => {
    if (!form.phone.replace(/\D/g, '') || !form.purchased_at) {
      alert('กรุณากรอกเบอร์โทรและวันที่ซื้อ'); return
    }
    setSaving(true)
    try {
      const r = await fetch('/api/admin/privileges', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const d = await r.json()
      if (!r.ok) { alert(d.error || 'บันทึกไม่สำเร็จ'); return }
      setShowAdd(false); setForm({ ...EMPTY_FORM }); setTab('all'); load('', false)
    } finally { setSaving(false) }
  }, [form, load])

  const setDeleted = useCallback(async (id: string, action: 'delete' | 'restore') => {
    setOpenMenu(null)
    if (action === 'delete' && !confirm('ลบสิทธินี้? (กู้คืนได้จากถังขยะ)')) return
    setBusy(id)
    try {
      const r = await fetch('/api/admin/privileges', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }),
      })
      const d = await r.json()
      if (!r.ok) { alert(d.error || 'error'); return }
      setPrivs(prev => prev.filter(p => p.id !== id))  // หายจากมุมมองปัจจุบัน
    } finally { setBusy(null) }
  }, [])

  const dueQueue = useMemo(() => {
    const out: { p: Priv; r: RefillRound; days: number }[] = []
    for (const p of privs) for (const r of p.rounds) {
      const st = effectiveStatus(r); const days = daysBetween(r.due_date)
      if (st === 'claimable' || (st === 'upcoming' && days <= REMIND_DAYS_BEFORE)) out.push({ p, r, days })
    }
    return out.sort((a, b) => a.days - b.days)
  }, [privs])

  // เรียงตามวันที่ซื้อ (ฝั่ง client — โหลดมาแล้ว ≤500 แถว)
  const sortedPrivs = useMemo(() => {
    return [...privs].sort((a, b) => {
      const ta = new Date(a.purchased_at).getTime()
      const tb = new Date(b.purchased_at).getTime()
      return sortDir === 'new' ? tb - ta : ta - tb
    })
  }, [privs, sortDir])

  const stats = useMemo(() => {
    let claimable = 0, claimed = 0
    for (const p of privs) for (const r of p.rounds) {
      const st = effectiveStatus(r)
      if (st === 'claimable') claimable++
      if (st === 'claimed') claimed++
    }
    return { privs: privs.length, claimable, claimed }
  }, [privs])

  return (
    <div className="admin-shell" onClick={() => openMenu && setOpenMenu(null)}>
      <div className="admin-h" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Sparkles size={20} />
        <div>
          <h1 style={{ margin: 0 }}>สิทธิพิเศษ — น้ำยาฟรี</h1>
          <p className="admin-sub" style={{ margin: 0 }}>รับน้ำยาฟรีทุก 6 เดือน (4 รอบ/2 ปี) · คลิกที่รอบเพื่อเลือกสถานะ</p>
        </div>
        <button onClick={() => { setForm({ ...EMPTY_FORM }); setShowAdd(true) }}
          className="admin-btn admin-btn-ink" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} /> เพิ่มสิทธิ
        </button>
      </div>

      {notMigrated && (
        <div className="admin-card" style={{ padding: 14, borderColor: '#E0B84A', background: '#FBF4DE' }}>
          ⚠ ยังไม่ได้รัน migration <b>0039_refill_privileges.sql</b>
        </div>
      )}

      {/* stats — เฉพาะมุมมองใช้งาน (ไม่ใช่ถังขยะ) */}
      {!isTrash && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, margin: '12px 0' }}>
          <Stat label="ลูกค้า/ออเดอร์" value={stats.privs} />
          <Stat label="รับได้ตอนนี้" value={stats.claimable} accent="#B07823" />
          <Stat label="ครบกำหนด ≤5 วัน" value={dueQueue.length} accent="#2E7A3D" />
          <Stat label="รับไปแล้ว" value={stats.claimed} />
        </div>
      )}

      <div className="admin-field" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Search size={15} style={{ opacity: 0.5 }} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหา เบอร์ / ชื่อ / ออเดอร์ / รุ่น"
          style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontFamily: 'inherit', fontSize: 14 }} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'center' }}>
        {([
          ['all', `ทั้งหมด${!isTrash ? ` (${privs.length})` : ''}`],
          ['due', `คิวครบกำหนด${!isTrash ? ` (${dueQueue.length})` : ''}`],
          ['trash', `ถังขยะ${isTrash ? ` (${privs.length})` : ''}`],
        ] as [typeof tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? 'admin-btn admin-btn-ink' : 'admin-btn admin-btn-ghost'}>{label}</button>
        ))}
        {tab === 'all' && (
          <button onClick={() => setSortDir(d => (d === 'new' ? 'old' : 'new'))}
            className="admin-btn admin-btn-ghost" title="เรียงตามวันที่ซื้อ"
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
            <ArrowDownUp size={13} /> {sortDir === 'new' ? 'ใหม่ → เก่า' : 'เก่า → ใหม่'}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--admin-ink-mute)' }}><Loader2 className="animate-spin" style={{ margin: '0 auto' }} /></div>
      ) : tab === 'due' ? (
        <DueQueue queue={dueQueue} busy={busy} act={act} />
      ) : (
        <div className="admin-card" style={{ padding: 0, overflow: 'visible' }}>
          {privs.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: 'var(--admin-ink-mute)' }}>{isTrash ? 'ถังขยะว่าง' : 'ไม่พบข้อมูล'}</div>}
          {sortedPrivs.map((p, i) => (
            <PrivRow key={p.id} p={p} first={i === 0} busy={busy} trash={isTrash}
              openMenu={openMenu} setOpenMenu={setOpenMenu} act={act} setDeleted={setDeleted} />
          ))}
        </div>
      )}

      {showAdd && (
        <AddModal form={form} setForm={setForm} saving={saving}
          onClose={() => setShowAdd(false)} onSave={createPriv} />
      )}
    </div>
  )
}

function AddModal({ form, setForm, saving, onClose, onSave }: {
  form: typeof EMPTY_FORM
  setForm: (f: typeof EMPTY_FORM) => void
  saving: boolean
  onClose: () => void
  onSave: () => void
}) {
  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })
  const F = (label: string, k: keyof typeof EMPTY_FORM, opts: { type?: string; placeholder?: string; required?: boolean } = {}) => (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--admin-ink-mute)', marginBottom: 4 }}>
        {label}{opts.required && <span style={{ color: '#B14242' }}> *</span>}
      </span>
      <input className="admin-field" type={opts.type || 'text'} value={form[k]} onChange={set(k)}
        placeholder={opts.placeholder} style={{ width: '100%' }} />
    </label>
  )
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} className="admin-card" style={{ width: 'min(460px, 96vw)', padding: 20, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16, flex: 1 }}>เพิ่มสิทธิน้ำยาฟรี</h2>
          <button onClick={onClose} className="admin-btn admin-btn-ghost" style={{ padding: 6 }}><X size={15} /></button>
        </div>
        {F('เบอร์โทร', 'phone', { required: true, placeholder: '08x-xxx-xxxx' })}
        {F('วันที่ซื้อ', 'purchased_at', { required: true, type: 'date' })}
        {F('ชื่อลูกค้า', 'customer_name')}
        {F('รุ่นสินค้า', 'model', { placeholder: 'เช่น X50 Ultra' })}
        {F('ยอดซื้อ (บาท)', 'order_amount', { type: 'number', placeholder: '30000' })}
        {F('สาขา', 'branch')}
        <p style={{ fontSize: 11, color: 'var(--admin-ink-mute)', margin: '4px 0 14px' }}>
          ระบบจะสร้าง 4 รอบ (ทุก 6 เดือน) ให้อัตโนมัติจากวันที่ซื้อ
        </p>
        <button onClick={onSave} disabled={saving} className="admin-btn admin-btn-ink" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} บันทึกสิทธิ
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="admin-card" style={{ padding: '10px 14px' }}>
      <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: accent || 'var(--admin-ink)' }}>{value}</p>
      <p style={{ margin: '1px 0 0', fontSize: 10.5, color: 'var(--admin-ink-mute)' }}>{label}</p>
    </div>
  )
}

// ── แถวลูกค้า 1 บรรทัด: ข้อมูลซ้าย + 4 chip รอบขวา + ปุ่มลบ/กู้คืน ──
function PrivRow({ p, first, busy, trash, openMenu, setOpenMenu, act, setDeleted }: {
  p: Priv; first: boolean; busy: string | null; trash: boolean
  openMenu: string | null; setOpenMenu: (v: string | null) => void
  act: (id: string, a: 'claim' | 'unclaim') => void
  setDeleted: (id: string, a: 'delete' | 'restore') => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      padding: '10px 14px', borderTop: first ? 'none' : '1px solid var(--admin-border)',
    }}>
      <div style={{ flex: '1 1 240px', minWidth: 200 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 13.5 }}>{p.customer_name || '(ไม่มีชื่อ)'}</p>
        <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--admin-ink-mute)', display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 600, color: 'var(--admin-ink)' }}><CalendarDays size={10} />{formatThaiDate(p.purchased_at)}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: 'var(--font-mono)' }}><Phone size={10} />0{p.phone}</span>
          {p.model && <span>{p.model}</span>}
          {p.transaction_id && <span style={{ fontFamily: 'var(--font-mono)' }}>#{p.transaction_id}</span>}
          {p.branch && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Store size={10} />{p.branch}</span>}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {p.rounds.map(r => (
          <RoundChip key={r.id} r={r} busy={busy === r.id}
            open={openMenu === r.id}
            onToggle={() => setOpenMenu(openMenu === r.id ? null : r.id)}
            act={act} />
        ))}
      </div>
      <div onClick={e => e.stopPropagation()} style={{ marginLeft: 'auto' }}>
        {trash ? (
          <button onClick={() => setDeleted(p.id, 'restore')} disabled={busy === p.id}
            className="admin-btn admin-btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#2E7A3D' }}>
            {busy === p.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} กู้คืน
          </button>
        ) : (
          <button onClick={() => setDeleted(p.id, 'delete')} disabled={busy === p.id}
            className="admin-btn admin-btn-ghost" title="ลบสิทธิ (กู้คืนได้)"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B14242', padding: 8 }}>
            {busy === p.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        )}
      </div>
    </div>
  )
}

// ── chip รอบเดียว + เมนูเลือกสถานะ ──
function RoundChip({ r, busy, open, onToggle, act }: {
  r: RefillRound; busy: boolean; open: boolean
  onToggle: () => void; act: (id: string, a: 'claim' | 'unclaim') => void
}) {
  const st = effectiveStatus(r)
  const meta = CHIP[st]
  const days = daysBetween(r.due_date)
  const sub = st === 'upcoming' ? countdownText(days) : meta.label

  return (
    <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
      <button onClick={onToggle} className="tap-down" style={{
        display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
        border: `1px solid ${meta.border}`, background: meta.bg, color: meta.color,
        borderRadius: 9, padding: '5px 9px', minWidth: 104, fontFamily: 'inherit',
      }}>
        <div style={{ flex: 1, textAlign: 'left', lineHeight: 1.25 }}>
          <div style={{ fontSize: 11, fontWeight: 700 }}>รอบ {r.round_no}{sub && <span style={{ fontWeight: 600 }}> · {sub}</span>}</div>
          <div style={{ fontSize: 10, opacity: 0.8 }}>{formatThaiDate(r.due_date)}</div>
        </div>
        {busy ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={12} style={{ opacity: 0.6 }} />}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50,
          minWidth: 168, background: 'var(--admin-card)', border: '1px solid var(--admin-border)',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden', padding: 4,
        }}>
          <MenuItem active={st === 'claimed'} color="#2E7A3D" icon={<Check size={13} />}
            label="รับแล้ว" onClick={() => act(r.id, 'claim')} />
          <MenuItem active={st !== 'claimed'} color="var(--admin-ink-mute)" icon={<span style={{ width: 13, textAlign: 'center' }}>○</span>}
            label="ยังไม่รับ (คืนสถานะ)" onClick={() => act(r.id, 'unclaim')} />
        </div>
      )}
    </div>
  )
}

function MenuItem({ active, color, icon, label, onClick }: {
  active: boolean; color: string; icon: React.ReactNode; label: string; onClick: () => void
}) {
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
      padding: '8px 10px', borderRadius: 7, border: 'none', fontFamily: 'inherit', fontSize: 12.5,
      background: active ? 'var(--admin-bg)' : 'transparent',
      color, fontWeight: active ? 700 : 500, textAlign: 'left',
    }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--admin-bg)')}
      onMouseLeave={e => (e.currentTarget.style.background = active ? 'var(--admin-bg)' : 'transparent')}>
      {icon}
      <span style={{ flex: 1 }}>{label}</span>
      {active && <Check size={12} style={{ opacity: 0.7 }} />}
    </button>
  )
}

// ── คิวครบกำหนด (compact rows) ──
function DueQueue({ queue, busy, act }: {
  queue: { p: Priv; r: RefillRound; days: number }[]
  busy: string | null; act: (id: string, a: 'claim' | 'unclaim') => void
}) {
  if (queue.length === 0) return <div className="admin-card" style={{ padding: 28, textAlign: 'center', color: 'var(--admin-ink-mute)' }}>ไม่มีรอบที่ครบกำหนดใน 5 วัน 🎉</div>
  return (
    <div className="admin-card" style={{ padding: 0 }}>
      {queue.map(({ p, r, days }, i) => {
        const claimable = effectiveStatus(r) === 'claimable'
        return (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: i === 0 ? 'none' : '1px solid var(--admin-border)', borderLeft: `3px solid ${claimable ? '#2E7A3D' : '#B07823'}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{p.customer_name || '(ไม่มีชื่อ)'} · <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>0{p.phone}</span></p>
              <p style={{ margin: '1px 0 0', fontSize: 11.5, color: 'var(--admin-ink-mute)' }}>
                {p.model || 'ออเดอร์'} · รอบ {r.round_no}/{p.total_rounds} · {claimable
                  ? <b style={{ color: '#2E7A3D' }}>รับได้ถึง {formatThaiDate(r.claim_close)}</b>
                  : <b style={{ color: '#B07823' }}>{countdownText(days)} ({formatThaiDate(r.due_date)})</b>}
              </p>
            </div>
            {claimable ? (
              <button className="admin-btn admin-btn-gold" disabled={busy === r.id} onClick={() => act(r.id, 'claim')}>
                {busy === r.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} ติ๊กรับแล้ว
              </button>
            ) : <span className="admin-pill admin-pill-amber"><Bell size={11} /> รอถึงกำหนด</span>}
          </div>
        )
      })}
    </div>
  )
}
