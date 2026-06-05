'use client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Package, ChevronRight, RefreshCw, Truck, CheckCircle,
  Clock, XCircle, AlertCircle, Gift, X, Save,
} from 'lucide-react'

type Status = 'pending' | 'redeemed' | 'confirmed' | 'shipping' | 'delivered' | 'cancelled' | 'expired'
type RedeemType = 'POINTS_CASH' | 'VOUCHER' | 'PREMIUM'

interface Redemption {
  id: string
  user_id: string
  reward_id: string
  reward_snapshot: {
    name: string; image_url: string | null; points_required: number;
    redeem_type?: RedeemType;
    cash_top_up_thb?: number; voucher_value_thb?: number;
    shopify_product_url?: string;
  }
  shopify_code?: string | null
  shopify_apply_url?: string | null
  shopify_price_rule_id?: number | null
  code_expires_at?: string | null
  points_used: number
  shipping_name: string
  shipping_phone: string
  shipping_address: string
  shipping_subdistrict: string | null
  shipping_district: string
  shipping_province: string
  shipping_postcode: string
  shipping_note: string | null
  status: Status
  tracking_number: string | null
  tracking_carrier: string | null
  admin_note: string | null
  refund_reason: string | null
  created_at: string
  shipped_at: string | null
  delivered_at: string | null
  users: { id: string; full_name: string | null; member_id: string | null; tier: string | null; phone: string | null } | null
  rewards: { id: string; name: string; image_url: string | null } | null
}

const STATUS_META: Record<Status, { label: string; color: string; Icon: typeof Clock }> = {
  pending:   { label: 'รอ confirm',  color: '#C99B3E', Icon: Clock },
  redeemed:  { label: 'Code พร้อมใช้', color: '#C99B3E', Icon: Clock },
  confirmed: { label: 'ยืนยันแล้ว',   color: '#4A7BC1', Icon: CheckCircle },
  shipping:  { label: 'กำลังส่ง',    color: '#4A7BC1', Icon: Truck },
  delivered: { label: 'เสร็จสมบูรณ์', color: '#3A8E5A', Icon: CheckCircle },
  cancelled: { label: 'ยกเลิก',     color: '#B14242', Icon: XCircle },
  expired:   { label: 'หมดอายุ',    color: '#9CA29A', Icon: Clock },
}

type StatusFilter = 'all' | Status

export default function AdminRedemptionsPage() {
  const [items, setItems] = useState<Redemption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [selected, setSelected] = useState<Redemption | null>(null)

  async function load() {
    setLoading(true); setError('')
    try {
      const r = await fetch('/api/admin/redemptions', { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setItems(d.redemptions || [])
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    return filter === 'all' ? items : items.filter(i => i.status === filter)
  }, [items, filter])

  const counts = useMemo(() => ({
    all:       items.length,
    pending:   items.filter(i => i.status === 'pending').length,
    redeemed:  items.filter(i => i.status === 'redeemed').length,
    confirmed: items.filter(i => i.status === 'confirmed').length,
    shipping:  items.filter(i => i.status === 'shipping').length,
    delivered: items.filter(i => i.status === 'delivered').length,
    cancelled: items.filter(i => i.status === 'cancelled').length,
    expired:   items.filter(i => i.status === 'expired').length,
  }), [items])

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--admin-bg)' }}>
      {/* Breadcrumb */}
      <div className="border-b flex-shrink-0"
        style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <div className="px-6 lg:px-8 h-11 flex items-center gap-2 text-sm">
          <Link href="/admin" className="hover:opacity-70" style={{ color: 'var(--admin-ink-mute)' }}>Dashboard</Link>
          <ChevronRight size={12} style={{ color: 'var(--admin-ink-faint)' }} />
          <Link href="/admin/rewards" className="hover:opacity-70" style={{ color: 'var(--admin-ink-mute)' }}>Rewards</Link>
          <ChevronRight size={12} style={{ color: 'var(--admin-ink-faint)' }} />
          <span className="font-medium" style={{ color: 'var(--admin-ink)' }}>Redemptions</span>
        </div>
      </div>

      {/* Header */}
      <header className="border-b flex-shrink-0"
        style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <div className="px-6 lg:px-8 py-5 flex items-start justify-between gap-4">
          <div>
            <p style={{ color: '#C99B3E', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 4 }}>
              Fulfillment Queue
            </p>
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--admin-ink)' }}>
              <Package size={20} style={{ color: '#C99B3E' }} /> Redemptions
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--admin-ink-mute)' }}>
              {counts.all} รายการ · รอ {counts.pending} · กำลังส่ง {counts.shipping} · ส่งแล้ว {counts.delivered}
            </p>
          </div>
          <button onClick={load} disabled={loading} className="admin-btn admin-btn-ghost">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </header>

      {/* Filter chips */}
      <div className="border-b flex-shrink-0"
        style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <div className="px-6 lg:px-8 py-3 flex gap-1 flex-wrap">
          {([
            { k: 'all',       label: 'ทั้งหมด',     count: counts.all },
            { k: 'pending',   label: 'รอ confirm',  count: counts.pending },
            { k: 'redeemed',  label: 'Code พร้อมใช้', count: counts.redeemed },
            { k: 'confirmed', label: 'ยืนยันแล้ว',   count: counts.confirmed },
            { k: 'shipping',  label: 'กำลังส่ง',    count: counts.shipping },
            { k: 'delivered', label: 'เสร็จ',       count: counts.delivered },
            { k: 'cancelled', label: 'ยกเลิก',     count: counts.cancelled },
            { k: 'expired',   label: 'หมดอายุ',    count: counts.expired },
          ] as Array<{ k: StatusFilter; label: string; count: number }>).map(f => {
            const active = filter === f.k
            return (
              <button key={f.k} onClick={() => setFilter(f.k)}
                className={`admin-btn ${active ? 'admin-btn-ink' : 'admin-btn-ghost'}`}
                style={{ padding: '5px 12px', fontSize: 12, gap: 6 }}>
                {f.label}
                <span style={{
                  fontSize: 10.5, padding: '1px 7px', borderRadius: 100,
                  background: active ? 'rgba(232,197,140,0.20)' : 'var(--admin-bg)',
                  color: active ? '#E8C58C' : 'var(--admin-ink-mute)', fontWeight: 700,
                }}>{f.count}</span>
              </button>
            )
          })}
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

      {/* Table */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-5">
        {loading && items.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--admin-ink-mute)' }}>
            <RefreshCw size={20} className="mx-auto mb-2 animate-spin" /> โหลด…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--admin-ink-mute)' }}>
            <Package size={28} className="mx-auto mb-2" style={{ color: 'var(--admin-ink-faint)' }} />
            <p className="text-sm">ไม่มีรายการ</p>
          </div>
        ) : (
          <div className="admin-card overflow-hidden">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>สินค้า</th>
                  <th>สมาชิก</th>
                  <th>ที่อยู่</th>
                  <th>แต้ม</th>
                  <th>สถานะ</th>
                  <th>เวลา</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const { label, color, Icon } = STATUS_META[r.status]
                  return (
                    <tr key={r.id} onClick={() => setSelected(r)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div className="flex items-center gap-2">
                          {(r.reward_snapshot?.image_url || r.rewards?.image_url) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.reward_snapshot?.image_url || r.rewards?.image_url || ''}
                              alt="" className="w-8 h-8 rounded object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded flex items-center justify-center"
                              style={{ background: 'var(--admin-bg)' }}>
                              <Gift size={14} />
                            </div>
                          )}
                          <p className="text-xs font-semibold" style={{ color: 'var(--admin-ink)' }}>
                            {r.reward_snapshot?.name || r.rewards?.name || '—'}
                          </p>
                        </div>
                      </td>
                      <td>
                        <p className="text-xs font-semibold" style={{ color: 'var(--admin-ink)' }}>
                          {r.users?.full_name || r.shipping_name}
                        </p>
                        <p className="text-[10px] font-mono" style={{ color: 'var(--admin-ink-faint)' }}>
                          {r.users?.member_id} {r.users?.tier && `· ${r.users.tier}`}
                        </p>
                      </td>
                      <td>
                        <p className="text-[11px]" style={{ color: 'var(--admin-ink-soft)' }}>
                          {r.shipping_district}, {r.shipping_province} {r.shipping_postcode}
                        </p>
                      </td>
                      <td>
                        <span className="text-xs font-bold tabular-nums" style={{ color: '#C99B3E' }}>
                          {r.points_used.toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <span className="admin-pill"
                          style={{ background: `${color}1A`, color, fontSize: 10 }}>
                          <Icon size={9} /> {label}
                        </span>
                      </td>
                      <td>
                        <span className="text-[10px]" style={{ color: 'var(--admin-ink-faint)' }}>
                          {new Date(r.created_at).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td>
                        <ChevronRight size={12} style={{ color: 'var(--admin-ink-faint)' }} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <RedemptionDetail r={selected} onClose={() => setSelected(null)}
          onUpdated={() => { setSelected(null); load() }} />
      )}
    </div>
  )
}

// ============================================================
// Detail drawer
// ============================================================
function RedemptionDetail({ r, onClose, onUpdated }: {
  r: Redemption; onClose: () => void; onUpdated: () => void
}) {
  const [tracking, setTracking] = useState(r.tracking_number || '')
  const [carrier, setCarrier] = useState(r.tracking_carrier || '')
  const [note, setNote] = useState(r.admin_note || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmRefund, setConfirmRefund] = useState(false)
  const [refundReason, setRefundReason] = useState('')

  async function updateStatus(newStatus: Status) {
    setSaving(true); setError('')
    try {
      const r2 = await fetch(`/api/admin/redemptions/${r.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          tracking_number: tracking || undefined,
          tracking_carrier: carrier || undefined,
          admin_note: note || undefined,
        }),
      })
      const d = await r2.json()
      if (!r2.ok) throw new Error(d.error)
      onUpdated()
    } catch (e) { setError((e as Error).message); setSaving(false) }
  }

  async function saveTracking() {
    setSaving(true); setError('')
    try {
      const r2 = await fetch(`/api/admin/redemptions/${r.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tracking_number: tracking, tracking_carrier: carrier, admin_note: note }),
      })
      const d = await r2.json()
      if (!r2.ok) throw new Error(d.error)
      onUpdated()
    } catch (e) { setError((e as Error).message); setSaving(false) }
  }

  async function refund() {
    if (!refundReason.trim()) { setError('ระบุเหตุผล refund'); return }
    setSaving(true); setError('')
    try {
      const r2 = await fetch(`/api/admin/redemptions/${r.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refund: true, refund_reason: refundReason }),
      })
      const d = await r2.json()
      if (!r2.ok) throw new Error(d.error)
      onUpdated()
    } catch (e) { setError((e as Error).message); setSaving(false); setConfirmRefund(false) }
  }

  const meta = STATUS_META[r.status]
  const canCancel = r.status !== 'delivered' && r.status !== 'cancelled'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(14,14,14,0.45)', backdropFilter: 'blur(6px)' }}>
      <div className="admin-card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-start justify-between sticky top-0 z-10"
          style={{ borderColor: 'var(--admin-border)', background: 'var(--admin-card)' }}>
          <div className="flex items-start gap-3">
            {(r.reward_snapshot?.image_url || r.rewards?.image_url) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.reward_snapshot?.image_url || r.rewards?.image_url || ''}
                alt="" className="w-12 h-12 rounded-lg object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--admin-bg)' }}>
                <Gift size={20} />
              </div>
            )}
            <div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--admin-ink)' }}>
                {r.reward_snapshot?.name || r.rewards?.name}
              </h3>
              <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--admin-ink-faint)' }}>
                #{r.id.slice(0, 8)}
              </p>
              <span className="admin-pill mt-1"
                style={{ background: `${meta.color}1A`, color: meta.color, fontSize: 10 }}>
                <meta.Icon size={9} /> {meta.label}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--admin-ink-faint)' }}><X size={16}/></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Member info */}
          {/* Type-aware code section */}
          {r.reward_snapshot?.redeem_type === 'POINTS_CASH' && (
            <Section title="💰 Points + Cash">
              <div className="rounded-lg p-3 space-y-2"
                style={{ background: 'rgba(201,155,62,0.08)', border: '1px solid rgba(201,155,62,0.25)' }}>
                <p className="text-xs">
                  ลูกค้าจ่ายเพิ่ม: <b style={{ color: '#C99B3E' }}>
                    ฿{Number(r.reward_snapshot.cash_top_up_thb || 0).toLocaleString()}
                  </b>
                </p>
                {r.shopify_code ? (
                  <>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--admin-ink-mute)' }}>
                      รหัสส่วนลด
                    </p>
                    <code className="font-mono text-sm font-bold px-2 py-1 rounded inline-block"
                      style={{ background: 'var(--admin-card)', color: '#C99B3E', border: '1px dashed #C99B3E' }}>
                      {r.shopify_code}
                    </code>
                    {r.code_expires_at && (
                      <p className="text-[10px]" style={{ color: 'var(--admin-ink-faint)' }}>
                        หมดอายุ {new Date(r.code_expires_at).toLocaleString('th-TH')}
                      </p>
                    )}
                    {r.reward_snapshot.shopify_product_url && (
                      <a href={r.reward_snapshot.shopify_product_url} target="_blank" rel="noopener noreferrer"
                        className="admin-btn admin-btn-ghost text-[11px] mt-1">
                        เปิด product
                      </a>
                    )}
                  </>
                ) : (
                  <RegenerateCodeButton redemptionId={r.id} onDone={onUpdated} />
                )}
              </div>
            </Section>
          )}

          {r.reward_snapshot?.redeem_type === 'VOUCHER' && (
            <Section title="🎟️ Voucher">
              <div className="rounded-lg p-3 space-y-2"
                style={{ background: 'rgba(74,123,193,0.08)', border: '1px solid rgba(74,123,193,0.25)' }}>
                <p className="text-xs">
                  มูลค่าคูปอง: <b style={{ color: '#4A7BC1' }}>
                    ฿{Number(r.reward_snapshot.voucher_value_thb || 0).toLocaleString()}
                  </b>
                </p>
                {r.shopify_code ? (
                  <>
                    <code className="font-mono text-sm font-bold px-2 py-1 rounded inline-block"
                      style={{ background: 'var(--admin-card)', color: '#4A7BC1', border: '1px dashed #4A7BC1' }}>
                      {r.shopify_code}
                    </code>
                    {r.code_expires_at && (
                      <p className="text-[10px]" style={{ color: 'var(--admin-ink-faint)' }}>
                        หมดอายุ {new Date(r.code_expires_at).toLocaleString('th-TH')}
                      </p>
                    )}
                  </>
                ) : (
                  <RegenerateCodeButton redemptionId={r.id} onDone={onUpdated} />
                )}
              </div>
            </Section>
          )}

          <Section title="สมาชิก">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Kv k="ชื่อ" v={r.users?.full_name || r.shipping_name} />
              <Kv k="Member ID" v={r.users?.member_id || '—'} />
              <Kv k="Tier" v={r.users?.tier || '—'} />
              <Kv k="โทร" v={r.users?.phone || r.shipping_phone} />
            </div>
          </Section>

          {/* Shipping */}
          <Section title="ที่อยู่จัดส่ง">
            <p className="text-xs" style={{ color: 'var(--admin-ink-soft)', lineHeight: 1.6 }}>
              <strong>{r.shipping_name}</strong> · {r.shipping_phone}<br/>
              {r.shipping_address}<br/>
              {r.shipping_subdistrict && `${r.shipping_subdistrict}, `}
              {r.shipping_district}, {r.shipping_province} {r.shipping_postcode}
              {r.shipping_note && <><br/><em>หมายเหตุ: {r.shipping_note}</em></>}
            </p>
          </Section>

          {/* Tracking */}
          <Section title="Tracking + Note">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Carrier">
                <input value={carrier} onChange={e => setCarrier(e.target.value)}
                  className="admin-field w-full" placeholder="Kerry / Flash / J&T" />
              </Field>
              <Field label="Tracking number">
                <input value={tracking} onChange={e => setTracking(e.target.value)}
                  className="admin-field w-full" placeholder="THXXXXXXXX" />
              </Field>
            </div>
            <Field label="หมายเหตุภายใน">
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                className="admin-field w-full" placeholder="บันทึกข้อมูลภายในสำหรับทีม..." />
            </Field>
            <button onClick={saveTracking} disabled={saving}
              className="admin-btn admin-btn-ghost mt-2">
              <Save size={11} /> บันทึก
            </button>
          </Section>

          {/* Status actions */}
          {canCancel && (
            <Section title="อัปเดตสถานะ">
              <div className="flex gap-2 flex-wrap">
                {r.status === 'pending' && (
                  <button onClick={() => updateStatus('confirmed')} disabled={saving}
                    className="admin-btn admin-btn-ink">
                    <CheckCircle size={12} /> ยืนยันคำสั่งซื้อ
                  </button>
                )}
                {(r.status === 'pending' || r.status === 'confirmed') && (
                  <button onClick={() => updateStatus('shipping')} disabled={saving}
                    className="admin-btn admin-btn-ink"
                    style={{ background: '#4A7BC1', borderColor: '#4A7BC1' }}>
                    <Truck size={12} /> เริ่มจัดส่ง
                  </button>
                )}
                {r.status === 'shipping' && (
                  <button onClick={() => updateStatus('delivered')} disabled={saving}
                    className="admin-btn admin-btn-ink"
                    style={{ background: '#3A8E5A', borderColor: '#3A8E5A' }}>
                    <CheckCircle size={12} /> ส่งสำเร็จ
                  </button>
                )}
              </div>
            </Section>
          )}

          {/* Refund */}
          {canCancel && (
            <Section title="ยกเลิก + คืนแต้ม">
              {!confirmRefund ? (
                <button onClick={() => setConfirmRefund(true)}
                  className="admin-btn admin-btn-danger">
                  <XCircle size={12} /> ยกเลิก / Refund
                </button>
              ) : (
                <div className="space-y-2">
                  <Field label="เหตุผล">
                    <input value={refundReason} onChange={e => setRefundReason(e.target.value)}
                      className="admin-field w-full"
                      placeholder="เช่น สินค้าหมด / user ขอยกเลิก" autoFocus />
                  </Field>
                  <div className="flex gap-2">
                    <button onClick={() => { setConfirmRefund(false); setError('') }}
                      className="admin-btn admin-btn-ghost flex-1">ยกเลิก</button>
                    <button onClick={refund} disabled={saving}
                      className="admin-btn admin-btn-danger flex-1"
                      style={{ background: '#B14242', color: '#fff', borderColor: '#B14242' }}>
                      {saving ? <RefreshCw size={11} className="animate-spin" /> : <XCircle size={11} />}
                      ยืนยัน — คืน {r.points_used} แต้ม
                    </button>
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* Status history */}
          <div className="text-[11px] space-y-1" style={{ color: 'var(--admin-ink-faint)' }}>
            <p>สร้าง: {new Date(r.created_at).toLocaleString('th-TH')}</p>
            {r.shipped_at && <p>เริ่มส่ง: {new Date(r.shipped_at).toLocaleString('th-TH')}</p>}
            {r.delivered_at && <p>ส่งสำเร็จ: {new Date(r.delivered_at).toLocaleString('th-TH')}</p>}
            {r.refund_reason && (
              <p style={{ color: '#B14242' }}>
                {r.refund_reason === 'user_self_refund'
                  ? 'ลูกค้าแลกคืนเอง (คืนแต้มอัตโนมัติ)'
                  : `ยกเลิก: ${r.refund_reason}`}
              </p>
            )}
          </div>

          {error && (
            <div className="p-2 rounded text-xs"
              style={{ background: '#FBE9E9', color: '#B14242', border: '1px solid #E8B4B4' }}>
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t sticky bottom-0"
          style={{ borderColor: 'var(--admin-border)', background: 'var(--admin-card)' }}>
          <button onClick={onClose} className="admin-btn admin-btn-ghost w-full">ปิด</button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-2"
        style={{ color: 'var(--admin-ink-mute)' }}>{title}</p>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mt-2">
      <span className="block text-[10px] font-semibold uppercase tracking-wider mb-1"
        style={{ color: 'var(--admin-ink-mute)' }}>{label}</span>
      {children}
    </label>
  )
}

function Kv({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 9.5, color: 'var(--admin-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>{k}</p>
      <p style={{ fontSize: 12, color: 'var(--admin-ink)', margin: '2px 0 0', fontWeight: 500 }}>{v}</p>
    </div>
  )
}

function RegenerateCodeButton({ redemptionId, onDone }: { redemptionId: string; onDone: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function regen() {
    setLoading(true); setError('')
    try {
      const r = await fetch(`/api/admin/redemptions/${redemptionId}/regenerate-code`, { method: 'POST' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      onDone()
    } catch (e) { setError((e as Error).message); setLoading(false) }
  }
  return (
    <div className="space-y-1">
      <p className="text-[11px]" style={{ color: '#B14242' }}>
        ⚠ Code ยังไม่ generate (gen failed)
      </p>
      <button onClick={regen} disabled={loading} className="admin-btn admin-btn-ink">
        {loading ? <RefreshCw size={11} className="animate-spin" /> : <RefreshCw size={11} />}
        Regenerate code
      </button>
      {error && (
        <p className="text-[10px] mt-1" style={{ color: '#B14242' }}>{error}</p>
      )}
    </div>
  )
}
