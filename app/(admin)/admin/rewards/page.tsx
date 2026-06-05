'use client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Gift, Plus, Search, RefreshCw, AlertCircle, CheckCircle,
  ChevronRight, Package, Layers, X, Pencil, Trash2, Upload, ImageIcon,
} from 'lucide-react'

interface Model {
  id: string; name: string; slug: string | null
  description: string | null; image_url: string | null
  display_order: number; is_active: boolean
}

type RedeemType = 'POINTS_CASH' | 'VOUCHER' | 'PREMIUM'

interface Reward {
  id: string
  model_id: string | null
  name: string
  short_description: string | null
  description: string | null
  image_url: string | null
  images: string[]
  points_required: number
  stock: number | null
  stock_remaining: number | null
  allowed_tiers: string[]
  terms: string | null
  redemption_limit_per_user: number | null
  starts_at: string | null
  ends_at: string | null
  status: 'active' | 'paused' | 'archived' | 'draft'
  is_featured: boolean
  display_order: number
  reward_models: { id: string; name: string; slug: string } | null
  // 3 redemption modes
  redeem_type: RedeemType
  cash_top_up_thb: number | null
  original_price_thb: number | null
  voucher_value_thb: number | null
  voucher_min_purchase_thb: number | null
  shopify_product_url: string | null
  shopify_product_id: number | null
  shopify_variant_id: number | null
  code_validity_days: number | null
}

type StatusFilter = 'all' | 'active' | 'paused' | 'draft' | 'archived'

export default function AdminRewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([])
  const [counts, setCounts] = useState<Record<string, { total: number; pending: number; delivered: number }>>({})
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [modelFilter, setModelFilter] = useState<string>('')
  const [editing, setEditing] = useState<Reward | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showModels, setShowModels] = useState(false)

  async function load() {
    setLoading(true); setError('')
    try {
      const [r, m] = await Promise.all([
        fetch('/api/admin/rewards').then(r => r.json()),
        fetch('/api/admin/reward-models').then(r => r.json()),
      ])
      if (r.error) throw new Error(r.error)
      setRewards(r.rewards || [])
      setCounts(r.counts || {})
      setModels(m.models || [])
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    let list = rewards
    if (filter !== 'all')  list = list.filter(r => r.status === filter)
    if (modelFilter)       list = list.filter(r => r.model_id === modelFilter)
    if (q) {
      const k = q.toLowerCase()
      list = list.filter(r => r.name.toLowerCase().includes(k))
    }
    return list
  }, [rewards, filter, modelFilter, q])

  const summary = useMemo(() => ({
    total:     rewards.length,
    active:    rewards.filter(r => r.status === 'active').length,
    pending:   Object.values(counts).reduce((s, c) => s + c.pending, 0),
    delivered: Object.values(counts).reduce((s, c) => s + c.delivered, 0),
  }), [rewards, counts])

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--admin-bg)' }}>
      {/* Breadcrumb */}
      <div className="border-b flex-shrink-0"
        style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <div className="px-6 lg:px-8 h-11 flex items-center gap-2 text-sm">
          <Link href="/admin" className="hover:opacity-70" style={{ color: 'var(--admin-ink-mute)' }}>Dashboard</Link>
          <ChevronRight size={12} style={{ color: 'var(--admin-ink-faint)' }} />
          <span className="font-medium" style={{ color: 'var(--admin-ink)' }}>Redeem rewards</span>
        </div>
      </div>

      {/* Header */}
      <header className="border-b flex-shrink-0"
        style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <div className="px-6 lg:px-8 py-5 flex items-start justify-between gap-4">
          <div>
            <p style={{ color: '#C99B3E', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 4 }}>
              Loyalty Catalog
            </p>
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--admin-ink)' }}>
              <Gift size={20} style={{ color: '#C99B3E' }} /> สินค้าแลกแต้ม
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--admin-ink-mute)' }}>
              {summary.total} สินค้า · {summary.active} active · pending {summary.pending} · ส่งแล้ว {summary.delivered}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link href="/admin/redemptions" className="admin-btn admin-btn-ghost">
              <Package size={13} /> Redemptions
            </Link>
            <button onClick={() => setShowModels(true)} className="admin-btn admin-btn-ghost">
              <Layers size={13} /> Models ({models.length})
            </button>
            <button onClick={() => setShowCreate(true)} className="admin-btn admin-btn-ink">
              <Plus size={13} /> สร้างสินค้า
            </button>
          </div>
        </div>
      </header>

      {/* Filter strip */}
      <div className="border-b flex-shrink-0"
        style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <div className="px-6 lg:px-8 py-3 flex gap-2 items-center flex-wrap">
          <div className="flex gap-1 flex-wrap">
            {([
              { k: 'all',      label: 'ทั้งหมด' },
              { k: 'active',   label: 'Active' },
              { k: 'paused',   label: 'Paused' },
              { k: 'draft',    label: 'Draft' },
              { k: 'archived', label: 'Archived' },
            ] as const).map(f => {
              const active = filter === f.k
              return (
                <button key={f.k} onClick={() => setFilter(f.k)}
                  className={`admin-btn ${active ? 'admin-btn-ink' : 'admin-btn-ghost'}`}
                  style={{ padding: '5px 12px', fontSize: 12 }}>{f.label}</button>
              )
            })}
          </div>
          <select value={modelFilter} onChange={e => setModelFilter(e.target.value)}
            className="admin-field" style={{ width: 'auto', fontSize: 12 }}>
            <option value="">ทุก Model</option>
            {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--admin-ink-faint)' }} />
            <input value={q} onChange={e => setQ(e.target.value)}
              placeholder="ค้นหาชื่อสินค้า..."
              className="admin-field" style={{ paddingLeft: 34 }} />
          </div>
        </div>
      </div>

      {error && (
        <div className="px-6 lg:px-8 pt-3 flex-shrink-0">
          <div className="admin-card p-3 flex items-start gap-2"
            style={{ background: '#FBE9E9', borderColor: '#E8B4B4', color: '#B14242' }}>
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <p className="text-xs">{error}</p>
          </div>
        </div>
      )}

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-5">
        {loading && rewards.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--admin-ink-mute)' }}>
            <RefreshCw size={20} className="mx-auto mb-2 animate-spin" /> โหลด…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--admin-ink-mute)' }}>
            <Gift size={32} className="mx-auto mb-2" style={{ color: 'var(--admin-ink-faint)' }} />
            <p className="text-sm">ยังไม่มีสินค้าแลกแต้ม</p>
            <button onClick={() => setShowCreate(true)} className="admin-btn admin-btn-ink mt-3">
              <Plus size={13} /> สร้างสินค้าแรก
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(r => (
              <RewardCard key={r.id} r={r}
                stats={counts[r.id]}
                onEdit={() => setEditing(r)} />
            ))}
          </div>
        )}
      </div>

      {(showCreate || editing) && (
        <RewardFormModal
          editing={editing}
          models={models}
          onClose={() => { setShowCreate(false); setEditing(null) }}
          onSaved={() => { setShowCreate(false); setEditing(null); load() }}
        />
      )}

      {showModels && (
        <ModelsModal
          models={models}
          onClose={() => setShowModels(false)}
          onChanged={load}
        />
      )}
    </div>
  )
}

// ============================================================
// Reward card
// ============================================================
function RewardCard({ r, stats, onEdit }: {
  r: Reward; stats?: { total: number; pending: number; delivered: number }
  onEdit: () => void
}) {
  return (
    <div className="admin-card overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      onClick={onEdit}>
      {/* Image */}
      <div className="aspect-video relative" style={{ background: 'var(--admin-bg)' }}>
        {r.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.image_url} alt={r.name}
            className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--admin-ink-faint)' }}>
            <Gift size={32} />
          </div>
        )}
        {/* Featured + status badge */}
        <div className="absolute top-2 left-2 flex gap-1">
          {r.is_featured && <span className="admin-pill admin-pill-amber" style={{ fontSize: 9 }}>⭐ Featured</span>}
          {r.status === 'paused'   && <span className="admin-pill" style={{ fontSize: 9 }}>Paused</span>}
          {r.status === 'draft'    && <span className="admin-pill" style={{ fontSize: 9 }}>Draft</span>}
          {r.status === 'archived' && <span className="admin-pill admin-pill-red" style={{ fontSize: 9 }}>Archived</span>}
        </div>
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate" style={{ color: 'var(--admin-ink)' }}>{r.name}</p>
            {r.reward_models && (
              <p className="text-[10px]" style={{ color: 'var(--admin-ink-faint)' }}>
                {r.reward_models.name}
              </p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-base font-bold tabular-nums" style={{ color: '#C99B3E' }}>
              {r.points_required.toLocaleString()}
            </p>
            <p className="text-[9px]" style={{ color: 'var(--admin-ink-faint)' }}>แต้ม</p>
          </div>
        </div>

        {/* Allowed tiers */}
        <div className="flex gap-1 flex-wrap">
          {r.allowed_tiers.map(t => (
            <span key={t} className="admin-pill" style={{ fontSize: 9 }}>{t}</span>
          ))}
        </div>

        {/* Stock + stats */}
        <div className="grid grid-cols-3 gap-1 text-center pt-2"
          style={{ borderTop: '1px solid var(--admin-border-2)' }}>
          <Stat label="Stock"
            value={r.stock === null ? '∞' : `${r.stock_remaining}/${r.stock}`} />
          <Stat label="Pending" value={stats?.pending ?? 0} color={(stats?.pending ?? 0) > 0 ? '#C99B3E' : undefined} />
          <Stat label="ส่งแล้ว" value={stats?.delivered ?? 0} color="#3A8E5A" />
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div>
      <p className="text-sm font-bold tabular-nums" style={{ color: color || 'var(--admin-ink)' }}>{value}</p>
      <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--admin-ink-mute)' }}>{label}</p>
    </div>
  )
}

// ============================================================
// Reward form (create + edit)
// ============================================================
const TIERS = ['SILVER', 'GOLD', 'PLATINUM']

function RewardFormModal({ editing, models, onClose, onSaved }: {
  editing: Reward | null; models: Model[]
  onClose: () => void; onSaved: () => void
}) {
  const isEdit = !!editing
  const [form, setForm] = useState({
    model_id:                  editing?.model_id || '',
    name:                      editing?.name || '',
    short_description:         editing?.short_description || '',
    description:               editing?.description || '',
    image_url:                 editing?.image_url || '',
    points_required:           editing?.points_required ?? 100,
    stock:                     editing?.stock ?? '' as number | '',
    allowed_tiers:             editing?.allowed_tiers || TIERS,
    terms:                     editing?.terms || '',
    redemption_limit_per_user: editing?.redemption_limit_per_user ?? '' as number | '',
    starts_at:                 editing?.starts_at?.split('T')[0] || '',
    ends_at:                   editing?.ends_at?.split('T')[0] || '',
    status:                    editing?.status || 'active',
    is_featured:               editing?.is_featured || false,
    // 3 redemption modes
    redeem_type:               (editing?.redeem_type || 'PREMIUM') as RedeemType,
    cash_top_up_thb:           editing?.cash_top_up_thb ?? '' as number | '',
    original_price_thb:        editing?.original_price_thb ?? '' as number | '',
    voucher_value_thb:         editing?.voucher_value_thb ?? '' as number | '',
    voucher_min_purchase_thb:  editing?.voucher_min_purchase_thb ?? 0 as number | '',
    shopify_product_url:       editing?.shopify_product_url || '',
    code_validity_days:        editing?.code_validity_days ?? 30,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }
  function toggleTier(t: string) {
    set('allowed_tiers', form.allowed_tiers.includes(t)
      ? form.allowed_tiers.filter(x => x !== t)
      : [...form.allowed_tiers, t])
  }

  async function save() {
    setError(''); setSaving(true)
    try {
      if (!form.name.trim()) throw new Error('ระบุชื่อสินค้า')
      if (form.allowed_tiers.length === 0) throw new Error('เลือกอย่างน้อย 1 tier')

      // ── Validate ตาม redeem_type ──
      if (form.redeem_type === 'POINTS_CASH') {
        if (!form.cash_top_up_thb || Number(form.cash_top_up_thb) <= 0) {
          throw new Error('Points + Cash ต้องระบุยอดเงินสดที่ user จะจ่าย')
        }
        if (!form.original_price_thb || Number(form.original_price_thb) <= 0) {
          throw new Error('ระบุราคาสินค้าจริงใน Shopify (สำหรับคำนวณส่วนลด)')
        }
        if (Number(form.cash_top_up_thb) >= Number(form.original_price_thb)) {
          throw new Error('ยอดเงินสดต้องน้อยกว่าราคาสินค้า')
        }
        if (!form.shopify_product_url.trim()) {
          throw new Error('ระบุ link product ใน Shopify')
        }
      }
      if (form.redeem_type === 'VOUCHER') {
        if (!form.voucher_value_thb || Number(form.voucher_value_thb) <= 0) {
          throw new Error('Voucher ต้องระบุมูลค่าคูปอง')
        }
      }

      const payload = {
        ...form,
        model_id: form.model_id || null,
        points_required: Number(form.points_required),
        stock: form.stock === '' ? null : Number(form.stock),
        redemption_limit_per_user: form.redemption_limit_per_user === '' ? null : Number(form.redemption_limit_per_user),
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        ends_at:   form.ends_at   ? new Date(form.ends_at).toISOString()   : null,
        // Cast numbers
        cash_top_up_thb:    form.cash_top_up_thb    === '' ? null : Number(form.cash_top_up_thb),
        original_price_thb: form.original_price_thb === '' ? null : Number(form.original_price_thb),
        voucher_value_thb:  form.voucher_value_thb  === '' ? null : Number(form.voucher_value_thb),
        voucher_min_purchase_thb: form.voucher_min_purchase_thb === '' ? null : Number(form.voucher_min_purchase_thb),
        shopify_product_url: form.shopify_product_url.trim() || null,
        code_validity_days:  Number(form.code_validity_days) || 30,
      }
      const r = await fetch(isEdit ? `/api/admin/rewards/${editing!.id}` : '/api/admin/rewards', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      onSaved()
    } catch (e) { setError((e as Error).message); setSaving(false) }
  }

  async function archive() {
    if (!editing) return
    setSaving(true)
    const r = await fetch(`/api/admin/rewards/${editing.id}`, { method: 'DELETE' })
    if (r.ok) onSaved()
    else { setSaving(false); setConfirmDel(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(14,14,14,0.45)', backdropFilter: 'blur(6px)' }}>
      <div className="admin-card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-start justify-between sticky top-0 z-10"
          style={{ borderColor: 'var(--admin-border)', background: 'var(--admin-card)' }}>
          <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--admin-ink)' }}>
            <Gift size={16} style={{ color: '#C99B3E' }} />
            {isEdit ? 'แก้ไขสินค้า' : 'สร้างสินค้าใหม่'}
          </h3>
          <button onClick={onClose} style={{ color: 'var(--admin-ink-faint)' }}><X size={16}/></button>
        </div>

        <div className="p-5 space-y-4">
          {/* ── Redeem type selector ── */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'var(--admin-ink-mute)' }}>
              ประเภทการแลก *
            </p>
            <div className="grid grid-cols-3 gap-2">
              <TypeOption
                active={form.redeem_type === 'POINTS_CASH'}
                onClick={() => set('redeem_type', 'POINTS_CASH')}
                emoji="💰" title="Points + Cash"
                desc="แต้ม + เงินสด → สินค้า" />
              <TypeOption
                active={form.redeem_type === 'VOUCHER'}
                onClick={() => set('redeem_type', 'VOUCHER')}
                emoji="🎟️" title="Voucher"
                desc="แต้ม → คูปองส่วนลด" />
              <TypeOption
                active={form.redeem_type === 'PREMIUM'}
                onClick={() => set('redeem_type', 'PREMIUM')}
                emoji="🎁" title="Premium Gift"
                desc="แต้มล้วน → ของแถม" />
            </div>
          </div>

          <Field label="ชื่อสินค้า *">
            <input className="admin-field w-full" value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder={
                form.redeem_type === 'POINTS_CASH' ? 'เช่น Dreame F20' :
                form.redeem_type === 'VOUCHER'     ? 'เช่น ส่วนลด ฿200' :
                                                     'เช่น Dreame Storage Bag'
              } />
          </Field>

          {/* ── Type-specific fields ── */}
          {form.redeem_type === 'POINTS_CASH' && (
            <div className="rounded-lg p-3 space-y-3"
              style={{ background: 'rgba(201,155,62,0.06)', border: '1px solid rgba(201,155,62,0.25)' }}>
              <p className="text-[10.5px] font-semibold flex items-center gap-1"
                style={{ color: '#C99B3E' }}>
                💰 ค่า Points + Cash
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="ราคาสินค้าจริงใน Shopify (฿)">
                  <input className="admin-field w-full" type="number" min={1}
                    value={form.original_price_thb}
                    onChange={e => set('original_price_thb', e.target.value === '' ? '' : Number(e.target.value) as never)}
                    placeholder="เช่น 9,000" />
                </Field>
                <Field label="ลูกค้าจ่ายเพิ่ม (฿) *">
                  <input className="admin-field w-full" type="number" min={1}
                    value={form.cash_top_up_thb}
                    onChange={e => set('cash_top_up_thb', e.target.value === '' ? '' : Number(e.target.value) as never)}
                    placeholder="เช่น 4,809" />
                </Field>
              </div>
              {form.original_price_thb !== '' && form.cash_top_up_thb !== '' && (
                <p className="text-[11px]" style={{ color: 'var(--admin-ink-mute)' }}>
                  → ส่วนลดที่จะออก code: <b>฿{(Number(form.original_price_thb) - Number(form.cash_top_up_thb)).toLocaleString()}</b>
                </p>
              )}
              <Field label="Link สินค้าใน Shopify *">
                <input className="admin-field w-full" value={form.shopify_product_url}
                  onChange={e => set('shopify_product_url', e.target.value)}
                  placeholder="https://dreame-thailand.com/products/dreame-f20" />
              </Field>
              <Field label="Code หมดอายุภายใน (วัน)">
                <input className="admin-field w-full" type="number" min={1} max={365}
                  value={form.code_validity_days}
                  onChange={e => set('code_validity_days', Number(e.target.value) as never)} />
              </Field>
            </div>
          )}

          {form.redeem_type === 'VOUCHER' && (
            <div className="rounded-lg p-3 space-y-3"
              style={{ background: 'rgba(74,123,193,0.06)', border: '1px solid rgba(74,123,193,0.25)' }}>
              <p className="text-[10.5px] font-semibold flex items-center gap-1"
                style={{ color: '#4A7BC1' }}>
                🎟️ ค่า Voucher
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="มูลค่าคูปอง (฿) *">
                  <input className="admin-field w-full" type="number" min={1}
                    value={form.voucher_value_thb}
                    onChange={e => set('voucher_value_thb', e.target.value === '' ? '' : Number(e.target.value) as never)}
                    placeholder="เช่น 200" />
                </Field>
                <Field label="ขั้นต่ำการใช้ (฿)">
                  <input className="admin-field w-full" type="number" min={0}
                    value={form.voucher_min_purchase_thb}
                    onChange={e => set('voucher_min_purchase_thb', e.target.value === '' ? '' : Number(e.target.value) as never)}
                    placeholder="0 = ไม่จำกัด" />
                </Field>
              </div>
              <Field label="Code หมดอายุภายใน (วัน)">
                <input className="admin-field w-full" type="number" min={1} max={365}
                  value={form.code_validity_days}
                  onChange={e => set('code_validity_days', Number(e.target.value) as never)} />
              </Field>
            </div>
          )}

          {form.redeem_type === 'PREMIUM' && (
            <div className="rounded-lg p-3"
              style={{ background: 'rgba(58,142,90,0.06)', border: '1px solid rgba(58,142,90,0.25)' }}>
              <p className="text-[11px]" style={{ color: '#3A8E5A' }}>
                🎁 <b>Premium Gift</b> — Admin จัดส่งสินค้าให้ user เอง ไม่ generate code ใน Shopify
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Model / หมวด">
              <select className="admin-field w-full" value={form.model_id}
                onChange={e => set('model_id', e.target.value)}>
                <option value="">— ไม่กำหนด —</option>
                {models.filter(m => m.is_active).map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </Field>
            <Field label="แต้มที่ใช้ *">
              <input className="admin-field w-full" type="number" min={1} value={form.points_required}
                onChange={e => set('points_required', Number(e.target.value) as never)} />
            </Field>
          </div>

          <Field label="คำอธิบายสั้น">
            <input className="admin-field w-full" value={form.short_description}
              onChange={e => set('short_description', e.target.value)}
              placeholder="แสดงในการ์ดสินค้า — ไม่เกิน 100 ตัวอักษร" />
          </Field>

          <Field label="รายละเอียดเต็ม">
            <textarea className="admin-field w-full" rows={3} value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="คุณสมบัติ specification..." />
          </Field>

          <Field label="รูปสินค้า">
            <ImageUploadField
              value={form.image_url}
              onChange={url => set('image_url', url)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Stock (ว่าง = unlimited)">
              <input className="admin-field w-full" type="number" min={0} value={form.stock}
                onChange={e => set('stock', e.target.value === '' ? '' : Number(e.target.value) as never)} />
            </Field>
            <Field label="จำกัดต่อคน (ว่าง = ไม่จำกัด)">
              <input className="admin-field w-full" type="number" min={1}
                value={form.redemption_limit_per_user}
                onChange={e => set('redemption_limit_per_user',
                  e.target.value === '' ? '' : Number(e.target.value) as never)} />
            </Field>
          </div>

          <Field label="ระดับสมาชิกที่แลกได้ *">
            <div className="flex gap-2">
              {TIERS.map(t => (
                <button key={t} onClick={() => toggleTier(t)}
                  className="admin-btn"
                  style={{
                    padding: '6px 14px',
                    background: form.allowed_tiers.includes(t) ? 'var(--admin-ink)' : 'transparent',
                    color: form.allowed_tiers.includes(t) ? '#E8C58C' : 'var(--admin-ink-mute)',
                    borderColor: form.allowed_tiers.includes(t) ? 'var(--admin-ink)' : 'var(--admin-border)',
                  }}>
                  {t}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="เริ่มแลกได้">
              <input className="admin-field w-full" type="date" value={form.starts_at}
                onChange={e => set('starts_at', e.target.value)} />
            </Field>
            <Field label="หมดเขต">
              <input className="admin-field w-full" type="date" value={form.ends_at}
                onChange={e => set('ends_at', e.target.value)} />
            </Field>
          </div>

          <Field label="เงื่อนไขการแลก">
            <textarea className="admin-field w-full" rows={3} value={form.terms}
              onChange={e => set('terms', e.target.value)}
              placeholder="• เงื่อนไขสามารถเปลี่ยนได้โดยไม่ต้องแจ้งล่วงหน้า&#10;• จัดส่งภายใน 14 วันทำการ&#10;• ไม่สามารถเปลี่ยน/คืนได้" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="สถานะ">
              <select className="admin-field w-full" value={form.status}
                onChange={e => set('status', e.target.value as never)}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <label className="flex items-center gap-2 mt-6 cursor-pointer"
              style={{ color: 'var(--admin-ink)' }}>
              <input type="checkbox" checked={form.is_featured}
                onChange={e => set('is_featured', e.target.checked)} />
              <span className="text-xs">⭐ Featured (โชว์ก่อน)</span>
            </label>
          </div>

          {error && (
            <div className="p-2 rounded text-xs"
              style={{ background: '#FBE9E9', color: '#B14242', border: '1px solid #E8B4B4' }}>{error}</div>
          )}
        </div>

        <div className="px-5 py-3 border-t flex gap-2 sticky bottom-0"
          style={{ borderColor: 'var(--admin-border)', background: 'var(--admin-card)' }}>
          {isEdit && !confirmDel && (
            <button onClick={() => setConfirmDel(true)} className="admin-btn admin-btn-danger">
              <Trash2 size={11} /> Archive
            </button>
          )}
          {isEdit && confirmDel && (
            <button onClick={archive} disabled={saving} className="admin-btn admin-btn-danger"
              style={{ background: '#B14242', color: '#fff', borderColor: '#B14242' }}>
              ยืนยัน Archive?
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="admin-btn admin-btn-ghost">ยกเลิก</button>
          <button onClick={save} disabled={saving} className="admin-btn admin-btn-ink">
            {saving ? <RefreshCw size={11} className="animate-spin" /> : <CheckCircle size={11} />}
            {isEdit ? 'บันทึก' : 'สร้าง'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: 'var(--admin-ink-mute)' }}>{label}</span>
      {children}
    </label>
  )
}

// ============================================================
// Models modal — manage reward_models
// ============================================================
function ModelsModal({ models, onClose, onChanged }: {
  models: Model[]; onClose: () => void; onChanged: () => void
}) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  async function add() {
    if (!name.trim()) return
    setSaving(true)
    await fetch('/api/admin/reward-models', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    setName(''); setSaving(false); onChanged()
  }

  async function rename(id: string) {
    if (!editingName.trim()) { setEditingId(null); return }
    await fetch(`/api/admin/reward-models/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: editingName.trim() }),
    })
    setEditingId(null); onChanged()
  }

  async function archive(id: string) {
    await fetch(`/api/admin/reward-models/${id}`, { method: 'DELETE' })
    onChanged()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(14,14,14,0.45)', backdropFilter: 'blur(6px)' }}>
      <div className="admin-card max-w-md w-full">
        <div className="p-5 border-b flex items-start justify-between"
          style={{ borderColor: 'var(--admin-border)' }}>
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--admin-ink)' }}>
              <Layers size={16} /> Models
            </h3>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--admin-ink-mute)' }}>
              จัดหมวดสินค้าให้ user เลือกได้ง่าย
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--admin-ink-faint)' }}><X size={16}/></button>
        </div>

        <div className="p-5 space-y-3">
          <div className="flex gap-2">
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="เช่น D30 Series"
              className="admin-field flex-1"
              onKeyDown={e => e.key === 'Enter' && add()} />
            <button onClick={add} disabled={saving || !name.trim()} className="admin-btn admin-btn-ink">
              <Plus size={11} /> เพิ่ม
            </button>
          </div>

          {models.length === 0 ? (
            <p className="text-center text-xs py-6" style={{ color: 'var(--admin-ink-faint)' }}>
              ยังไม่มี model — เพิ่มข้างบน
            </p>
          ) : (
            <div className="space-y-1">
              {models.map(m => (
                <div key={m.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{
                    background: m.is_active ? 'var(--admin-bg)' : 'transparent',
                    opacity: m.is_active ? 1 : 0.5,
                  }}>
                  {editingId === m.id ? (
                    <input value={editingName} onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && rename(m.id)}
                      autoFocus className="admin-field flex-1" style={{ fontSize: 12 }} />
                  ) : (
                    <p className="text-xs font-medium flex-1" style={{ color: 'var(--admin-ink)' }}>
                      {m.name}
                    </p>
                  )}
                  {editingId === m.id ? (
                    <button onClick={() => rename(m.id)} className="admin-pill admin-pill-green">
                      <CheckCircle size={9} />
                    </button>
                  ) : (
                    <>
                      <button onClick={() => { setEditingId(m.id); setEditingName(m.name) }}
                        className="text-[10px]" style={{ color: 'var(--admin-ink-mute)' }}>
                        <Pencil size={11} />
                      </button>
                      {m.is_active && (
                        <button onClick={() => archive(m.id)}
                          className="text-[10px]" style={{ color: '#B14242' }}>
                          <Trash2 size={11} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t" style={{ borderColor: 'var(--admin-border)' }}>
          <button onClick={onClose} className="admin-btn admin-btn-ghost w-full">ปิด</button>
        </div>
      </div>
    </div>
  )
}


// ============================================================
// Image upload field — drag-drop + click + URL paste fallback
// ============================================================
function ImageUploadField({ value, onChange }: {
  value: string; onChange: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [mode, setMode] = useState<'upload' | 'url'>(value && value.startsWith('http') ? 'url' : 'upload')

  async function uploadFile(file: File) {
    setError(''); setUploading(true)
    try {
      if (!file.type.startsWith('image/')) throw new Error('รองรับเฉพาะรูปภาพ')
      if (file.size > 10 * 1024 * 1024) throw new Error('ไฟล์ใหญ่เกิน 10MB')
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch('/api/admin/rewards/upload-image', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'upload failed')
      onChange(d.url)
    } catch (e) { setError((e as Error).message) }
    finally { setUploading(false) }
  }

  return (
    <div>
      {/* Mode toggle */}
      <div className="flex gap-1 mb-2">
        <button type="button" onClick={() => setMode('upload')}
          className="admin-btn"
          style={{
            padding: '4px 10px', fontSize: 10.5,
            background: mode === 'upload' ? 'var(--admin-ink)' : 'transparent',
            color:      mode === 'upload' ? '#E8C58C' : 'var(--admin-ink-mute)',
            borderColor: mode === 'upload' ? 'var(--admin-ink)' : 'var(--admin-border)',
          }}>
          <Upload size={10} /> อัปโหลดไฟล์
        </button>
        <button type="button" onClick={() => setMode('url')}
          className="admin-btn"
          style={{
            padding: '4px 10px', fontSize: 10.5,
            background: mode === 'url' ? 'var(--admin-ink)' : 'transparent',
            color:      mode === 'url' ? '#E8C58C' : 'var(--admin-ink-mute)',
            borderColor: mode === 'url' ? 'var(--admin-ink)' : 'var(--admin-border)',
          }}>
          <ImageIcon size={10} /> ใส่ URL
        </button>
      </div>

      {mode === 'url' ? (
        <input className="admin-field w-full" value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="https://..." />
      ) : (
        <label
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault(); setDragOver(false)
            const file = e.dataTransfer.files[0]
            if (file) uploadFile(file)
          }}
          className="block cursor-pointer rounded-lg transition-colors"
          style={{
            border: `2px dashed ${dragOver ? 'var(--admin-gold)' : 'var(--admin-border)'}`,
            background: dragOver ? 'rgba(201,155,62,0.06)' : 'var(--admin-bg)',
            padding: 14,
          }}>
          <input type="file" accept="image/*" hidden disabled={uploading}
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) uploadFile(f)
            }} />
          <div className="flex flex-col items-center text-center gap-1">
            {uploading
              ? <RefreshCw size={18} className="animate-spin" style={{ color: 'var(--admin-gold)' }} />
              : <Upload size={18} style={{ color: 'var(--admin-ink-faint)' }} />}
            <p className="text-xs font-semibold" style={{ color: 'var(--admin-ink)' }}>
              {uploading ? 'กำลังอัปโหลด…' : 'คลิกหรือลากไฟล์มาวาง'}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--admin-ink-faint)' }}>
              JPG / PNG / WebP / HEIC · สูงสุด 10MB
            </p>
          </div>
        </label>
      )}

      {error && (
        <p className="text-[10.5px] mt-1.5" style={{ color: '#B14242' }}>
          {error}
        </p>
      )}

      {/* Preview */}
      {value && (
        <div className="mt-2 relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="preview"
            className="rounded-lg max-h-40 object-contain"
            style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border-2)' }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          <button type="button" onClick={() => onChange('')}
            className="absolute -top-1.5 -right-1.5 rounded-full p-1 shadow-sm"
            style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', color: '#B14242' }}
            title="ลบรูป">
            <X size={11} />
          </button>
        </div>
      )}
    </div>
  )
}

function TypeOption({ active, onClick, emoji, title, desc }: {
  active: boolean; onClick: () => void; emoji: string; title: string; desc: string
}) {
  return (
    <button type="button" onClick={onClick}
      className="text-left p-3 rounded-lg transition-all"
      style={{
        background: active ? 'var(--admin-ink)' : 'var(--admin-card)',
        color:      active ? '#E8C58C' : 'var(--admin-ink)',
        border: `2px solid ${active ? 'var(--admin-gold)' : 'var(--admin-border-2)'}`,
      }}>
      <p className="text-lg mb-1">{emoji}</p>
      <p className="text-xs font-bold">{title}</p>
      <p className="text-[10px] mt-0.5"
        style={{ color: active ? 'rgba(232,197,140,0.6)' : 'var(--admin-ink-mute)' }}>
        {desc}
      </p>
    </button>
  )
}
