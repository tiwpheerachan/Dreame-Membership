'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Clock, CheckCircle, Loader2, Check, X, ExternalLink, Database,
  RefreshCw, Search, ShoppingBag, Globe, Store as StoreIcon, Sparkles,
  Package, ChevronRight,
} from 'lucide-react'
import { channelLabel, formatDate, formatDateTime } from '@/lib/utils'
import Drawer from './Drawer'

export type PendingPurchase = {
  id: string
  user_id?: string
  order_sn: string
  model_name: string | null
  sku?: string | null
  channel: string
  channel_type: 'ONLINE' | 'ONSITE' | string
  created_at: string
  serial_number: string | null
  invoice_no?: string | null
  total_amount: number | null
  purchase_date?: string | null
  receipt_image_url: string | null
  admin_note?: string | null
  users: {
    full_name: string | null
    phone: string | null
    member_id: string | null
  } | null
}

const POLL_MS = 25_000

const CHANNEL_ICON: Record<string, typeof ShoppingBag> = {
  SHOPEE: ShoppingBag, LAZADA: ShoppingBag, WEBSITE: Globe,
  TIKTOK: Sparkles, STORE: StoreIcon, OTHER: Package,
}

function formatTime(d: Date) {
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// Compact relative time (e.g. "2 นาที", "5 ชม.", "3 วัน") — useful when admin
// needs to spot orders that have been waiting too long.
function relativeAge(iso: string): { label: string; isOld: boolean } {
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return { label: `${Math.max(0, minutes)} นาที`, isOld: false }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { label: `${hours} ชม.`, isOld: hours >= 6 }
  const days = Math.floor(hours / 24)
  return { label: `${days} วัน`, isOld: true }
}

export default function PendingList({ initialItems }: { initialItems: PendingPurchase[] }) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [q, setQ] = useState('')
  const [channelFilter, setChannelFilter] = useState<'all' | 'ONLINE' | 'ONSITE'>('all')
  const localRemovalsRef = useRef<Set<string>>(new Set())

  // Sync prop → state and refresh "last updated"
  useEffect(() => {
    setItems(initialItems.filter(it => !localRemovalsRef.current.has(it.id)))
    setLastUpdated(new Date())
  }, [initialItems])

  // Poll every POLL_MS so newly registered pending orders appear automatically
  useEffect(() => {
    const id = setInterval(() => router.refresh(), POLL_MS)
    return () => clearInterval(id)
  }, [router])

  function removeItem(id: string) {
    localRemovalsRef.current.add(id)
    setItems(prev => prev.filter(p => p.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  function manualRefresh() {
    setRefreshing(true)
    router.refresh()
    setTimeout(() => setRefreshing(false), 500)
  }

  // Filter by search + channel
  const filtered = useMemo(() => {
    let list = items
    if (channelFilter !== 'all') list = list.filter(i => i.channel_type === channelFilter)
    if (q) {
      const s = q.toLowerCase()
      list = list.filter(i =>
        i.order_sn.toLowerCase().includes(s) ||
        (i.model_name || '').toLowerCase().includes(s) ||
        (i.users?.full_name || '').toLowerCase().includes(s) ||
        (i.users?.member_id || '').toLowerCase().includes(s) ||
        (i.users?.phone || '').includes(s)
      )
    }
    return list
  }, [items, channelFilter, q])

  const counts = useMemo(() => ({
    all:    items.length,
    ONLINE: items.filter(i => i.channel_type === 'ONLINE').length,
    ONSITE: items.filter(i => i.channel_type !== 'ONLINE').length,
  }), [items])

  const selected = useMemo(() => items.find(i => i.id === selectedId) || null, [items, selectedId])

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="admin-h1">รอตรวจสอบ</h1>
          <p className="admin-sub">
            {items.length > 0 ? `${items.length} รายการรอดำเนินการ` : 'ไม่มีรายการรอดำเนินการ'}
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

      <BQLookup />

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        {/* Channel chips */}
        <div style={{ display: 'flex', gap: 4 }}>
          {([
            ['all',    'ทั้งหมด'],
            ['ONLINE', 'ออนไลน์'],
            ['ONSITE', 'หน้าร้าน'],
          ] as const).map(([k, label]) => {
            const active = channelFilter === k
            return (
              <button
                key={k}
                onClick={() => setChannelFilter(k)}
                className={`admin-btn ${active ? 'admin-btn-ink' : 'admin-btn-ghost'}`}
                style={{ padding: '6px 12px', fontSize: 12, gap: 6 }}
              >
                {label}
                <span style={{
                  fontSize: 10.5, padding: '1px 7px', borderRadius: 100,
                  background: active ? 'rgba(255,255,255,0.18)' : 'var(--bg-soft)',
                  color: active ? '#fff' : 'var(--ink-mute)', fontWeight: 700,
                }}>{counts[k]}</span>
              </button>
            )
          })}
        </div>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint)' }} />
          <input className="admin-field" placeholder="ค้นหา order_sn, ชื่อ, member_id..."
            value={q} onChange={e => setQ(e.target.value)}
            style={{ paddingLeft: 34, fontSize: 12, width: '100%' }} />
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="admin-card" style={{ padding: 60, textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, margin: '0 auto 14px',
            borderRadius: '50%', background: 'var(--bg-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Clock size={24} color="var(--ink-faint)" />
          </div>
          <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--ink)' }}>
            {items.length === 0 ? 'ไม่มีรายการรอดำเนินการ' : 'ไม่พบรายการที่ตรงกับตัวกรอง'}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-mute)' }}>
            {items.length === 0
              ? `ระบบจะแสดงรายการใหม่อัตโนมัติ (รีเฟรชเองทุก ${POLL_MS / 1000} วิ)`
              : 'ลองล้างตัวกรองหรือเปลี่ยนคำค้นหา'}
          </p>
        </div>
      ) : (
        <div className="admin-card" style={{ overflow: 'hidden' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>สมาชิก</th>
                <th>สินค้า</th>
                <th>ช่องทาง</th>
                <th>ยอด</th>
                <th>รอ</th>
                <th style={{ textAlign: 'right' }}>การดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <PendingRow
                  key={item.id}
                  item={item}
                  active={selectedId === item.id}
                  onSelect={() => setSelectedId(item.id)}
                  onRemove={() => removeItem(item.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer */}
      <Drawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected ? (selected.model_name || `Order ${selected.order_sn}`) : ''}
        subtitle={selected ? `${selected.order_sn} · ${channelLabel(selected.channel)}` : ''}
        width={560}
      >
        {selected && (
          <PendingDetail
            item={selected}
            onRemove={() => removeItem(selected.id)}
          />
        )}
      </Drawer>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Compact row: shows core info + quick actions
// ────────────────────────────────────────────────────────────────

function PendingRow({
  item, active, onSelect, onRemove,
}: {
  item: PendingPurchase
  active: boolean
  onSelect: () => void
  onRemove: () => void
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<null | 'approve' | 'reject' | 'bq'>(null)
  const [confirm, setConfirm] = useState<null | 'approve' | 'reject'>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const ChannelIcon = CHANNEL_ICON[item.channel] || Package
  const age = useMemo(() => relativeAge(item.created_at), [item.created_at])
  const isOnline = item.channel_type === 'ONLINE'

  async function decide(status: 'ADMIN_APPROVED' | 'REJECTED') {
    setBusy(status === 'ADMIN_APPROVED' ? 'approve' : 'reject')
    setErrorMsg('')
    try {
      const res = await fetch(`/api/admin/purchases/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_note: '' }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error || 'เกิดข้อผิดพลาด'); setBusy(null); setConfirm(null); return }
      onRemove()
      router.refresh()
    } catch {
      setErrorMsg('เชื่อมต่อไม่ได้')
      setBusy(null); setConfirm(null)
    }
  }

  async function recheckBQ() {
    setBusy('bq'); setErrorMsg('')
    try {
      const res = await fetch(`/api/admin/purchases/${item.id}/recheck-bq`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error || 'เกิดข้อผิดพลาด'); setBusy(null); return }
      if (data.status === 'VERIFIED') {
        onRemove()
        router.refresh()
      } else {
        setBusy(null)
        setErrorMsg(data.message || (data.status === 'SKIPPED' ? 'ข้ามไม่ตรวจ' : 'ยังไม่พบใน BigQuery'))
      }
    } catch {
      setErrorMsg('เชื่อมต่อไม่ได้')
      setBusy(null)
    }
  }

  // Stop click bubbling so action buttons don't open drawer
  function stop(e: React.MouseEvent) { e.stopPropagation() }

  return (
    <tr
      onClick={onSelect}
      style={{
        cursor: 'pointer',
        background: active ? 'var(--bg-soft)' : undefined,
      }}
    >
      <td className="num" style={{ fontSize: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {item.order_sn}
          {item.receipt_image_url && (
            <ExternalLink size={10} color="var(--ink-faint)" />
          )}
        </div>
      </td>
      <td>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 12.5, lineHeight: 1.3 }}>
          {item.users?.full_name || '-'}
        </p>
        <p className="num muted" style={{ margin: 0, fontSize: 10.5 }}>
          {item.users?.member_id || '-'}
          {item.users?.phone ? ` · ${item.users.phone}` : ''}
        </p>
      </td>
      <td>
        <p style={{ margin: 0, fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.model_name || '-'}
        </p>
        {item.serial_number && (
          <p className="muted" style={{ margin: 0, fontSize: 10 }}>SN: {item.serial_number}</p>
        )}
      </td>
      <td className="muted" style={{ fontSize: 11 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <ChannelIcon size={11} /> {channelLabel(item.channel)}
        </div>
      </td>
      <td className="num" style={{ fontWeight: 700, fontSize: 12 }}>
        {Number(item.total_amount || 0) > 0 ? `฿${Number(item.total_amount).toLocaleString()}` : '-'}
      </td>
      <td className="num" style={{ fontSize: 11, color: age.isOld ? 'var(--amber)' : 'var(--ink-mute)', fontWeight: age.isOld ? 700 : 500 }}>
        {age.label}
      </td>
      <td onClick={stop} style={{ textAlign: 'right' }}>
        {confirm ? (
          <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 11, color: confirm === 'approve' ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
              ยืนยัน{confirm === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}?
            </span>
            <button
              onClick={() => decide(confirm === 'approve' ? 'ADMIN_APPROVED' : 'REJECTED')}
              disabled={busy !== null}
              className={confirm === 'approve' ? 'admin-btn admin-btn-ink' : 'admin-btn admin-btn-danger'}
              style={{ padding: '4px 10px', fontSize: 11 }}
            >
              {busy ? <Loader2 size={11} className="spinner" /> : 'ยืนยัน'}
            </button>
            <button
              onClick={() => { setConfirm(null); setErrorMsg('') }}
              className="admin-btn admin-btn-ghost"
              style={{ padding: '4px 10px', fontSize: 11 }}
            >
              ยกเลิก
            </button>
          </div>
        ) : (
          <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end' }}>
            {isOnline && (
              <button
                onClick={recheckBQ}
                disabled={busy !== null}
                title="ลองดึงข้อมูลจาก BigQuery"
                className="admin-btn admin-btn-ghost"
                style={{ padding: '4px 8px', fontSize: 11, gap: 3 }}
              >
                {busy === 'bq' ? <Loader2 size={11} className="spinner" /> : <Database size={11} />}
                BQ
              </button>
            )}
            <button
              onClick={() => setConfirm('approve')}
              title="อนุมัติ"
              className="admin-btn"
              style={{
                padding: '4px 10px', fontSize: 11, gap: 3, fontWeight: 700,
                background: 'var(--green-soft)', color: 'var(--green)',
                borderColor: 'rgba(46,122,61,0.20)',
              }}
            >
              <Check size={11} /> อนุมัติ
            </button>
            <button
              onClick={() => setConfirm('reject')}
              title="ปฏิเสธ"
              className="admin-btn admin-btn-danger"
              style={{ padding: '4px 10px', fontSize: 11, gap: 3, fontWeight: 700 }}
            >
              <X size={11} />
            </button>
            <ChevronRight size={13} color="var(--ink-faint)" style={{ marginLeft: 2 }} />
          </div>
        )}
        {errorMsg && (
          <p style={{ margin: '4px 0 0', fontSize: 10.5, color: 'var(--red)', textAlign: 'right' }}>
            ⚠️ {errorMsg}
          </p>
        )}
      </td>
    </tr>
  )
}

// ────────────────────────────────────────────────────────────────
// Drawer detail: full info + admin_note + actions
// ────────────────────────────────────────────────────────────────

function PendingDetail({ item, onRemove }: { item: PendingPurchase; onRemove: () => void }) {
  const router = useRouter()
  const isOnline = item.channel_type === 'ONLINE'
  const [confirm, setConfirm] = useState<null | 'approve' | 'reject'>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [bqState, setBqState] = useState<{ kind: string; msg?: string }>({ kind: 'idle' })
  const [error, setError] = useState('')

  async function decide(status: 'ADMIN_APPROVED' | 'REJECTED') {
    setBusy(true); setError('')
    try {
      const res = await fetch(`/api/admin/purchases/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_note: note }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }
      onRemove()
      router.refresh()
    } catch { setError('เชื่อมต่อไม่ได้') }
    finally { setBusy(false) }
  }

  async function recheckBQ() {
    setBqState({ kind: 'loading' })
    try {
      const res = await fetch(`/api/admin/purchases/${item.id}/recheck-bq`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setBqState({ kind: 'error', msg: data.error || 'เกิดข้อผิดพลาด' }); return }
      if (data.status === 'VERIFIED') {
        setBqState({ kind: 'verified', msg: `อนุมัติอัตโนมัติ · ${data.staff_name || 'Admin'}` })
        setTimeout(() => { onRemove(); router.refresh() }, 800)
      } else if (data.status === 'SKIPPED') setBqState({ kind: 'skipped', msg: data.message })
      else setBqState({ kind: 'not_found', msg: 'ยังไม่พบใน BigQuery' })
    } catch {
      setBqState({ kind: 'error', msg: 'เชื่อมต่อไม่ได้' })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Status row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="admin-pill admin-pill-amber" style={{ fontSize: 11.5 }}>
          <Clock size={11} /> รอตรวจสอบ
        </span>
        <span className="muted" style={{ fontSize: 11 }}>
          ลงทะเบียน {formatDate(item.created_at)} · {channelLabel(item.channel)}
        </span>
      </div>

      {/* Action panel */}
      <div className="admin-card" style={{ padding: 14 }}>
        <p style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: '0 0 10px' }}>
          การดำเนินการ
        </p>

        <input
          type="text" placeholder="หมายเหตุ (ถ้ามี)"
          value={note} onChange={e => setNote(e.target.value)}
          className="admin-field" style={{ marginBottom: 10, fontSize: 12, width: '100%' }}
        />

        {confirm ? (
          <div style={{
            padding: 10, borderRadius: 'var(--r-md)',
            background: confirm === 'approve' ? 'var(--green-soft)' : 'var(--red-soft)',
            border: `1px solid ${confirm === 'approve' ? 'rgba(46,122,61,0.20)' : 'rgba(139,58,58,0.20)'}`,
            marginBottom: 8,
          }}>
            <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 8px',
              color: confirm === 'approve' ? 'var(--green)' : 'var(--red)' }}>
              {confirm === 'approve' ? '✅ ยืนยันการอนุมัติ?' : '❌ ยืนยันการปฏิเสธ?'}
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => decide(confirm === 'approve' ? 'ADMIN_APPROVED' : 'REJECTED')}
                disabled={busy}
                className={confirm === 'approve' ? 'admin-btn admin-btn-ink' : 'admin-btn admin-btn-danger'}
                style={{ flex: 1, padding: '7px 10px', fontSize: 12, gap: 4 }}>
                {busy ? <Loader2 size={11} className="spinner" /> :
                  confirm === 'approve' ? <><Check size={11} /> ยืนยัน</> : <><X size={11} /> ปฏิเสธ</>}
              </button>
              <button onClick={() => { setConfirm(null); setError('') }}
                className="admin-btn admin-btn-ghost" style={{ flex: 1, padding: '7px 10px', fontSize: 12 }}>
                ยกเลิก
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <button onClick={() => setConfirm('approve')}
              className="admin-btn"
              style={{
                flex: 1, padding: '8px 12px', fontSize: 12.5, gap: 6, fontWeight: 700,
                background: 'var(--green-soft)', color: 'var(--green)',
                borderColor: 'rgba(46,122,61,0.20)',
              }}>
              <Check size={12} /> อนุมัติ
            </button>
            <button onClick={() => setConfirm('reject')}
              className="admin-btn admin-btn-danger" style={{ flex: 1, padding: '8px 12px', fontSize: 12.5, gap: 6, fontWeight: 700 }}>
              <X size={12} /> ปฏิเสธ
            </button>
          </div>
        )}

        {isOnline && (
          <button onClick={recheckBQ}
            disabled={bqState.kind === 'loading' || bqState.kind === 'verified'}
            className="admin-btn admin-btn-ghost"
            style={{ width: '100%', padding: '7px 12px', fontSize: 12, gap: 6 }}>
            {bqState.kind === 'loading' ? <Loader2 size={12} className="spinner" /> : <Database size={12} />}
            ลองดึงข้อมูลจาก BigQuery
          </button>
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

      {/* Order info */}
      <div className="admin-card" style={{ padding: 14 }}>
        <p style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: '0 0 10px' }}>
          ข้อมูลออเดอร์
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', fontSize: 12 }}>
          <Info label="Order SN" value={item.order_sn} mono />
          {item.invoice_no && <Info label="Invoice" value={item.invoice_no} mono />}
          <Info label="ช่องทาง" value={channelLabel(item.channel)} />
          {item.purchase_date && <Info label="วันที่ซื้อ" value={formatDate(item.purchase_date)} />}
          {item.serial_number && <Info label="Serial" value={item.serial_number} mono />}
          {item.sku && <Info label="SKU" value={item.sku} mono />}
          {Number(item.total_amount || 0) > 0 && <Info label="ยอดรวม" value={`฿${Number(item.total_amount).toLocaleString()}`} bold />}
          <Info label="ลงทะเบียนเมื่อ" value={formatDateTime(item.created_at)} />
        </div>
      </div>

      {/* Member info */}
      <div className="admin-card" style={{ padding: 14 }}>
        <p style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: '0 0 8px' }}>
          สมาชิก
        </p>
        <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 13 }}>{item.users?.full_name || '-'}</p>
        <p style={{ margin: '0 0 2px', fontSize: 11.5, color: 'var(--ink-mute)' }}>
          {item.users?.member_id || '-'} · {item.users?.phone || '-'}
        </p>
        {item.user_id && (
          <Link href={`/admin/members/${item.user_id}`}
            style={{ marginTop: 8, fontSize: 11, color: 'var(--gold-deep)', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
            ดูโปรไฟล์เต็ม <ChevronRight size={11} />
          </Link>
        )}
      </div>

      {/* Receipt */}
      {item.receipt_image_url && (
        <div className="admin-card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <p style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>
              ใบเสร็จ
            </p>
            <a href={item.receipt_image_url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, color: 'var(--gold-deep)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              เปิดเต็ม <ExternalLink size={11} />
            </a>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.receipt_image_url} alt="receipt"
            style={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 'var(--r-sm)', background: 'var(--bg-soft)' }} />
        </div>
      )}
    </div>
  )
}

function Info({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: 9.5, color: 'var(--ink-mute)', margin: 0, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
        {label}
      </p>
      <p style={{
        margin: '2px 0 0', fontSize: 12,
        fontWeight: bold ? 700 : 500,
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        wordBreak: 'break-all',
      }}>{value}</p>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// BQ Lookup tool — left mostly as before but compact
// ────────────────────────────────────────────────────────────────

type LookupResult =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'found'; data: { order_sn: string; platform: string; total_amount: number; order_date: string; items: { item_name: string; item_sku: string; quantity: number; price: number }[] } }
  | { kind: 'not_found'; message: string }
  | { kind: 'bq_error'; message: string; bq_error: string }
  | { kind: 'error'; message: string }

function BQLookup() {
  const [orderSn, setOrderSn] = useState('')
  const [result, setResult] = useState<LookupResult>({ kind: 'idle' })
  const [open, setOpen] = useState(false)

  async function lookup() {
    const trimmed = orderSn.trim()
    if (!trimmed) return
    setResult({ kind: 'loading' })
    try {
      const res = await fetch(`/api/admin/bq/lookup?order_sn=${encodeURIComponent(trimmed)}`)
      const data = await res.json()
      if (!res.ok) { setResult({ kind: 'error', message: data.error || 'เกิดข้อผิดพลาด' }); return }
      if (data.found) setResult({ kind: 'found', data: data.order })
      else if (data.bq_error) setResult({ kind: 'bq_error', message: data.message || 'BQ failed', bq_error: data.bq_error })
      else setResult({ kind: 'not_found', message: data.message || 'ไม่พบ' })
    } catch { setResult({ kind: 'error', message: 'เชื่อมต่อไม่ได้' }) }
  }

  return (
    <div className="admin-card" style={{ padding: open ? 14 : '8px 14px', marginBottom: 12 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', padding: 0, color: 'var(--ink)',
          textAlign: 'left',
        }}
      >
        <Database size={14} color="var(--ink-mute)" />
        <p style={{ margin: 0, fontWeight: 600, fontSize: 12.5, flex: 1 }}>
          ค้นใน BigQuery {!open && <span className="muted" style={{ fontWeight: 500 }}>(คลิกเพื่อเปิด)</span>}
        </p>
        <ChevronRight size={14} color="var(--ink-faint)" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.18s' }} />
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="admin-field" type="text" placeholder="วาง order_sn เพื่อตรวจสอบกับ BigQuery"
              value={orderSn} onChange={e => setOrderSn(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && lookup()}
              style={{ flex: 1, fontSize: 12.5 }} />
            <button onClick={lookup} disabled={result.kind === 'loading' || !orderSn.trim()}
              className="admin-btn admin-btn-ink" style={{ padding: '0 16px' }}>
              {result.kind === 'loading' ? <Loader2 size={13} className="spinner" /> : 'ค้น'}
            </button>
          </div>

          {result.kind === 'found' && (
            <div style={{ marginTop: 10, padding: 12, background: 'var(--green-soft)', borderRadius: 'var(--r-md)', fontSize: 12 }}>
              <p style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--green)' }}>
                <CheckCircle size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                พบใน BigQuery
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 14px', color: 'var(--ink)' }}>
                <div>Platform: <strong>{result.data.platform}</strong></div>
                <div>วันที่: <strong>{result.data.order_date}</strong></div>
                <div>ยอดรวม: <strong>฿{Number(result.data.total_amount).toLocaleString()}</strong></div>
                <div>จำนวนรายการ: <strong>{result.data.items?.length || 0}</strong></div>
              </div>
            </div>
          )}
          {result.kind === 'not_found' && (
            <div style={{ marginTop: 10, padding: 10, background: 'var(--amber-soft)', borderRadius: 'var(--r-md)', fontSize: 12, color: 'var(--amber)' }}>
              {result.message}
            </div>
          )}
          {result.kind === 'bq_error' && (
            <div style={{ marginTop: 10, padding: 10, background: 'var(--red-soft)', borderRadius: 'var(--r-md)', fontSize: 12, color: 'var(--red)' }}>
              <p style={{ margin: '0 0 4px', fontWeight: 700 }}>⚠️ {result.message}</p>
              <p style={{ margin: 0, fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all' }}>{result.bq_error}</p>
            </div>
          )}
          {result.kind === 'error' && (
            <div style={{ marginTop: 10, padding: 10, background: 'var(--red-soft)', borderRadius: 'var(--r-md)', fontSize: 12, color: 'var(--red)' }}>
              ⚠️ {result.message}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
