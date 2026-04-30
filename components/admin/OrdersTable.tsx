'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Search, ChevronRight, Package, Check, X, Loader2,
  Database, ExternalLink, RefreshCw, Edit3, Save, Trash2,
  CheckCircle, XCircle,
} from 'lucide-react'
import { channelLabel, formatDate, formatDateTime } from '@/lib/utils'
import Drawer from './Drawer'

export type OrderRow = {
  id: string
  user_id: string
  order_sn: string
  invoice_no?: string | null
  model_name?: string | null
  sku?: string | null
  serial_number?: string | null
  channel: string
  channel_type?: string
  status: string
  total_amount?: number | null
  points_awarded?: number | null
  purchase_date?: string | null
  warranty_start?: string | null
  warranty_end?: string | null
  admin_note?: string | null
  approved_by?: string | null
  approved_at?: string | null
  receipt_image_url?: string | null
  created_at: string
  users: { full_name: string | null; member_id: string | null; phone: string | null } | null
}

type StatusFilter = '' | 'PENDING' | 'BQ_VERIFIED' | 'ADMIN_APPROVED' | 'REJECTED'

interface Props {
  initialItems: OrderRow[]
  totalCount: number
  statusCounts: Record<string, number>
  page: number
  pageSize: number
}

const STATUS_PILL: Record<string, string> = {
  ADMIN_APPROVED: 'admin-pill admin-pill-green',
  BQ_VERIFIED:    'admin-pill admin-pill-green',
  PENDING:        'admin-pill admin-pill-amber',
  REJECTED:       'admin-pill admin-pill-red',
}
const STATUS_LABEL: Record<string, string> = {
  ADMIN_APPROVED: 'อนุมัติ',
  BQ_VERIFIED:    'ยืนยันแล้ว',
  PENDING:        'รอตรวจ',
  REJECTED:       'ปฏิเสธ',
}

const POLL_MS = 25_000

function formatTime(d: Date) {
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function OrdersTable({ initialItems, totalCount, statusCounts, page, pageSize }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [items, setItems] = useState(initialItems)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const localRemovalsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    setItems(initialItems.filter(it => !localRemovalsRef.current.has(it.id)))
    setLastUpdated(new Date())
  }, [initialItems])

  useEffect(() => {
    const id = setInterval(() => router.refresh(), POLL_MS)
    return () => clearInterval(id)
  }, [router])

  function setQS(updates: Record<string, string | null>) {
    const sp = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '') sp.delete(k)
      else sp.set(k, v)
    }
    if ('status' in updates || 'q' in updates || 'channel' in updates || 'from' in updates || 'to' in updates) {
      sp.delete('page')
    }
    router.push(`${pathname}?${sp.toString()}`)
  }

  const currentStatus = (searchParams.get('status') || '') as StatusFilter
  const totalPages = Math.ceil(totalCount / pageSize)
  const selected = useMemo(() => items.find(p => p.id === selectedId) || null, [items, selectedId])

  function manualRefresh() {
    setRefreshing(true)
    router.refresh()
    setTimeout(() => setRefreshing(false), 500)
  }

  function removeRowLocal(id: string) {
    localRemovalsRef.current.add(id)
    setItems(prev => prev.filter(p => p.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  function patchRowLocal(id: string, patch: Partial<OrderRow>) {
    setItems(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
  }

  const statusChips: Array<{ key: StatusFilter; label: string; count: number }> = [
    { key: '',               label: 'ทั้งหมด',    count: statusCounts.all || 0 },
    { key: 'PENDING',        label: 'รอตรวจ',     count: statusCounts.PENDING || 0 },
    { key: 'BQ_VERIFIED',    label: 'ยืนยันแล้ว', count: statusCounts.BQ_VERIFIED || 0 },
    { key: 'ADMIN_APPROVED', label: 'อนุมัติ',    count: statusCounts.ADMIN_APPROVED || 0 },
    { key: 'REJECTED',       label: 'ปฏิเสธ',     count: statusCounts.REJECTED || 0 },
  ]

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 className="admin-h1">สินค้าทั้งหมด</h1>
          <p className="admin-sub">
            {totalCount.toLocaleString()} รายการ
            {lastUpdated && (
              <>
                {' · '}
                <span suppressHydrationWarning style={{ color: 'var(--ink-faint)', fontSize: 11 }}>
                  อัปเดตล่าสุด {formatTime(lastUpdated)}
                </span>
              </>
            )}
          </p>
        </div>
        <button
          onClick={manualRefresh}
          disabled={refreshing}
          className="admin-btn admin-btn-ghost"
          style={{ padding: '6px 12px', fontSize: 12, gap: 6 }}
        >
          {refreshing ? <Loader2 size={12} className="spinner" /> : <RefreshCw size={12} />}
          รีเฟรช
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {statusChips.map(c => {
          const active = currentStatus === c.key
          return (
            <button
              key={c.key || 'all'}
              onClick={() => setQS({ status: c.key || null })}
              className={`admin-btn ${active ? 'admin-btn-ink' : 'admin-btn-ghost'}`}
              style={{ padding: '6px 12px', fontSize: 12, gap: 6 }}
            >
              {c.label}
              <span style={{
                fontSize: 10.5, padding: '1px 7px', borderRadius: 100,
                background: active ? 'rgba(255,255,255,0.18)' : 'var(--bg-soft)',
                color: active ? '#fff' : 'var(--ink-mute)',
                fontWeight: 700,
              }}>{c.count}</span>
            </button>
          )
        })}
      </div>

      <FilterForm initialQS={searchParams.toString()} />

      <div className="admin-card" style={{ overflow: 'hidden' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>สมาชิก</th>
              <th>สินค้า</th>
              <th>ช่องทาง</th>
              <th>สถานะ</th>
              <th>ยอด</th>
              <th>คะแนน</th>
              <th>วันที่</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(p => (
              <Row
                key={p.id}
                row={p}
                active={selectedId === p.id}
                onSelect={() => setSelectedId(p.id)}
              />
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--ink-mute)' }}>
            <Package size={28} style={{ margin: '0 auto 8px', display: 'block', color: 'var(--ink-faint)' }} />
            <p style={{ margin: 0, fontSize: 13 }}>ไม่พบข้อมูล</p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .slice(Math.max(0, page - 4), page + 3)
            .map(n => (
              <button
                key={n}
                onClick={() => setQS({ page: String(n) })}
                className={n === page ? 'admin-btn admin-btn-ink' : 'admin-btn admin-btn-ghost'}
                style={{ padding: '6px 12px', fontSize: 12, minWidth: 32 }}
              >
                {n}
              </button>
            ))}
        </div>
      )}

      {/* ── Detail drawer ── */}
      <Drawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected ? (selected.model_name || `Order ${selected.order_sn}`) : ''}
        subtitle={selected ? selected.order_sn : ''}
        width={620}
      >
        {selected && (
          <DetailPanel
            row={selected}
            onLocalRemove={() => removeRowLocal(selected.id)}
            onLocalPatch={patch => patchRowLocal(selected.id, patch)}
          />
        )}
      </Drawer>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Row (clicking opens the drawer)
// ────────────────────────────────────────────────────────────────

function Row({ row, active, onSelect }: { row: OrderRow; active: boolean; onSelect: () => void }) {
  const u = row.users
  return (
    <tr
      onClick={onSelect}
      style={{
        cursor: 'pointer',
        background: active ? 'var(--bg-soft)' : undefined,
      }}
    >
      <td className="num" style={{ fontSize: 11 }}>{row.order_sn}</td>
      <td>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 12.5 }}>{u?.full_name || '-'}</p>
        <p className="num muted" style={{ margin: 0, fontSize: 10.5 }}>{u?.member_id || '-'}</p>
      </td>
      <td>
        <p style={{ margin: 0, fontSize: 12.5, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.model_name || '-'}
        </p>
        {row.serial_number && (
          <p className="muted" style={{ margin: 0, fontSize: 10.5 }}>SN: {row.serial_number}</p>
        )}
      </td>
      <td className="muted" style={{ fontSize: 11 }}>{channelLabel(row.channel)}</td>
      <td>
        <span className={STATUS_PILL[row.status] || 'admin-pill'}>
          {STATUS_LABEL[row.status] || row.status}
        </span>
      </td>
      <td className="num" style={{ fontWeight: 700 }}>฿{Number(row.total_amount || 0).toLocaleString()}</td>
      <td className="num" style={{ color: 'var(--gold-deep)', fontWeight: 600 }}>
        {Number(row.points_awarded || 0) > 0 ? `+${Number(row.points_awarded).toLocaleString()}` : '-'}
      </td>
      <td className="muted" style={{ fontSize: 11 }}>{formatDate(row.created_at)}</td>
      <td>
        <ChevronRight size={14} color="var(--ink-faint)" />
      </td>
    </tr>
  )
}

// ────────────────────────────────────────────────────────────────
// Drawer detail panel (single column — fits in 620px-wide drawer)
// ────────────────────────────────────────────────────────────────

function DetailPanel({
  row, onLocalRemove, onLocalPatch,
}: {
  row: OrderRow
  onLocalRemove: () => void
  onLocalPatch: (patch: Partial<OrderRow>) => void
}) {
  const isPending = row.status === 'PENDING'
  const isOnline = row.channel_type === 'ONLINE'
  const u = row.users

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Status banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className={STATUS_PILL[row.status] || 'admin-pill'} style={{ fontSize: 12 }}>
          {STATUS_LABEL[row.status] || row.status}
        </span>
        <span className="muted" style={{ fontSize: 11 }}>
          ลงทะเบียน {formatDate(row.created_at)} · {channelLabel(row.channel)}
        </span>
      </div>

      {/* Action panel */}
      <ActionPanel
        row={row}
        isPending={isPending}
        isOnline={isOnline}
        onLocalRemove={onLocalRemove}
        onLocalPatch={onLocalPatch}
      />

      {/* Edit form */}
      <EditForm row={row} onLocalPatch={onLocalPatch} />

      {/* Member info */}
      <div className="admin-card" style={{ padding: 14 }}>
        <p style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: '0 0 8px' }}>
          สมาชิก
        </p>
        <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 13 }}>{u?.full_name || '-'}</p>
        <p style={{ margin: '0 0 2px', fontSize: 11.5, color: 'var(--ink-mute)' }}>
          {u?.member_id || '-'} · {u?.phone || '-'}
        </p>
        {row.user_id && (
          <Link href={`/admin/members/${row.user_id}`}
            style={{ marginTop: 8, fontSize: 11, color: 'var(--gold-deep)', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
            ดูโปรไฟล์เต็ม <ChevronRight size={11} />
          </Link>
        )}
      </div>

      {/* Receipt */}
      {row.receipt_image_url && (
        <div className="admin-card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <p style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>
              ใบเสร็จ
            </p>
            <a href={row.receipt_image_url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, color: 'var(--gold-deep)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              เปิดเต็ม <ExternalLink size={11} />
            </a>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={row.receipt_image_url} alt="receipt"
            style={{ width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 'var(--r-sm)', background: 'var(--bg-soft)' }} />
        </div>
      )}

      {/* Approval meta */}
      {row.approved_at && (
        <div className="admin-card" style={{ padding: 12, fontSize: 11.5, color: 'var(--ink-mute)' }}>
          {row.status === 'REJECTED'
            ? <XCircle size={12} color='var(--red)' style={{ verticalAlign: 'middle', marginRight: 4 }} />
            : <CheckCircle size={12} color='var(--green)' style={{ verticalAlign: 'middle', marginRight: 4 }} />}
          {row.status === 'REJECTED' ? 'ปฏิเสธเมื่อ ' : 'อนุมัติเมื่อ '}{formatDateTime(row.approved_at)}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Edit form
// ────────────────────────────────────────────────────────────────

function EditForm({ row, onLocalPatch }: { row: OrderRow; onLocalPatch: (patch: Partial<OrderRow>) => void }) {
  const [model_name, setModelName] = useState(row.model_name || '')
  const [serial_number, setSerial] = useState(row.serial_number || '')
  const [invoice_no, setInvoice] = useState(row.invoice_no || '')
  const [sku, setSku] = useState(row.sku || '')
  const [total_amount, setTotal] = useState(String(row.total_amount ?? ''))
  const [purchase_date, setPurchaseDate] = useState(row.purchase_date || '')
  const [warranty_end, setWarrantyEnd] = useState(row.warranty_end || '')
  const [admin_note, setAdminNote] = useState(row.admin_note || '')
  const [channel, setChannel] = useState(row.channel)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Reset form when row changes (e.g. user picks a different row in the drawer)
  useEffect(() => {
    setModelName(row.model_name || '')
    setSerial(row.serial_number || '')
    setInvoice(row.invoice_no || '')
    setSku(row.sku || '')
    setTotal(String(row.total_amount ?? ''))
    setPurchaseDate(row.purchase_date || '')
    setWarrantyEnd(row.warranty_end || '')
    setAdminNote(row.admin_note || '')
    setChannel(row.channel)
    setSaved(false); setError('')
  }, [row.id])  // eslint-disable-line react-hooks/exhaustive-deps

  const initial = useMemo(() => ({
    model_name: row.model_name || '', serial_number: row.serial_number || '',
    invoice_no: row.invoice_no || '', sku: row.sku || '',
    total_amount: String(row.total_amount ?? ''),
    purchase_date: row.purchase_date || '', warranty_end: row.warranty_end || '',
    admin_note: row.admin_note || '', channel: row.channel,
  }), [row])

  const dirty =
    model_name !== initial.model_name || serial_number !== initial.serial_number ||
    invoice_no !== initial.invoice_no || sku !== initial.sku ||
    total_amount !== initial.total_amount || purchase_date !== initial.purchase_date ||
    warranty_end !== initial.warranty_end || admin_note !== initial.admin_note ||
    channel !== initial.channel

  async function save() {
    setSaving(true); setError(''); setSaved(false)
    try {
      const res = await fetch(`/api/admin/purchases/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'edit',
          model_name, serial_number, invoice_no, sku, channel,
          total_amount, purchase_date, warranty_end, admin_note,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'บันทึกไม่สำเร็จ'); return }
      onLocalPatch({
        model_name, serial_number, invoice_no, sku, channel,
        total_amount: Number(total_amount) || 0,
        purchase_date: purchase_date || null,
        warranty_end: warranty_end || null,
        admin_note,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('เชื่อมต่อไม่ได้')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Edit3 size={13} color="var(--ink-mute)" />
        <p style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', margin: 0 }}>
          แก้ไขข้อมูล
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="ชื่อสินค้า" value={model_name} onChange={setModelName} colSpan={2} />
        <Field label="SKU" value={sku} onChange={setSku} />
        <Field label="Serial number" value={serial_number} onChange={setSerial} />
        <Field label="Invoice no." value={invoice_no} onChange={setInvoice} />
        <SelectField label="ช่องทาง" value={channel} onChange={setChannel} options={[
          ['SHOPEE', 'Shopee'], ['LAZADA', 'Lazada'], ['WEBSITE', 'Website'],
          ['TIKTOK', 'TikTok'], ['STORE', 'หน้าร้าน'], ['OTHER', 'อื่นๆ'],
        ]} />
        <Field label="ยอด (THB)" value={total_amount} onChange={setTotal} type="number" />
        <Field label="วันที่ซื้อ" value={purchase_date} onChange={setPurchaseDate} type="date" />
        <Field label="ประกันหมด" value={warranty_end} onChange={setWarrantyEnd} type="date" colSpan={2} />
        <Field label="หมายเหตุ" value={admin_note} onChange={setAdminNote} colSpan={2} multiline />
      </div>

      {error && <p style={{ marginTop: 10, fontSize: 11.5, color: 'var(--red)' }}>⚠️ {error}</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
        <button
          onClick={save} disabled={saving || !dirty}
          className="admin-btn admin-btn-ink"
          style={{ padding: '6px 14px', fontSize: 12, gap: 6 }}
        >
          {saving ? <Loader2 size={12} className="spinner" /> : <Save size={12} />}
          บันทึก
        </button>
        {saved && <span style={{ fontSize: 11.5, color: 'var(--green)', fontWeight: 600 }}>✓ บันทึกแล้ว</span>}
        {dirty && !saved && <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>มีการแก้ไขที่ยังไม่บันทึก</span>}
      </div>
    </div>
  )
}

function Field({
  label, value, onChange, type = 'text', colSpan = 1, multiline = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; colSpan?: number; multiline?: boolean;
}) {
  return (
    <div style={{ gridColumn: `span ${colSpan}` }}>
      <p style={{ fontSize: 9.5, color: 'var(--ink-mute)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 4px' }}>
        {label}
      </p>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          className="admin-field"
          rows={2}
          style={{ width: '100%', fontSize: 12, resize: 'vertical' }}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="admin-field"
          style={{ width: '100%', fontSize: 12 }}
        />
      )}
    </div>
  )
}

function SelectField({
  label, value, onChange, options, colSpan = 1,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: [string, string][]; colSpan?: number;
}) {
  return (
    <div style={{ gridColumn: `span ${colSpan}` }}>
      <p style={{ fontSize: 9.5, color: 'var(--ink-mute)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 4px' }}>
        {label}
      </p>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="admin-field"
        style={{ width: '100%', fontSize: 12 }}
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Action panel
// ────────────────────────────────────────────────────────────────

function ActionPanel({
  row, isPending, isOnline, onLocalRemove, onLocalPatch,
}: {
  row: OrderRow
  isPending: boolean
  isOnline: boolean
  onLocalRemove: () => void
  onLocalPatch: (patch: Partial<OrderRow>) => void
}) {
  const router = useRouter()
  const [confirm, setConfirm] = useState<'approve' | 'reject' | 'delete' | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [bqState, setBqState] = useState<{ kind: string; msg?: string }>({ kind: 'idle' })
  const [error, setError] = useState('')

  // Reset transient state when the selected row changes
  useEffect(() => {
    setConfirm(null); setNote(''); setError('')
    setBqState({ kind: 'idle' })
  }, [row.id])

  async function decide(status: 'ADMIN_APPROVED' | 'REJECTED') {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/admin/purchases/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_note: note }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
      onLocalPatch({ status, admin_note: note, approved_at: new Date().toISOString() })
      setConfirm(null); setNote('')
      router.refresh()
    } catch {
      setError('เชื่อมต่อไม่ได้')
    } finally {
      setLoading(false)
    }
  }

  async function recheckBQ() {
    setBqState({ kind: 'loading' })
    try {
      const res = await fetch(`/api/admin/purchases/${row.id}/recheck-bq`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setBqState({ kind: 'error', msg: data.error || 'เกิดข้อผิดพลาด' }); return }
      if (data.status === 'VERIFIED') {
        setBqState({ kind: 'verified', msg: `อนุมัติอัตโนมัติ · ${data.staff_name || 'Admin'}` })
        onLocalPatch({ status: 'BQ_VERIFIED' })
        router.refresh()
      } else if (data.status === 'SKIPPED') setBqState({ kind: 'skipped', msg: data.message })
      else setBqState({ kind: 'not_found', msg: 'ยังไม่พบใน BigQuery' })
    } catch {
      setBqState({ kind: 'error', msg: 'เชื่อมต่อไม่ได้' })
    }
  }

  async function doDelete() {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/admin/purchases/${row.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'ลบไม่สำเร็จ'); return }
      onLocalRemove()
      router.refresh()
    } catch {
      setError('เชื่อมต่อไม่ได้')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-card" style={{ padding: 14 }}>
      <p style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: '0 0 10px' }}>
        การดำเนินการ
      </p>

      {confirm === 'approve' || confirm === 'reject' ? (
        <div style={{
          padding: 10, borderRadius: 'var(--r-md)',
          background: confirm === 'approve' ? 'var(--green-soft)' : 'var(--red-soft)',
          border: `1px solid ${confirm === 'approve' ? 'rgba(46,122,61,0.20)' : 'rgba(139,58,58,0.20)'}`,
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 8px',
            color: confirm === 'approve' ? 'var(--green)' : 'var(--red)' }}>
            {confirm === 'approve' ? '✅ ยืนยันการอนุมัติ?' : '❌ ยืนยันการปฏิเสธ?'}
          </p>
          <input
            type="text" placeholder="หมายเหตุ (ถ้ามี)"
            value={note} onChange={e => setNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && decide(confirm === 'approve' ? 'ADMIN_APPROVED' : 'REJECTED')}
            autoFocus className="admin-field" style={{ marginBottom: 8, fontSize: 12, width: '100%' }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => decide(confirm === 'approve' ? 'ADMIN_APPROVED' : 'REJECTED')}
              disabled={loading}
              className={confirm === 'approve' ? 'admin-btn admin-btn-ink' : 'admin-btn admin-btn-danger'}
              style={{ flex: 1, padding: '7px 10px', fontSize: 12, gap: 4 }}>
              {loading ? <Loader2 size={11} className="spinner" /> :
                confirm === 'approve' ? <><Check size={11} /> ยืนยัน</> : <><X size={11} /> ปฏิเสธ</>}
            </button>
            <button onClick={() => { setConfirm(null); setNote(''); setError('') }}
              className="admin-btn admin-btn-ghost" style={{ flex: 1, padding: '7px 10px', fontSize: 12 }}>
              ยกเลิก
            </button>
          </div>
        </div>
      ) : confirm === 'delete' ? (
        <div style={{
          padding: 10, borderRadius: 'var(--r-md)',
          background: 'var(--red-soft)', border: '1px solid rgba(139,58,58,0.20)',
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 4px', color: 'var(--red)' }}>
            ⚠️ ลบรายการนี้?
          </p>
          <p style={{ fontSize: 11, margin: '0 0 8px', color: 'var(--red)' }}>
            จะลบประวัติคะแนน + คืนแต้ม {Number(row.points_awarded || 0).toLocaleString()} pts
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={doDelete} disabled={loading}
              className="admin-btn admin-btn-danger" style={{ flex: 1, padding: '7px 10px', fontSize: 12, gap: 4 }}>
              {loading ? <Loader2 size={11} className="spinner" /> : <><Trash2 size={11} /> ลบ</>}
            </button>
            <button onClick={() => setConfirm(null)}
              className="admin-btn admin-btn-ghost" style={{ flex: 1, padding: '7px 10px', fontSize: 12 }}>
              ยกเลิก
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {isPending && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setConfirm('approve')}
                className="admin-btn"
                style={{ flex: 1, padding: '8px 12px', fontSize: 12.5, gap: 6, fontWeight: 700,
                  background: 'var(--green-soft)', color: 'var(--green)',
                  borderColor: 'rgba(46,122,61,0.20)' }}>
                <Check size={12} /> อนุมัติ
              </button>
              <button onClick={() => setConfirm('reject')}
                className="admin-btn admin-btn-danger" style={{ flex: 1, padding: '8px 12px', fontSize: 12.5, gap: 6, fontWeight: 700 }}>
                <X size={12} /> ปฏิเสธ
              </button>
            </div>
          )}
          {isPending && isOnline && (
            <button onClick={recheckBQ}
              disabled={bqState.kind === 'loading' || bqState.kind === 'verified'}
              className="admin-btn admin-btn-ghost"
              style={{ padding: '7px 12px', fontSize: 12, gap: 6 }}>
              {bqState.kind === 'loading' ? <Loader2 size={12} className="spinner" /> : <Database size={12} />}
              ลองดึง BigQuery ตอนนี้
            </button>
          )}
          <button onClick={() => setConfirm('delete')}
            className="admin-btn admin-btn-ghost"
            style={{ padding: '7px 12px', fontSize: 12, gap: 6, color: 'var(--red)', borderColor: 'rgba(139,58,58,0.20)' }}>
            <Trash2 size={12} /> ลบรายการ
          </button>
        </div>
      )}

      {bqState.kind !== 'idle' && bqState.kind !== 'loading' && (
        <p style={{
          margin: '8px 0 0', fontSize: 11,
          color:
            bqState.kind === 'verified' ? 'var(--green)' :
            bqState.kind === 'not_found' || bqState.kind === 'skipped' ? 'var(--amber)' :
            'var(--red)',
        }}>
          {bqState.kind === 'verified' ? '✓ ' : bqState.kind === 'error' ? '⚠️ ' : ''}{bqState.msg}
        </p>
      )}

      {error && <p style={{ marginTop: 8, fontSize: 11, color: 'var(--red)' }}>⚠️ {error}</p>}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Filter form (search / channel / dates)
// ────────────────────────────────────────────────────────────────

function FilterForm({ initialQS }: { initialQS: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = new URLSearchParams(initialQS)
  const [q, setQ] = useState(sp.get('q') || '')
  const [channel, setChannel] = useState(sp.get('channel') || '')
  const [from, setFrom] = useState(sp.get('from') || '')
  const [to, setTo] = useState(sp.get('to') || '')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const cur = new URLSearchParams(initialQS)
    if (q) cur.set('q', q); else cur.delete('q')
    if (channel) cur.set('channel', channel); else cur.delete('channel')
    if (from) cur.set('from', from); else cur.delete('from')
    if (to) cur.set('to', to); else cur.delete('to')
    cur.delete('page')
    router.push(`${pathname}?${cur.toString()}`)
  }

  function clear() {
    router.push(pathname)
  }

  const hasFilters = q || channel || from || to

  return (
    <form onSubmit={submit} className="admin-card" style={{ padding: 12, marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <div style={{ position: 'relative', flex: '1 1 280px', minWidth: 200 }}>
        <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint)' }} />
        <input name="q" value={q} onChange={e => setQ(e.target.value)}
          placeholder="ค้นหา order_sn, serial, model, ผู้ใช้..."
          className="admin-field" style={{ paddingLeft: 34, fontSize: 12 }} />
      </div>
      <select value={channel} onChange={e => setChannel(e.target.value)}
        className="admin-field" style={{ width: 130, fontSize: 12 }}>
        <option value="">ทุกช่องทาง</option>
        <option value="SHOPEE">Shopee</option>
        <option value="LAZADA">Lazada</option>
        <option value="WEBSITE">Website</option>
        <option value="TIKTOK">TikTok</option>
        <option value="STORE">หน้าร้าน</option>
        <option value="OTHER">อื่นๆ</option>
      </select>
      <input type="date" value={from} onChange={e => setFrom(e.target.value)}
        className="admin-field" style={{ width: 140, fontSize: 12 }} />
      <input type="date" value={to} onChange={e => setTo(e.target.value)}
        className="admin-field" style={{ width: 140, fontSize: 12 }} />
      <button type="submit" className="admin-btn admin-btn-ink" style={{ padding: '0 18px', fontSize: 12 }}>
        ค้นหา
      </button>
      {hasFilters && (
        <button type="button" onClick={clear} className="admin-btn admin-btn-ghost" style={{ padding: '0 14px', fontSize: 12 }}>
          ล้าง
        </button>
      )}
    </form>
  )
}
