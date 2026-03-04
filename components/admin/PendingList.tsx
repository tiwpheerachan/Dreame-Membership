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
    setState('loading')
    setErrorMsg('')
    try {
      const res = await fetch(`/api/admin/purchases/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_note: note }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'เกิดข้อผิดพลาด')
        setState('idle')
        return
      }
      setStaffName(data.staff_name || 'Admin')
      setState(status === 'ADMIN_APPROVED' ? 'approved' : 'rejected')
      // ลบ card ออกจาก list หลัง 1.5 วินาที
      setTimeout(() => onRemove(item.id), 1500)
    } catch {
      setErrorMsg('เชื่อมต่อไม่ได้ กรุณาลองใหม่')
      setState('idle')
    }
  }

  const cardBorder =
    state === 'approved' ? '#bbf7d0' :
    state === 'rejected' ? '#fecaca' :
    state.startsWith('confirming') ? '#fde68a' : '#f3f4f6'

  const cardBg =
    state === 'approved' ? '#f0fdf4' :
    state === 'rejected' ? '#fef2f2' :
    state.startsWith('confirming') ? '#fefce8' : '#fff'

  return (
    <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: '20px', transition: 'all 0.3s', opacity: state === 'approved' || state === 'rejected' ? 0.7 : 1 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fef9ee', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Package size={18} color="#d97706" />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>
              {item.model_name || `Order: ${item.order_sn}`}
            </p>
            <p style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', margin: 0 }}>{item.order_sn}</p>
          </div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 100, background: '#fefce8', border: '1px solid #fde68a', color: '#ca8a04', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
          <Clock size={11} /> รอตรวจสอบ
        </span>
      </div>

      {/* Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #f3f4f6' }}>
        {[
          { label: 'สมาชิก', value: item.users?.full_name || '-' },
          { label: 'รหัสสมาชิก', value: item.users?.member_id || '-' },
          { label: 'เบอร์โทร', value: item.users?.phone || '-' },
          { label: 'ช่องทาง', value: channelLabel(item.channel) },
          { label: 'วันที่กรอก', value: formatDate(item.created_at) },
          ...(item.serial_number ? [{ label: 'Serial No.', value: item.serial_number }] : []),
          ...(item.total_amount && item.total_amount > 0 ? [{ label: 'ยอดรวม', value: `฿${item.total_amount.toLocaleString()}` }] : []),
        ].map(({ label, value }) => (
          <div key={label}>
            <p style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px' }}>{label}</p>
            <p style={{ fontSize: 13, color: '#374151', fontWeight: 500, margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Receipt link */}
      {item.receipt_image_url && (
        <div style={{ marginBottom: 14 }}>
          <a href={item.receipt_image_url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
            <ExternalLink size={12} /> ดูรูปใบเสร็จ
          </a>
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 12, marginBottom: 12 }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* ── Success states ── */}
      {state === 'approved' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, color: '#16a34a', fontSize: 13, fontWeight: 600 }}>
          <CheckCircle size={16} /> อนุมัติสำเร็จ · {staffName}
        </div>
      )}
      {state === 'rejected' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#dc2626', fontSize: 13, fontWeight: 600 }}>
          <XCircle size={16} /> ปฏิเสธแล้ว · {staffName}
        </div>
      )}

      {/* ── Confirm box ── */}
      {(state === 'confirming-approve' || state === 'confirming-reject') && (
        <div style={{ background: '#fff', border: `1px solid ${state === 'confirming-approve' ? '#bbf7d0' : '#fecaca'}`, borderRadius: 12, padding: '14px' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: state === 'confirming-approve' ? '#15803d' : '#dc2626', margin: '0 0 10px' }}>
            {state === 'confirming-approve' ? '✅ ยืนยันการอนุมัติ?' : '❌ ยืนยันการปฏิเสธ?'}
          </p>
          <input
            type="text"
            placeholder="หมายเหตุ (ถ้ามี)"
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doAction(state === 'confirming-approve' ? 'ADMIN_APPROVED' : 'REJECTED')}
            autoFocus
            style={{ width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#111827', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => doAction(state === 'confirming-approve' ? 'ADMIN_APPROVED' : 'REJECTED')}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', background: state === 'confirming-approve' ? '#16a34a' : '#dc2626' }}>
              {state === 'confirming-approve' ? <><Check size={13} /> ยืนยันอนุมัติ</> : <><X size={13} /> ยืนยันปฏิเสธ</>}
            </button>
            <button
              onClick={() => { setState('idle'); setNote('') }}
              style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#6b7280', background: '#fff' }}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {state === 'loading' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', color: '#6b7280', fontSize: 13 }}>
          <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> กำลังบันทึก...
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* ── Action buttons ── */}
      {state === 'idle' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setState('confirming-approve')}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px 0', borderRadius: 10, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#dcfce7'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = '#f0fdf4'}>
            <Check size={14} /> อนุมัติ
          </button>
          <button
            onClick={() => setState('confirming-reject')}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px 0', borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#fee2e2'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2'}>
            <X size={14} /> ปฏิเสธ
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
    // refresh เพื่อ sync กับ server (ไม่บังคับ UI)
    router.refresh()
  }

  return (
    <div style={{ padding: '24px', maxWidth: 860, fontFamily: "'Prompt',system-ui,sans-serif" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>รอตรวจสอบ</h1>
        <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>
          {items.length > 0 ? `${items.length} รายการรอดำเนินการ` : 'ไม่มีรายการรอดำเนินการ'}
        </p>
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 24px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: '#f9fafb', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Clock size={28} color="#d1d5db" />
          </div>
          <p style={{ color: '#6b7280', fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>ไม่มีรายการรอดำเนินการ</p>
          <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>เมื่อมีสมาชิกกรอกสินค้าใหม่จะแสดงที่นี่</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map(item => (
            <PendingCard key={item.id} item={item} onRemove={removeItem} />
          ))}
        </div>
      )}
    </div>
  )
}