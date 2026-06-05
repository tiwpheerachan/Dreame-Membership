'use client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Sparkles, Search, RefreshCw, ExternalLink, Download,
  ChevronRight, AlertCircle, CheckCircle, Clock, X, Users,
} from 'lucide-react'

interface Campaign {
  price_rule_id: number
  title: string
  value_type: 'percentage' | 'fixed_amount'
  value: string
  starts_at: string | null
  ends_at: string | null
  once_per_customer: boolean
  shopify_created_at: string
  expired: boolean
  local_count: number
  used_count: number
  last_synced_at: string | null
  shopify_only: boolean
  revenue_thb?: number
  orders_count?: number
  aov_thb?: number | null
  top_channel?: string | null
}

type StatusFilter = 'all' | 'active' | 'expired' | 'imported' | 'shopify_only'

export default function ShopifyCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [importing, setImporting] = useState<number | null>(null)
  const [importMsg, setImportMsg] = useState('')
  const [shops, setShops] = useState<Array<{ id: string; label: string }>>([])
  const [shopId, setShopId] = useState<string>('')
  const [importTarget, setImportTarget] = useState<Campaign | null>(null)

  useEffect(() => {
    fetch('/api/admin/shops').then(r => r.json()).then(d => {
      const list = d.shops || []
      setShops(list)
      if (list[0]) setShopId(list[0].id)
    })
  }, [])

  async function load() {
    if (!shopId) return
    setLoading(true); setError('')
    try {
      const r = await fetch(`/api/admin/coupons/shopify/campaigns?shop_id=${encodeURIComponent(shopId)}`, { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'ดึงข้อมูลไม่สำเร็จ')
      setCampaigns(d.campaigns || [])
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [shopId])

  async function runImport(c: Campaign, opts: {
    assign_tier?: string; assign_segment?: string
  }) {
    setImporting(c.price_rule_id); setImportMsg('')
    try {
      const r = await fetch('/api/admin/coupons/shopify/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ price_rule_id: c.price_rule_id, shop_id: shopId, ...opts }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'นำเข้าไม่สำเร็จ')
      setImportMsg(
        `Imported "${c.title}" — ${d.imported} codes`
        + (d.assigned ? `, แจกแล้ว ${d.assigned} คน` : ', ยังไม่แจก (อยู่ใน pool)')
      )
      setImportTarget(null)
      await load()
    } catch (e) { setImportMsg(`Error: ${(e as Error).message}`) }
    finally { setImporting(null) }
  }

  const filtered = useMemo(() => {
    let list = campaigns
    if (statusFilter === 'active')       list = list.filter(c => !c.expired)
    if (statusFilter === 'expired')      list = list.filter(c => c.expired)
    if (statusFilter === 'imported')     list = list.filter(c => c.local_count > 0)
    if (statusFilter === 'shopify_only') list = list.filter(c => c.shopify_only)
    if (q) {
      const k = q.toLowerCase()
      list = list.filter(c =>
        c.title.toLowerCase().includes(k) ||
        String(c.price_rule_id).includes(k)
      )
    }
    return list
  }, [campaigns, statusFilter, q])

  const counts = useMemo(() => ({
    all: campaigns.length,
    active: campaigns.filter(c => !c.expired).length,
    expired: campaigns.filter(c => c.expired).length,
    imported: campaigns.filter(c => c.local_count > 0).length,
    shopify_only: campaigns.filter(c => c.shopify_only).length,
  }), [campaigns])

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--admin-bg)' }}>
      {/* Breadcrumb */}
      <div className="border-b flex-shrink-0"
        style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <div className="px-6 lg:px-8 h-11 flex items-center gap-2 text-sm">
          <Link href="/admin/coupons" className="hover:opacity-70" style={{ color: 'var(--admin-ink-mute)' }}>
            คูปอง
          </Link>
          <ChevronRight size={12} style={{ color: 'var(--admin-ink-faint)' }} />
          <span className="font-medium" style={{ color: 'var(--admin-ink)' }}>Shopify campaigns</span>
        </div>
      </div>

      {/* Header */}
      <header className="border-b flex-shrink-0"
        style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <div className="px-6 lg:px-8 py-5 flex items-start justify-between gap-4">
          <div>
            <p style={{ color: '#5E8E3E', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 4 }}>
              Shopify Mirror
            </p>
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--admin-ink)' }}>
              <Sparkles size={20} style={{ color: '#5E8E3E' }} /> Shopify Campaigns
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--admin-ink-mute)' }}>
              {campaigns.length} campaigns บน Shopify · {counts.imported} อยู่ในระบบเรา
            </p>
          </div>
          <div className="flex gap-2 items-center flex-shrink-0">
            {shops.length > 1 && (
              <select value={shopId} onChange={e => setShopId(e.target.value)}
                className="admin-field" style={{ fontSize: 12, paddingRight: 28 }}>
                {shops.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            )}
            <button onClick={load} disabled={loading} className="admin-btn admin-btn-ghost">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
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
              { k: 'all',          label: 'ทั้งหมด' },
              { k: 'active',       label: 'ใช้งานได้' },
              { k: 'expired',      label: 'หมดอายุ' },
              { k: 'imported',     label: 'นำเข้าแล้ว' },
              { k: 'shopify_only', label: 'ยังไม่นำเข้า' },
            ] as const).map(f => {
              const active = statusFilter === f.k
              return (
                <button key={f.k} onClick={() => setStatusFilter(f.k)}
                  className={`admin-btn ${active ? 'admin-btn-ink' : 'admin-btn-ghost'}`}
                  style={{ padding: '6px 12px', fontSize: 12, gap: 6 }}>
                  {f.label}
                  <span style={{
                    fontSize: 10.5, padding: '1px 7px', borderRadius: 100,
                    background: active ? 'rgba(232,197,140,0.20)' : 'var(--admin-bg)',
                    color: active ? '#E8C58C' : 'var(--admin-ink-mute)',
                    fontWeight: 700,
                  }}>{counts[f.k]}</span>
                </button>
              )
            })}
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--admin-ink-faint)' }} />
            <input value={q} onChange={e => setQ(e.target.value)}
              placeholder="ค้นหา title หรือ price_rule_id..."
              className="admin-field" style={{ paddingLeft: 34 }} />
          </div>
        </div>
      </div>

      {/* Notifications */}
      {(error || importMsg) && (
        <div className="px-6 lg:px-8 pt-3 flex-shrink-0">
          {error && (
            <div className="admin-card p-3 mb-2 flex items-start gap-2"
              style={{ background: '#FBE9E9', borderColor: '#E8B4B4', color: '#B14242' }}>
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <p className="text-xs">{error}</p>
            </div>
          )}
          {importMsg && (
            <div className="admin-card p-3 mb-2 flex items-start gap-2"
              style={{ background: 'rgba(58,142,90,0.06)', borderColor: 'rgba(58,142,90,0.25)', color: '#3A8E5A' }}>
              <CheckCircle size={14} className="mt-0.5 flex-shrink-0" />
              <p className="text-xs">{importMsg}</p>
            </div>
          )}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-5">
        {loading && campaigns.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--admin-ink-mute)' }}>
            <RefreshCw size={20} className="mx-auto mb-2 animate-spin" />
            <p className="text-sm">กำลังโหลด campaigns จาก Shopify…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--admin-ink-mute)' }}>
            <p className="text-sm">ไม่พบ campaign ตามตัวกรอง</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(c => (
              <CampaignCard key={c.price_rule_id} c={c}
                onImport={() => setImportTarget(c)}
                importing={importing === c.price_rule_id} />
            ))}
          </div>
        )}
      </div>

      {/* Import + assignment modal */}
      {importTarget && (
        <ImportAssignDialog
          campaign={importTarget}
          loading={importing === importTarget.price_rule_id}
          onCancel={() => setImportTarget(null)}
          onConfirm={(opts) => runImport(importTarget, opts)}
        />
      )}
    </div>
  )
}

// ============================================================
// Import + assignment dialog
// ============================================================
type AssignMode = 'pool' | 'tier' | 'all_active' | 'vip'

function ImportAssignDialog({ campaign, loading, onCancel, onConfirm }: {
  campaign: Campaign
  loading: boolean
  onCancel: () => void
  onConfirm: (opts: { assign_tier?: string; assign_segment?: string }) => void
}) {
  const [mode, setMode] = useState<AssignMode>('pool')
  const [tier, setTier] = useState<'SILVER' | 'GOLD' | 'PLATINUM'>('GOLD')

  function confirm() {
    if (mode === 'pool')        onConfirm({})
    if (mode === 'tier')        onConfirm({ assign_tier: tier })
    if (mode === 'all_active')  onConfirm({ assign_segment: 'all_active' })
    if (mode === 'vip')         onConfirm({ assign_segment: 'vip' })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(14,14,14,0.45)', backdropFilter: 'blur(6px)' }}>
      <div className="admin-card max-w-md w-full">
        <div className="p-5 border-b flex items-start justify-between"
          style={{ borderColor: 'var(--admin-border)' }}>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--admin-ink)' }}>
              <Download size={16} style={{ color: '#5E8E3E' }} /> นำเข้า "{campaign.title}"
            </h3>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--admin-ink-mute)' }}>
              เลือกว่าจะแจกให้ใคร — ไม่งั้น codes จะอยู่ใน pool และ user ไม่เห็น
            </p>
          </div>
          <button onClick={onCancel} style={{ color: 'var(--admin-ink-faint)' }}><X size={16}/></button>
        </div>

        <div className="p-5 space-y-2">
          <ModeRow active={mode === 'tier'}     onClick={() => setMode('tier')}
            title="แจกตาม Tier" desc="แจก 1 คน 1 โค้ดให้สมาชิก tier ที่เลือก" recommended />
          {mode === 'tier' && (
            <div className="ml-9 mb-3">
              <select value={tier} onChange={e => setTier(e.target.value as never)}
                className="admin-field w-full" style={{ fontSize: 13 }}>
                <option value="SILVER">Silver</option>
                <option value="GOLD">Gold</option>
                <option value="PLATINUM">Platinum</option>
              </select>
            </div>
          )}
          <ModeRow active={mode === 'all_active'} onClick={() => setMode('all_active')}
            title="แจกทุกสมาชิก active" desc="ทุกคนที่ยัง active — codes พอเมื่อ ≥ จำนวนสมาชิก" />
          <ModeRow active={mode === 'vip'} onClick={() => setMode('vip')}
            title="แจกเฉพาะ VIP" desc="user ที่ flag is_vip = true" />
          <ModeRow active={mode === 'pool'} onClick={() => setMode('pool')}
            title="เก็บใน pool" desc="ยังไม่แจก — รอ admin assign ภายหลัง / รอ auto rules" />
        </div>

        <div className="px-5 py-3 border-t flex gap-2"
          style={{ borderColor: 'var(--admin-border)' }}>
          <button onClick={onCancel} className="admin-btn admin-btn-ghost flex-1">ยกเลิก</button>
          <button onClick={confirm} disabled={loading} className="admin-btn admin-btn-ink flex-1">
            {loading ? <RefreshCw size={11} className="animate-spin" /> : <Download size={11} />}
            นำเข้า
          </button>
        </div>
      </div>
    </div>
  )
}

function ModeRow({ active, onClick, title, desc, recommended }: {
  active: boolean; onClick: () => void; title: string; desc: string; recommended?: boolean
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
        <p className="text-xs font-semibold flex items-center gap-2" style={{ color: 'var(--admin-ink)' }}>
          {title}
          {recommended && <span className="admin-pill admin-pill-green" style={{ fontSize: 9 }}>แนะนำ</span>}
        </p>
        <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--admin-ink-mute)' }}>{desc}</p>
      </div>
    </button>
  )
}

function CampaignCard({ c, onImport, importing }: {
  c: Campaign; onImport: () => void; importing: boolean
}) {
  const valueAbs = Math.abs(parseFloat(c.value) || 0)
  const valueStr = c.value_type === 'percentage' ? `${valueAbs}%` : `฿${valueAbs.toLocaleString()}`
  const redemption = c.local_count > 0 ? (c.used_count / c.local_count * 100) : 0

  return (
    <div className="admin-card p-4 flex flex-col gap-3">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold truncate" style={{ color: 'var(--admin-ink)' }}>
            {c.title}
          </p>
          <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--admin-ink-faint)' }}>
            #{c.price_rule_id}
          </p>
        </div>
        {c.expired
          ? <span className="admin-pill admin-pill-red">หมดอายุ</span>
          : c.shopify_only
            ? <span className="admin-pill admin-pill-amber">ยังไม่นำเข้า</span>
            : <span className="admin-pill admin-pill-green">นำเข้าแล้ว</span>}
      </div>

      {/* Discount value */}
      <div className="rounded-xl px-3 py-2.5 flex items-center justify-between"
        style={{ background: 'var(--admin-bg)' }}>
        <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--admin-gold-deep)' }}>
          {valueStr}
        </span>
        <span className="text-[11px]" style={{ color: 'var(--admin-ink-mute)' }}>
          ส่วนลด {c.value_type === 'percentage' ? 'เปอร์เซ็นต์' : 'บาท'}
        </span>
      </div>

      {/* Stats grid (only if imported) */}
      {c.local_count > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Codes" value={c.local_count} />
            <Stat label="ใช้แล้ว" value={c.used_count} color={c.used_count > 0 ? '#3A8E5A' : undefined} />
            <Stat label="ค้าง" value={c.local_count - c.used_count} />
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--admin-border)' }}>
            <div className="h-full rounded-full" style={{
              width: `${redemption}%`,
              background: 'linear-gradient(90deg, #C99B3E, #5E8E3E)',
            }} />
          </div>
          {/* Revenue row — show only if any orders matched */}
          {(c.orders_count ?? 0) > 0 && (
            <div className="grid grid-cols-2 gap-2 pt-1.5"
              style={{ borderTop: '1px dashed var(--admin-border-2)' }}>
              <RevStat label="Revenue" value={`฿${Math.round(c.revenue_thb || 0).toLocaleString()}`} color="#3A8E5A" />
              <RevStat label="AOV" value={c.aov_thb ? `฿${Math.round(c.aov_thb).toLocaleString()}` : '—'} />
            </div>
          )}
        </>
      )}

      {/* Dates */}
      <div className="text-[10px] flex items-center gap-1" style={{ color: 'var(--admin-ink-faint)' }}>
        <Clock size={9} />
        {c.starts_at ? new Date(c.starts_at).toLocaleDateString('th-TH') : '—'}
        {' → '}
        {c.ends_at ? new Date(c.ends_at).toLocaleDateString('th-TH') : 'ไม่หมดอายุ'}
        {c.last_synced_at && <span className="ml-auto">sync {new Date(c.last_synced_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>}
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 pt-1" style={{ borderTop: '1px solid var(--admin-border-2)' }}>
        <Link href={`/admin/coupons/campaign/${c.price_rule_id}`}
          className="admin-btn admin-btn-ghost flex-1"
          style={{ padding: '6px 10px', fontSize: 11 }}>
          ดูรายละเอียด
        </Link>
        {c.shopify_only && (
          <button onClick={onImport} disabled={importing}
            className="admin-btn admin-btn-ink"
            style={{ padding: '6px 10px', fontSize: 11 }}>
            {importing ? <RefreshCw size={11} className="animate-spin" /> : <Download size={11} />}
            Import
          </button>
        )}
        <a href={`https://admin.shopify.com/store/dreame-thailand/discounts/${c.price_rule_id}`}
          target="_blank" rel="noopener noreferrer"
          className="admin-btn admin-btn-ghost"
          style={{ padding: '6px 8px', fontSize: 11 }}>
          <ExternalLink size={11} />
        </a>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <p className="text-base font-bold tabular-nums leading-none" style={{ color: color || 'var(--admin-ink)' }}>
        {value}
      </p>
      <p className="text-[9px] mt-1 uppercase tracking-wider" style={{ color: 'var(--admin-ink-mute)' }}>
        {label}
      </p>
    </div>
  )
}

function RevStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-left">
      <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--admin-ink-faint)' }}>
        {label}
      </p>
      <p className="text-xs font-bold tabular-nums" style={{ color: color || 'var(--admin-ink)' }}>
        {value}
      </p>
    </div>
  )
}
