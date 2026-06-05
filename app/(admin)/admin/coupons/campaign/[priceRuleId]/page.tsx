'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, ChevronRight, Sparkles, RefreshCw, Download,
  ExternalLink, Copy, Check, Search, AlertTriangle, Trash2,
  CheckCircle, Clock, Zap, Save, X, UserPlus, Users, FileDown,
} from 'lucide-react'

interface CodeRow {
  code: string
  shopify_code_id: number | null
  usage_count: number
  created_at: string
  apply_url: string
  in_local: boolean
  local_id: string | null
  user: { full_name: string | null; member_id: string | null; tier: string | null; phone: string | null } | null
  used_at: string | null
  last_synced_at: string | null
}

interface Detail {
  price_rule_id: number
  shop_id: string
  title: string
  value_type: 'percentage' | 'fixed_amount'
  value: string
  ends_at: string | null
  summary: { total_codes: number; codes_used: number; codes_unused: number; usage_rate_pct: number }
  local_imported: number
  local_used: number
  assigned: number
  unassigned: number
  shopify_only: number
  revenue?: {
    total_thb: number
    orders_count: number
    aov_thb: number | null
    top_channel: string | null
    by_channel: Record<string, number>
  }
  codes: CodeRow[]
}

type RowFilter = 'all' | 'used' | 'available' | 'assigned' | 'unassigned' | 'shopify_only'

export default function CampaignDetailPage() {
  const params = useParams<{ priceRuleId: string }>()
  const router = useRouter()
  const priceRuleId = params.priceRuleId

  const [detail, setDetail] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<RowFilter>('all')
  const [copied, setCopied] = useState<string | null>(null)
  const [showAuto, setShowAuto] = useState(false)
  const [showDistribute, setShowDistribute] = useState(false)
  const [reassignFor, setReassignFor] = useState<CodeRow | null>(null)

  async function load() {
    setLoading(true); setError('')
    try {
      const r = await fetch(`/api/admin/coupons/shopify/campaigns/${priceRuleId}`, { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'ดึงข้อมูลไม่สำเร็จ')
      setDetail(d)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [priceRuleId])

  async function syncNow() {
    setSyncing(true)
    try {
      await fetch('/api/admin/coupons/shopify/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ price_rule_id: Number(priceRuleId) }),
      })
      await load()
    } finally { setSyncing(false) }
  }

  async function importAll() {
    setImporting(true)
    try {
      const r = await fetch('/api/admin/coupons/shopify/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ price_rule_id: Number(priceRuleId) }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      await load()
    } catch (e) { setError((e as Error).message) }
    finally { setImporting(false) }
  }

  async function deleteCampaign() {
    setDeleting(true)
    try {
      const r = await fetch(`/api/admin/coupons/shopify/campaigns/${priceRuleId}`, { method: 'DELETE' })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        throw new Error(d.error || 'ลบไม่สำเร็จ')
      }
      router.push('/admin/coupons/shopify')
    } catch (e) {
      setError((e as Error).message)
      setDeleting(false); setConfirmDelete(false)
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopied(code); setTimeout(() => setCopied(null), 1500)
  }

  const codes = detail?.codes || []
  const filteredCodes = useMemo(() => {
    let list = codes
    if (filter === 'used')         list = list.filter(c => c.used_at)
    if (filter === 'available')    list = list.filter(c => !c.used_at && c.usage_count === 0)
    if (filter === 'assigned')     list = list.filter(c => c.user)
    if (filter === 'unassigned')   list = list.filter(c => c.in_local && !c.user)
    if (filter === 'shopify_only') list = list.filter(c => !c.in_local)
    if (q) {
      const k = q.toLowerCase()
      list = list.filter(c =>
        c.code.toLowerCase().includes(k) ||
        c.user?.full_name?.toLowerCase().includes(k) ||
        c.user?.member_id?.toLowerCase().includes(k)
      )
    }
    return list
  }, [codes, filter, q])

  const valueAbs = detail ? Math.abs(parseFloat(detail.value) || 0) : 0
  const valueStr = detail
    ? (detail.value_type === 'percentage' ? `${valueAbs}%` : `฿${valueAbs.toLocaleString()}`)
    : '—'

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--admin-bg)' }}>
      {/* Breadcrumb */}
      <div className="border-b flex-shrink-0"
        style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <div className="px-6 lg:px-8 h-11 flex items-center gap-2 text-sm">
          <Link href="/admin/coupons" className="hover:opacity-70" style={{ color: 'var(--admin-ink-mute)' }}>คูปอง</Link>
          <ChevronRight size={12} style={{ color: 'var(--admin-ink-faint)' }} />
          <Link href="/admin/coupons/shopify" className="hover:opacity-70" style={{ color: 'var(--admin-ink-mute)' }}>Shopify</Link>
          <ChevronRight size={12} style={{ color: 'var(--admin-ink-faint)' }} />
          <span className="font-medium truncate" style={{ color: 'var(--admin-ink)' }}>
            {detail?.title || priceRuleId}
          </span>
        </div>
      </div>

      {/* Hero */}
      <header className="border-b flex-shrink-0"
        style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <div className="px-6 lg:px-8 py-5 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p style={{ color: '#5E8E3E', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 4 }}>
              Shopify Campaign
            </p>
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--admin-ink)' }}>
              <Sparkles size={20} style={{ color: '#5E8E3E' }} />
              {detail?.title || (loading ? 'กำลังโหลด…' : 'Not found')}
            </h1>
            <p className="text-xs font-mono mt-1" style={{ color: 'var(--admin-ink-faint)' }}>
              #{priceRuleId}
              {detail && <span className="ml-3" style={{ color: 'var(--admin-gold-deep)' }}>{valueStr} ส่วนลด</span>}
              {detail?.ends_at && <span className="ml-3">หมดอายุ {new Date(detail.ends_at).toLocaleDateString('th-TH')}</span>}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0 flex-wrap">
            {detail && detail.shopify_only > 0 && (
              <button onClick={importAll} disabled={importing} className="admin-btn admin-btn-ink">
                {importing ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
                Import ทั้งหมด ({detail.shopify_only})
              </button>
            )}
            {detail && detail.unassigned > 0 && (
              <button onClick={() => setShowDistribute(true)} className="admin-btn admin-btn-ink"
                style={{ background: '#4A7BC1', borderColor: '#4A7BC1' }}>
                <Users size={12} /> แจกจาก pool ({detail.unassigned})
              </button>
            )}
            <button onClick={() => setShowAuto(true)} className="admin-btn admin-btn-ghost">
              <Zap size={12} style={{ color: '#C99B3E' }} /> Auto rules
            </button>
            <button onClick={syncNow} disabled={syncing} className="admin-btn admin-btn-ghost">
              <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
              Sync now
            </button>
            <a href={`/api/admin/coupons/shopify/campaigns/${priceRuleId}/export`}
              download className="admin-btn admin-btn-ghost"
              title="Download CSV ของทุก code">
              <FileDown size={12} /> Export CSV
            </a>
            <a href={`https://admin.shopify.com/store/dreame-thailand/discounts/${priceRuleId}`}
              target="_blank" rel="noopener noreferrer"
              className="admin-btn admin-btn-ghost">
              <ExternalLink size={12} /> เปิดใน Shopify
            </a>
            <button onClick={() => setConfirmDelete(true)} className="admin-btn admin-btn-danger">
              <Trash2 size={12} /> ลบ
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="px-6 lg:px-8 pt-3 flex-shrink-0">
          <div className="admin-card p-3 flex items-start gap-2"
            style={{ background: '#FBE9E9', borderColor: '#E8B4B4', color: '#B14242' }}>
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <p className="text-xs">{error}</p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-5 space-y-5">
        {/* Summary cards */}
        {detail && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SummaryCard label="Codes ทั้งหมด" value={detail.summary.total_codes} />
            <SummaryCard label="ใช้แล้ว" value={detail.summary.codes_used} color="#3A8E5A" sub={`${detail.summary.usage_rate_pct}%`} />
            <SummaryCard label="ยังว่าง" value={detail.summary.codes_unused} />
            <SummaryCard label="แจกแล้ว" value={detail.assigned} color="#4A7BC1" />
            <SummaryCard label="Pool ว่าง" value={detail.unassigned} color="#C99B3E" />
          </div>
        )}

        {/* Revenue cards */}
        {detail && detail.revenue && detail.revenue.orders_count > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-2"
              style={{ color: 'var(--admin-ink-mute)' }}>
              <span>Revenue impact</span>
              {detail.revenue.top_channel && (
                <span className="admin-pill" style={{ fontSize: 9 }}>
                  Top channel: {detail.revenue.top_channel}
                </span>
              )}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard label="ยอดขายรวม"
                value={`฿${Math.round(detail.revenue.total_thb).toLocaleString()}`}
                color="#3A8E5A" />
              <SummaryCard label="จำนวนออเดอร์" value={detail.revenue.orders_count} />
              <SummaryCard label="AOV"
                value={detail.revenue.aov_thb
                  ? `฿${Math.round(detail.revenue.aov_thb).toLocaleString()}`
                  : '—'} />
              <SummaryCard label="Conversion"
                value={detail.summary.total_codes > 0
                  ? `${Math.round((detail.revenue.orders_count / detail.summary.total_codes) * 1000) / 10}%`
                  : '—'} color="#4A7BC1" />
            </div>
          </div>
        )}

        {/* Filter strip */}
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex gap-1 flex-wrap">
            {([
              { k: 'all',          label: 'ทั้งหมด' },
              { k: 'used',         label: 'ใช้แล้ว' },
              { k: 'available',    label: 'ใช้ได้' },
              { k: 'assigned',     label: 'แจกแล้ว' },
              { k: 'unassigned',   label: 'Pool ว่าง' },
              { k: 'shopify_only', label: 'ยังไม่ import' },
            ] as const).map(f => {
              const active = filter === f.k
              return (
                <button key={f.k} onClick={() => setFilter(f.k)}
                  className={`admin-btn ${active ? 'admin-btn-ink' : 'admin-btn-ghost'}`}
                  style={{ padding: '5px 10px', fontSize: 11 }}>
                  {f.label}
                </button>
              )
            })}
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--admin-ink-faint)' }} />
            <input value={q} onChange={e => setQ(e.target.value)}
              placeholder="ค้นหา code / สมาชิก..."
              className="admin-field" style={{ paddingLeft: 32, fontSize: 12 }} />
          </div>
        </div>

        {/* Codes table */}
        <div className="admin-card overflow-hidden">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>สถานะ</th>
                <th>ผู้ได้รับ</th>
                <th>Usage</th>
                <th>Last sync</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && filteredCodes.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center" style={{ color: 'var(--admin-ink-mute)' }}>
                  <RefreshCw size={18} className="mx-auto mb-2 animate-spin" /> กำลังโหลด…
                </td></tr>
              ) : filteredCodes.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center" style={{ color: 'var(--admin-ink-faint)' }}>
                  ไม่พบ code ตามเงื่อนไข
                </td></tr>
              ) : filteredCodes.map(c => (
                <tr key={c.code}>
                  <td>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--admin-bg)', color: 'var(--admin-ink-soft)' }}>
                        {c.code}
                      </code>
                      <button onClick={() => copyCode(c.code)} className="p-0.5"
                        style={{ color: 'var(--admin-ink-faint)' }}>
                        {copied === c.code ? <Check size={12} style={{ color: '#3A8E5A' }} /> : <Copy size={11} />}
                      </button>
                    </div>
                  </td>
                  <td>
                    {c.used_at
                      ? <span className="admin-pill admin-pill-green"><CheckCircle size={10} /> ใช้แล้ว</span>
                      : c.usage_count > 0
                        ? <span className="admin-pill admin-pill-green">used ({c.usage_count})</span>
                        : !c.in_local
                          ? <span className="admin-pill admin-pill-amber">ยังไม่ import</span>
                          : c.user
                            ? <span className="admin-pill admin-pill-blue">แจกแล้ว</span>
                            : <span className="admin-pill">pool</span>}
                  </td>
                  <td>
                    {c.user ? (
                      <Link href={`/admin/members?q=${encodeURIComponent(c.user.member_id || '')}`}
                        className="hover:underline">
                        <p className="text-xs font-semibold" style={{ color: 'var(--admin-ink)' }}>
                          {c.user.full_name || '-'}
                        </p>
                        <p className="text-[10px] font-mono" style={{ color: 'var(--admin-ink-faint)' }}>
                          {c.user.member_id} {c.user.tier && `· ${c.user.tier}`}
                        </p>
                      </Link>
                    ) : <span className="text-[11px]" style={{ color: 'var(--admin-ink-faint)' }}>—</span>}
                  </td>
                  <td>
                    <span className="text-xs tabular-nums" style={{ color: 'var(--admin-ink-soft)' }}>
                      {c.usage_count}
                    </span>
                  </td>
                  <td>
                    <span className="text-[10px]" style={{ color: 'var(--admin-ink-faint)' }}>
                      {c.last_synced_at
                        ? new Date(c.last_synced_at).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      {!c.used_at && c.in_local && (
                        <button onClick={() => setReassignFor(c)}
                          className="admin-pill"
                          style={{ cursor: 'pointer', background: 'var(--admin-bg)' }}
                          title="Reassign ไปยัง user อื่น">
                          <UserPlus size={9} />
                        </button>
                      )}
                      {!c.used_at && (
                        <a href={c.apply_url} target="_blank" rel="noopener noreferrer"
                          className="admin-pill admin-pill-blue"
                          title="เปิด apply URL — ใช้ได้ทันทีที่ Shopify checkout">
                          <ExternalLink size={9} /> เปิด
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Auto-rules modal */}
      {showAuto && (
        <AutoRulesModal
          priceRuleId={Number(priceRuleId)}
          onClose={() => setShowAuto(false)}
          onSaved={() => { setShowAuto(false); load() }}
        />
      )}

      {/* Distribute modal */}
      {showDistribute && detail && (
        <DistributeModal
          priceRuleId={Number(priceRuleId)}
          poolFree={detail.unassigned}
          onClose={() => setShowDistribute(false)}
          onDone={() => { setShowDistribute(false); load() }}
        />
      )}

      {/* Reassign modal */}
      {reassignFor && reassignFor.local_id && (
        <ReassignModal
          couponId={reassignFor.local_id}
          code={reassignFor.code}
          currentUser={reassignFor.user}
          onClose={() => setReassignFor(null)}
          onDone={() => { setReassignFor(null); load() }}
        />
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(14,14,14,0.45)', backdropFilter: 'blur(6px)' }}>
          <div className="admin-card p-5 max-w-md w-full">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#FBE9E9' }}>
                <AlertTriangle size={18} style={{ color: '#B14242' }} />
              </div>
              <div>
                <h3 className="font-bold text-sm" style={{ color: 'var(--admin-ink)' }}>ลบ campaign นี้?</h3>
                <p className="text-xs mt-1" style={{ color: 'var(--admin-ink-mute)' }}>
                  จะลบ price rule + codes ทั้งหมดที่ Shopify ด้วย user ที่ยังไม่ใช้จะเห็นคูปองหายไปจากระบบเรา
                </p>
                <p className="text-xs mt-2" style={{ color: '#B14242' }}>ไม่สามารถยกเลิกได้</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="admin-btn admin-btn-ghost flex-1">ยกเลิก</button>
              <button onClick={deleteCampaign} disabled={deleting}
                className="admin-btn admin-btn-danger flex-1"
                style={{ background: '#B14242', color: '#fff', borderColor: '#B14242' }}>
                {deleting ? 'กำลังลบ…' : 'ลบ campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, color, sub }: {
  label: string; value: number | string; color?: string; sub?: string
}) {
  const display = typeof value === 'number' ? value.toLocaleString() : value
  return (
    <div className="admin-card p-4">
      <p className="text-[10px] uppercase tracking-wider font-semibold"
        style={{ color: 'var(--admin-ink-mute)' }}>{label}</p>
      <div className="flex items-baseline gap-1.5 mt-1.5">
        <p className="text-2xl font-bold tabular-nums" style={{ color: color || 'var(--admin-ink)' }}>
          {display}
        </p>
        {sub && <p className="text-xs" style={{ color: 'var(--admin-ink-faint)' }}>{sub}</p>}
      </div>
    </div>
  )
}

// ============================================================
// Auto rules modal — ตั้งกฎอัตโนมัติของ campaign
// ============================================================
interface CampaignConfig {
  id: string
  low_pool_threshold: number | null
  topup_batch_size: number
  topup_paused: boolean
  last_topup_at: string | null
  last_topup_count: number | null
  last_topup_error: string | null
  auto_assign_tier: 'SILVER' | 'GOLD' | 'PLATINUM' | null
  auto_assign_on_signup: boolean
  auto_assign_on_upgrade: boolean
  default_value_type: 'percentage' | 'fixed_amount' | null
  default_value: number | null
  default_min_purchase: number | null
  default_code_prefix: string | null
  default_ends_at: string | null
}
type PoolSnap = { pool_free: number; pool_assigned: number; pool_used: number; pool_total: number }

function AutoRulesModal({ priceRuleId, onClose, onSaved }: {
  priceRuleId: number; onClose: () => void; onSaved: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [cfg, setCfg] = useState<Partial<CampaignConfig>>({})
  const [pool, setPool] = useState<PoolSnap>({ pool_free: 0, pool_assigned: 0, pool_used: 0, pool_total: 0 })

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/admin/coupons/shopify/campaigns/${priceRuleId}/config`)
        const d = await r.json()
        if (!r.ok) throw new Error(d.error)
        setCfg(d.config || {})
        setPool(d.pool || pool)
      } catch (e) { setError((e as Error).message) }
      finally { setLoading(false) }
    })()
  }, [priceRuleId])

  async function save() {
    setSaving(true); setError('')
    try {
      const r = await fetch(`/api/admin/coupons/shopify/campaigns/${priceRuleId}/config`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(cfg),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      onSaved()
    } catch (e) { setError((e as Error).message); setSaving(false) }
  }

  function set<K extends keyof CampaignConfig>(k: K, v: CampaignConfig[K]) {
    setCfg(prev => ({ ...prev, [k]: v }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(14,14,14,0.45)', backdropFilter: 'blur(6px)' }}>
      <div className="admin-card max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-start justify-between"
          style={{ borderColor: 'var(--admin-border)' }}>
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--admin-ink)' }}>
              <Zap size={16} style={{ color: '#C99B3E' }} /> Auto rules
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--admin-ink-mute)' }}>
              ตั้งกฎให้ระบบเติม pool เอง + แจกตาม tier อัตโนมัติ
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--admin-ink-faint)' }}>
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center" style={{ color: 'var(--admin-ink-mute)' }}>
            <RefreshCw size={18} className="mx-auto mb-2 animate-spin" /> โหลด…
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Pool snapshot */}
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { lbl: 'ทั้งหมด', v: pool.pool_total },
                { lbl: 'ว่าง',    v: pool.pool_free,     c: '#C99B3E' },
                { lbl: 'แจกแล้ว', v: pool.pool_assigned, c: '#4A7BC1' },
                { lbl: 'ใช้แล้ว', v: pool.pool_used,     c: '#3A8E5A' },
              ].map(s => (
                <div key={s.lbl} className="rounded-lg py-2" style={{ background: 'var(--admin-bg)' }}>
                  <p className="text-lg font-bold tabular-nums" style={{ color: s.c || 'var(--admin-ink)' }}>{s.v}</p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--admin-ink-mute)' }}>{s.lbl}</p>
                </div>
              ))}
            </div>

            {/* Auto top-up */}
            <section>
              <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--admin-ink)' }}>
                เติม pool อัตโนมัติ
              </h4>
              <p className="text-xs mb-3" style={{ color: 'var(--admin-ink-mute)' }}>
                ถ้า pool ว่างน้อยกว่าค่าที่ตั้ง ระบบจะ generate โค้ดเพิ่มที่ Shopify ทันที (cron รันทุก 5–15 นาที)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="ขั้นต่ำ pool ว่าง" hint="ปล่อยว่าง = ปิดฟีเจอร์">
                  <input type="number" min={0} className="admin-field" style={{ fontSize: 13 }}
                    value={cfg.low_pool_threshold ?? ''}
                    onChange={e => set('low_pool_threshold', e.target.value === '' ? null : Number(e.target.value))} />
                </Field>
                <Field label="เติมครั้งละ (codes)">
                  <input type="number" min={1} max={500} className="admin-field" style={{ fontSize: 13 }}
                    value={cfg.topup_batch_size ?? 100}
                    onChange={e => set('topup_batch_size', Number(e.target.value))} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-xs mt-3 cursor-pointer"
                style={{ color: 'var(--admin-ink-mute)' }}>
                <input type="checkbox" checked={cfg.topup_paused ?? false}
                  onChange={e => set('topup_paused', e.target.checked)} />
                หยุดชั่วคราว (กรณีต้องการตรวจสอบก่อน)
              </label>
              {cfg.last_topup_at && (
                <p className="text-[10px] mt-2" style={{ color: 'var(--admin-ink-faint)' }}>
                  เติมล่าสุด: {new Date(cfg.last_topup_at).toLocaleString('th-TH')} ({cfg.last_topup_count} codes)
                </p>
              )}
              {cfg.last_topup_error && (
                <p className="text-[10px] mt-1" style={{ color: '#B14242' }}>
                  ⚠ {cfg.last_topup_error}
                </p>
              )}
            </section>

            <div className="h-px" style={{ background: 'var(--admin-border)' }} />

            {/* Auto-assign */}
            <section>
              <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--admin-ink)' }}>
                แจกอัตโนมัติตาม tier
              </h4>
              <p className="text-xs mb-3" style={{ color: 'var(--admin-ink-mute)' }}>
                เมื่อสมาชิกถึง tier ที่กำหนด ระบบจะดึงโค้ดจาก pool ให้ทันที (กันซ้ำด้วย <code>auto_issue_key</code>)
              </p>
              <Field label="Tier ที่จะได้รับ" hint="เลือก SILVER / GOLD / PLATINUM หรือเว้นว่าง = ปิด">
                <select className="admin-field" style={{ fontSize: 13 }}
                  value={cfg.auto_assign_tier ?? ''}
                  onChange={e => set('auto_assign_tier', (e.target.value || null) as never)}>
                  <option value="">— ปิด —</option>
                  <option value="SILVER">Silver</option>
                  <option value="GOLD">Gold</option>
                  <option value="PLATINUM">Platinum</option>
                </select>
              </Field>
              <div className="flex flex-col gap-2 mt-3">
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--admin-ink-mute)' }}>
                  <input type="checkbox" disabled={!cfg.auto_assign_tier}
                    checked={cfg.auto_assign_on_signup ?? false}
                    onChange={e => set('auto_assign_on_signup', e.target.checked)} />
                  แจกตอนสมาชิกใหม่สมัคร (ถ้า tier match)
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--admin-ink-mute)' }}>
                  <input type="checkbox" disabled={!cfg.auto_assign_tier}
                    checked={cfg.auto_assign_on_upgrade ?? true}
                    onChange={e => set('auto_assign_on_upgrade', e.target.checked)} />
                  แจกเมื่อสมาชิกเลื่อนระดับขึ้น
                </label>
              </div>
            </section>

            <div className="h-px" style={{ background: 'var(--admin-border)' }} />

            {/* Default values สำหรับ top-up */}
            <section>
              <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--admin-ink)' }}>
                ค่าส่วนลดที่จะใช้ตอนเติม
              </h4>
              <p className="text-xs mb-3" style={{ color: 'var(--admin-ink-mute)' }}>
                ระบบ auto-fetch จาก Shopify ครั้งแรก — เปลี่ยนได้ถ้าต้องการให้ batch ใหม่ใช้ค่าอื่น
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="ชนิดส่วนลด">
                  <select className="admin-field" style={{ fontSize: 13 }}
                    value={cfg.default_value_type ?? ''}
                    onChange={e => set('default_value_type', e.target.value as never)}>
                    <option value="">—</option>
                    <option value="percentage">เปอร์เซ็นต์</option>
                    <option value="fixed_amount">ลดเป็นบาท</option>
                  </select>
                </Field>
                <Field label="มูลค่า">
                  <input type="number" min={0} step={0.01} className="admin-field" style={{ fontSize: 13 }}
                    value={cfg.default_value ?? ''}
                    onChange={e => set('default_value', e.target.value === '' ? null : Number(e.target.value))} />
                </Field>
                <Field label="ขั้นต่ำ (฿)">
                  <input type="number" min={0} className="admin-field" style={{ fontSize: 13 }}
                    value={cfg.default_min_purchase ?? ''}
                    onChange={e => set('default_min_purchase', e.target.value === '' ? null : Number(e.target.value))} />
                </Field>
                <Field label="Prefix รหัส">
                  <input className="admin-field" style={{ fontSize: 13 }}
                    placeholder="DREAME"
                    value={cfg.default_code_prefix ?? ''}
                    onChange={e => set('default_code_prefix', e.target.value)} />
                </Field>
              </div>
            </section>

            {error && (
              <div className="p-2 rounded text-xs"
                style={{ background: '#FBE9E9', color: '#B14242', border: '1px solid #E8B4B4' }}>
                {error}
              </div>
            )}
          </div>
        )}

        <div className="px-5 py-3 border-t flex gap-2 sticky bottom-0"
          style={{ borderColor: 'var(--admin-border)', background: 'var(--admin-card)' }}>
          <button onClick={onClose} className="admin-btn admin-btn-ghost flex-1">ยกเลิก</button>
          <button onClick={save} disabled={saving || loading} className="admin-btn admin-btn-ink flex-1">
            {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
            บันทึก
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Distribute pool modal — แจกโค้ดที่ยังไม่มีเจ้าของ
// ============================================================
function DistributeModal({ priceRuleId, poolFree, onClose, onDone }: {
  priceRuleId: number; poolFree: number; onClose: () => void; onDone: () => void
}) {
  const [mode, setMode] = useState<'tier' | 'all_active' | 'vip'>('tier')
  const [tier, setTier] = useState<'SILVER' | 'GOLD' | 'PLATINUM'>('GOLD')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{
    distributed: number; pool_used: number; skipped: number;
    candidates: number; eligible: number; failures: number;
    error_sample: string | null; pool_exhausted: boolean
  } | null>(null)

  async function submit() {
    setSaving(true); setError('')
    try {
      const r = await fetch(`/api/admin/coupons/shopify/campaigns/${priceRuleId}/distribute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mode === 'tier' ? { mode, tier } : { mode }),
      })
      const d = await r.json()
      if (!r.ok) {
        // 400/409 — server บอกเหตุผลชัดเจน
        const detail = d.error
          + (d.target_count !== undefined ? ` (สมาชิกในกลุ่ม: ${d.target_count})` : '')
          + (d.skipped_already_has ? ` · มีคูปองนี้แล้ว: ${d.skipped_already_has}` : '')
        throw new Error(detail)
      }
      setResult({
        distributed:    d.distributed,
        pool_used:      d.pool_used,
        skipped:        d.skipped_already_has,
        candidates:     d.candidates,
        eligible:       d.eligible,
        failures:       d.failures,
        error_sample:   d.error_sample,
        pool_exhausted: d.pool_exhausted,
      })
    } catch (e) { setError((e as Error).message); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(14,14,14,0.45)', backdropFilter: 'blur(6px)' }}>
      <div className="admin-card max-w-md w-full">
        <div className="p-5 border-b flex items-start justify-between"
          style={{ borderColor: 'var(--admin-border)' }}>
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--admin-ink)' }}>
              <Users size={16} style={{ color: '#4A7BC1' }} /> แจกจาก pool
            </h3>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--admin-ink-mute)' }}>
              ใน pool มี <b>{poolFree}</b> โค้ดยังไม่มีเจ้าของ
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--admin-ink-faint)' }}><X size={16}/></button>
        </div>

        {result ? (
          <div className="p-5">
            <div className="admin-card p-4 text-center"
              style={{
                background: result.distributed > 0 ? 'rgba(58,142,90,0.06)' : '#FBE9E9',
                borderColor: result.distributed > 0 ? 'rgba(58,142,90,0.25)' : '#E8B4B4',
              }}>
              {result.distributed > 0
                ? <CheckCircle size={24} className="mx-auto mb-2" style={{ color: '#3A8E5A' }}/>
                : <AlertTriangle size={24} className="mx-auto mb-2" style={{ color: '#B14242' }}/>}
              <p className="text-sm font-bold"
                style={{ color: result.distributed > 0 ? '#3A8E5A' : '#B14242' }}>
                แจกแล้ว {result.distributed} โค้ด
              </p>
              <div className="text-[11px] mt-2 space-y-0.5" style={{ color: 'var(--admin-ink-mute)' }}>
                <p>สมาชิกในกลุ่ม: <b>{result.candidates}</b> คน</p>
                {result.skipped > 0 && (
                  <p>มีคูปองนี้อยู่แล้ว: <b>{result.skipped}</b> คน</p>
                )}
                <p>เหลือต้องแจก: <b>{result.eligible}</b> คน</p>
                <p>Pool ใช้ไป: <b>{result.pool_used}</b> โค้ด</p>
                {result.pool_exhausted && (
                  <p style={{ color: '#C99B3E' }}>
                    ⚠ Pool หมดก่อน — เหลือ {result.eligible - result.distributed} คนยังไม่ได้
                  </p>
                )}
                {result.failures > 0 && (
                  <p style={{ color: '#B14242' }}>
                    ⚠ ล้มเหลว {result.failures} ครั้ง · {result.error_sample}
                  </p>
                )}
              </div>
            </div>
            <button onClick={onDone} className="admin-btn admin-btn-ink w-full mt-3">เสร็จ</button>
          </div>
        ) : (
          <>
            <div className="p-5 space-y-2">
              <RadioRow active={mode === 'tier'} onClick={() => setMode('tier')}
                title="แจกตาม Tier" desc="แจก 1 คน 1 โค้ดให้สมาชิก tier ที่เลือก" />
              {mode === 'tier' && (
                <div className="ml-9 mb-2">
                  <select value={tier} onChange={e => setTier(e.target.value as never)}
                    className="admin-field w-full" style={{ fontSize: 13 }}>
                    <option value="SILVER">Silver</option>
                    <option value="GOLD">Gold</option>
                    <option value="PLATINUM">Platinum</option>
                  </select>
                </div>
              )}
              <RadioRow active={mode === 'all_active'} onClick={() => setMode('all_active')}
                title="แจกทุก active" desc="สมาชิกทุกคนที่ยัง active" />
              <RadioRow active={mode === 'vip'} onClick={() => setMode('vip')}
                title="แจกเฉพาะ VIP" desc="user ที่ flag is_vip" />

              {error && (
                <div className="p-2 rounded text-xs mt-3"
                  style={{ background: '#FBE9E9', color: '#B14242', border: '1px solid #E8B4B4' }}>
                  {error}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t flex gap-2"
              style={{ borderColor: 'var(--admin-border)' }}>
              <button onClick={onClose} className="admin-btn admin-btn-ghost flex-1">ยกเลิก</button>
              <button onClick={submit} disabled={saving} className="admin-btn admin-btn-ink flex-1">
                {saving ? <RefreshCw size={11} className="animate-spin" /> : <Users size={11} />}
                แจกเลย
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function RadioRow({ active, onClick, title, desc }: {
  active: boolean; onClick: () => void; title: string; desc: string
}) {
  return (
    <button onClick={onClick}
      className="w-full text-left flex items-start gap-3 p-3 rounded-lg transition-colors"
      style={{
        background: active ? 'var(--admin-bg)' : 'transparent',
        border: active ? '1px solid var(--admin-gold)' : '1px solid var(--admin-border-2)',
      }}>
      <div className="w-4 h-4 rounded-full mt-0.5 flex-shrink-0 flex items-center justify-center"
        style={{ border: active ? '4px solid var(--admin-gold)' : '1.5px solid var(--admin-border)' }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold" style={{ color: 'var(--admin-ink)' }}>{title}</p>
        <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--admin-ink-mute)' }}>{desc}</p>
      </div>
    </button>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--admin-ink-mute)' }}>{label}</span>
      {hint && <span className="text-[10px] block mb-1" style={{ color: 'var(--admin-ink-faint)' }}>{hint}</span>}
      {!hint && <span className="block mb-1" />}
      {children}
    </label>
  )
}

// ============================================================
// Reassign modal — ย้ายเจ้าของคูปองไปยัง user คนอื่น
// ============================================================
interface MiniUser { id: string; member_id: string | null; full_name: string | null; tier: string | null; phone: string | null }

function ReassignModal({ couponId, code, currentUser, onClose, onDone }: {
  couponId: string
  code: string
  currentUser: { full_name: string | null; member_id: string | null; tier: string | null; phone: string | null } | null
  onClose: () => void
  onDone: () => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<MiniUser[]>([])
  const [target, setTarget] = useState<MiniUser | null>(null)
  const [reason, setReason] = useState('')
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (q.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await fetch(`/api/admin/users/search?q=${encodeURIComponent(q)}`)
        const d = await r.json()
        setResults((d.users || []).slice(0, 8))
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  async function submit() {
    if (!target) return
    setSaving(true); setError('')
    try {
      const r = await fetch(`/api/admin/coupons/${couponId}/reassign`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to_user_id: target.id, reason }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      onDone()
    } catch (e) { setError((e as Error).message); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(14,14,14,0.45)', backdropFilter: 'blur(6px)' }}>
      <div className="admin-card max-w-md w-full">
        <div className="p-5 border-b flex items-start justify-between"
          style={{ borderColor: 'var(--admin-border)' }}>
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--admin-ink)' }}>
              <UserPlus size={16} style={{ color: '#4A7BC1' }} /> Reassign คูปอง
            </h3>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--admin-ink-mute)' }}>
              ย้ายโค้ด <code className="font-mono">{code}</code>
              {currentUser && <> จาก <b>{currentUser.full_name}</b> ({currentUser.member_id})</>}
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--admin-ink-faint)' }}><X size={16} /></button>
        </div>

        <div className="p-5 space-y-3">
          <Field label="ค้นหา user ปลายทาง" hint="ชื่อ / member_id / เบอร์โทร / email">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--admin-ink-faint)' }} />
              <input value={q} onChange={e => { setQ(e.target.value); setTarget(null) }}
                placeholder="เริ่มพิมพ์อย่างน้อย 2 ตัว..."
                className="admin-field w-full" style={{ paddingLeft: 32 }} />
            </div>
          </Field>

          {target ? (
            <div className="admin-card p-3 flex items-center gap-3"
              style={{ background: 'var(--admin-bg)', borderColor: 'rgba(58,142,90,0.4)' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: target.tier === 'PLATINUM' ? '#1a1a1a'
                            : target.tier === 'GOLD'     ? '#C99B3E'
                            :                              '#9CA29A',
                  color: '#fff',
                }}>
                {(target.full_name || '?').slice(0, 1)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--admin-ink)' }}>
                  {target.full_name || '—'}
                </p>
                <p className="text-[10px] font-mono" style={{ color: 'var(--admin-ink-faint)' }}>
                  {target.member_id} {target.tier && `· ${target.tier}`} {target.phone && `· ${target.phone}`}
                </p>
              </div>
              <button onClick={() => setTarget(null)} className="text-xs px-2 py-1"
                style={{ color: 'var(--admin-ink-faint)' }}>
                เปลี่ยน
              </button>
            </div>
          ) : results.length > 0 ? (
            <div className="admin-card max-h-60 overflow-y-auto">
              {results.map(u => (
                <button key={u.id} onClick={() => setTarget(u)}
                  className="w-full text-left px-3 py-2.5 hover:bg-[var(--admin-bg)] flex items-center gap-3 border-b last:border-b-0"
                  style={{ borderColor: 'var(--admin-border-2)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--admin-ink)' }}>
                      {u.full_name || '—'}
                    </p>
                    <p className="text-[10px] font-mono" style={{ color: 'var(--admin-ink-faint)' }}>
                      {u.member_id} {u.tier && `· ${u.tier}`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : searching ? (
            <p className="text-xs text-center py-3" style={{ color: 'var(--admin-ink-faint)' }}>
              <RefreshCw size={11} className="inline animate-spin mr-1" /> ค้นหา…
            </p>
          ) : null}

          <Field label="เหตุผล" hint="optional — บันทึกลง audit log">
            <input value={reason} onChange={e => setReason(e.target.value)}
              placeholder="เช่น user ขอใหม่ / เปลี่ยน account"
              className="admin-field w-full" />
          </Field>

          {error && (
            <div className="p-2 rounded text-xs"
              style={{ background: '#FBE9E9', color: '#B14242', border: '1px solid #E8B4B4' }}>
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t flex gap-2"
          style={{ borderColor: 'var(--admin-border)' }}>
          <button onClick={onClose} className="admin-btn admin-btn-ghost flex-1">ยกเลิก</button>
          <button onClick={submit} disabled={!target || saving} className="admin-btn admin-btn-ink flex-1">
            {saving ? <RefreshCw size={11} className="animate-spin" /> : <UserPlus size={11} />}
            ยืนยัน reassign
          </button>
        </div>
      </div>
    </div>
  )
}
