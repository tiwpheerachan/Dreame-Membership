'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, CheckCircle, XCircle, Loader2, Check, X, ExternalLink, Package, Database } from 'lucide-react'
import { channelLabel, formatDate } from '@/lib/utils'

export type PendingPurchase = {
  id: string
  order_sn: string
  model_name: string | null
  channel: string
  channel_type: 'ONLINE' | 'ONSITE' | string
  created_at: string
  serial_number: string | null
  total_amount: number | null
  receipt_image_url: string | null
  users: {
    full_name: string | null
    phone: string | null
    member_id: string | null
  }
}

type ItemState = 'idle' | 'confirming-approve' | 'confirming-reject' | 'loading' | 'approved' | 'rejected' | 'error'
type BqState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'verified'; total: number; platform: string; staff: string }
  | { kind: 'not_found' }
  | { kind: 'skipped'; message: string }
  | { kind: 'error'; message: string }

function PendingCard({ item, onRemove }: { item: PendingPurchase; onRemove: (id: string) => void }) {
  const [state, setState] = useState<ItemState>('idle')
  const [note, setNote] = useState('')
  const [staffName, setStaffName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [bq, setBq] = useState<BqState>({ kind: 'idle' })

  const isOnline = item.channel_type === 'ONLINE'

  async function recheckBQ() {
    setBq({ kind: 'loading' })
    try {
      const res = await fetch(`/api/admin/purchases/${item.id}/recheck-bq`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setBq({ kind: 'error', message: data.error || 'เกิดข้อผิดพลาด' })
        return
      }
      if (data.status === 'VERIFIED') {
        setBq({
          kind: 'verified',
          total: Number(data.order?.total_amount || 0),
          platform: data.order?.platform || '',
          staff: data.staff_name || 'Admin',
        })
        setTimeout(() => onRemove(item.id), 1800)
      } else if (data.status === 'SKIPPED') {
        setBq({ kind: 'skipped', message: data.message })
      } else {
        setBq({ kind: 'not_found' })
      }
    } catch {
      setBq({ kind: 'error', message: 'เชื่อมต่อไม่ได้ กรุณาลองใหม่' })
    }
  }

  async function doAction(status: 'ADMIN_APPROVED' | 'REJECTED') {
    setState('loading'); setErrorMsg('')
    try {
      const res = await fetch(`/api/admin/purchases/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_note: note }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error || 'เกิดข้อผิดพลาด'); setState('idle'); return }
      setStaffName(data.staff_name || 'Admin')
      setState(status === 'ADMIN_APPROVED' ? 'approved' : 'rejected')
      setTimeout(() => onRemove(item.id), 1500)
    } catch {
      setErrorMsg('เชื่อมต่อไม่ได้ กรุณาลองใหม่'); setState('idle')
    }
  }

  const cardBg =
    state === 'approved' ? 'var(--green-soft)' :
    state === 'rejected' ? 'var(--red-soft)' :
    state.startsWith('confirming') ? 'var(--amber-soft)' : '#fff'

  return (
    <div className="admin-card" style={{ background: cardBg, padding: 18, transition: 'background 0.3s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{
            width: 38, height: 38, borderRadius: 'var(--r-md)',
            background: 'var(--amber-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Package size={17} color="var(--amber)" />
          </div>
          <div>
            <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 14 }}>
              {item.model_name || `Order: ${item.order_sn}`}
            </p>
            <p className="num" style={{ margin: 0, fontSize: 11, color: 'var(--ink-mute)' }}>{item.order_sn}</p>
          </div>
        </div>
        <span className="admin-pill admin-pill-amber"><Clock size={11} /> รอตรวจสอบ</span>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 18px',
        marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--hair)', fontSize: 12,
      }}>
        {[
          { l: 'สมาชิก',  v: item.users?.full_name || '-' },
          { l: 'รหัส',    v: item.users?.member_id || '-' },
          { l: 'เบอร์',   v: item.users?.phone || '-' },
          { l: 'ช่องทาง', v: channelLabel(item.channel) },
          { l: 'วันที่',  v: formatDate(item.created_at) },
          ...(item.serial_number ? [{ l: 'Serial', v: item.serial_number }] : []),
          ...(item.total_amount && item.total_amount > 0 ? [{ l: 'ยอด', v: `฿${item.total_amount.toLocaleString()}` }] : []),
        ].map(({ l, v }) => (
          <div key={l}>
            <p style={{ margin: 0, fontSize: 9.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{l}</p>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink)', fontWeight: 500 }}>{v}</p>
          </div>
        ))}
      </div>

      {item.receipt_image_url && (
        <a href={item.receipt_image_url} target="_blank" rel="noopener noreferrer"
          className="admin-btn admin-btn-ghost" style={{ marginBottom: 10, padding: '5px 10px', fontSize: 11 }}>
          <ExternalLink size={11} /> ดูใบเสร็จ
        </a>
      )}

      {/* BQ recheck — ONLINE only */}
      {isOnline && state === 'idle' && (
        <div style={{ marginBottom: 10 }}>
          {bq.kind === 'idle' && (
            <button onClick={recheckBQ} className="admin-btn admin-btn-ghost"
              style={{ padding: '6px 12px', fontSize: 11.5, gap: 6 }}>
              <Database size={12} /> ลองดึงข้อมูลจาก BigQuery ตอนนี้
            </button>
          )}
          {bq.kind === 'loading' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-mute)', padding: '4px 0' }}>
              <Loader2 size={12} className="spinner" /> กำลังค้นใน BigQuery...
            </div>
          )}
          {bq.kind === 'verified' && (
            <div style={{ padding: '8px 12px', background: 'var(--green-soft)', borderRadius: 'var(--r-md)', fontSize: 12, color: 'var(--green)' }}>
              <CheckCircle size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />
              <strong>เจอใน BQ — อนุมัติอัตโนมัติแล้ว</strong> · {bq.platform} · ฿{bq.total.toLocaleString()} · {bq.staff}
            </div>
          )}
          {bq.kind === 'not_found' && (
            <div style={{ padding: '8px 12px', background: 'var(--amber-soft)', borderRadius: 'var(--r-md)', fontSize: 11.5, color: 'var(--amber)' }}>
              ยังไม่พบใน BigQuery (อัปเดตทุก 6 ชั่วโมง) — รอ cron หรืออนุมัติด้วยตนเองก็ได้
            </div>
          )}
          {bq.kind === 'skipped' && (
            <div style={{ padding: '8px 12px', background: 'var(--bg-soft)', borderRadius: 'var(--r-md)', fontSize: 11.5, color: 'var(--ink-mute)' }}>
              {bq.message}
            </div>
          )}
          {bq.kind === 'error' && (
            <div style={{ padding: '8px 12px', background: 'var(--red-soft)', borderRadius: 'var(--r-md)', fontSize: 11.5, color: 'var(--red)' }}>
              ⚠️ {bq.message}
            </div>
          )}
        </div>
      )}

      {errorMsg && (
        <div style={{ padding: '8px 12px', background: 'var(--red-soft)', borderRadius: 'var(--r-md)', color: 'var(--red)', fontSize: 12, marginBottom: 10 }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {state === 'approved' && (
        <div className="admin-pill admin-pill-green" style={{ padding: '6px 12px', fontSize: 12 }}>
          <CheckCircle size={13} /> อนุมัติสำเร็จ · {staffName}
        </div>
      )}
      {state === 'rejected' && (
        <div className="admin-pill admin-pill-red" style={{ padding: '6px 12px', fontSize: 12 }}>
          <XCircle size={13} /> ปฏิเสธแล้ว · {staffName}
        </div>
      )}

      {(state === 'confirming-approve' || state === 'confirming-reject') && (
        <div style={{
          background: '#fff', border: `1px solid ${state === 'confirming-approve' ? 'var(--green-soft)' : 'var(--red-soft)'}`,
          borderRadius: 'var(--r-md)', padding: 12,
        }}>
          <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: 12.5, color: state === 'confirming-approve' ? 'var(--green)' : 'var(--red)' }}>
            {state === 'confirming-approve' ? '✅ ยืนยันการอนุมัติ?' : '❌ ยืนยันการปฏิเสธ?'}
          </p>
          <input type="text" placeholder="หมายเหตุ (ถ้ามี)" value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doAction(state === 'confirming-approve' ? 'ADMIN_APPROVED' : 'REJECTED')}
            autoFocus className="admin-field" style={{ marginBottom: 8, fontSize: 12 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => doAction(state === 'confirming-approve' ? 'ADMIN_APPROVED' : 'REJECTED')}
              className={state === 'confirming-approve' ? 'admin-btn admin-btn-ink' : 'admin-btn admin-btn-danger'}
              style={{ flex: 1, padding: '7px 10px', fontSize: 12 }}>
              {state === 'confirming-approve' ? <><Check size={11} /> ยืนยัน</> : <><X size={11} /> ปฏิเสธ</>}
            </button>
            <button onClick={() => { setState('idle'); setNote('') }} className="admin-btn admin-btn-ghost" style={{ flex: 1, padding: '7px 10px', fontSize: 12 }}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {state === 'loading' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8, color: 'var(--ink-mute)', fontSize: 12 }}>
          <Loader2 size={14} className="spinner" /> กำลังบันทึก...
        </div>
      )}

      {state === 'idle' && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setState('confirming-approve')}
            className="admin-btn"
            style={{ flex: 1, background: 'var(--green-soft)', color: 'var(--green)', borderColor: 'rgba(46,122,61,0.20)' }}>
            <Check size={13} /> อนุมัติ
          </button>
          <button onClick={() => setState('confirming-reject')}
            className="admin-btn admin-btn-danger" style={{ flex: 1 }}>
            <X size={13} /> ปฏิเสธ
          </button>
        </div>
      )}
    </div>
  )
}

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

  async function lookup() {
    const trimmed = orderSn.trim()
    if (!trimmed) return
    setResult({ kind: 'loading' })
    try {
      const res = await fetch(`/api/admin/bq/lookup?order_sn=${encodeURIComponent(trimmed)}`)
      const data = await res.json()
      if (!res.ok) {
        setResult({ kind: 'error', message: data.error || 'เกิดข้อผิดพลาด' })
        return
      }
      if (data.found) setResult({ kind: 'found', data: data.order })
      else if (data.bq_error) setResult({ kind: 'bq_error', message: data.message || 'BQ failed', bq_error: data.bq_error })
      else setResult({ kind: 'not_found', message: data.message || 'ไม่พบ' })
    } catch {
      setResult({ kind: 'error', message: 'เชื่อมต่อไม่ได้' })
    }
  }

  return (
    <div className="admin-card" style={{ padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Database size={14} color="var(--ink-mute)" />
        <p style={{ margin: 0, fontWeight: 600, fontSize: 12.5 }}>ค้นใน BigQuery (read-only)</p>
      </div>
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
          {result.data.items && result.data.items.length > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(46,122,61,0.15)' }}>
              {result.data.items.map((it, i) => (
                <div key={i} style={{ fontSize: 11.5, color: 'var(--ink-soft)', padding: '2px 0' }}>
                  • {it.item_name} ({it.item_sku}) × {it.quantity} = ฿{Number(it.price * it.quantity).toLocaleString()}
                </div>
              ))}
            </div>
          )}
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
  )
}

export default function PendingList({ initialItems }: { initialItems: PendingPurchase[] }) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  function removeItem(id: string) {
    setItems(prev => prev.filter(p => p.id !== id))
    router.refresh()
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900 }}>
      <div style={{ marginBottom: 18 }}>
        <h1 className="admin-h1">รอตรวจสอบ</h1>
        <p className="admin-sub">{items.length > 0 ? `${items.length} รายการรอดำเนินการ` : 'ไม่มีรายการรอดำเนินการ'}</p>
      </div>

      <BQLookup />

      {items.length === 0 ? (
        <div className="admin-card" style={{ padding: 60, textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, margin: '0 auto 14px',
            borderRadius: '50%', background: 'var(--bg-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Clock size={24} color="var(--ink-faint)" />
          </div>
          <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--ink)' }}>ไม่มีรายการรอดำเนินการ</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-mute)' }}>เมื่อมีสมาชิกกรอกสินค้าใหม่จะแสดงที่นี่</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(item => <PendingCard key={item.id} item={item} onRemove={removeItem} />)}
        </div>
      )}
    </div>
  )
}
