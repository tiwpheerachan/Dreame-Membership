'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, CheckCircle, XCircle, Loader2, Check, X, ExternalLink, Package } from 'lucide-react'
import { channelLabel, formatDate } from '@/lib/utils'

export type PendingPurchase = {
  id: string
  order_sn: string
  model_name: string | null
  channel: string
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

function PendingCard({ item, onRemove }: { item: PendingPurchase; onRemove: (id: string) => void }) {
  const [state, setState] = useState<ItemState>('idle')
  const [note, setNote] = useState('')
  const [staffName, setStaffName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

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
