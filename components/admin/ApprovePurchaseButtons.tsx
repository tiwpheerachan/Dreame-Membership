'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Loader2, CheckCircle, XCircle } from 'lucide-react'

interface Props {
  purchaseId: string
  onDone?: () => void
}

export default function ApprovePurchaseButtons({ purchaseId, onDone }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<{ status: 'ADMIN_APPROVED' | 'REJECTED'; staffName: string } | null>(null)
  const [note, setNote] = useState('')
  const [showConfirm, setShowConfirm] = useState<'ADMIN_APPROVED' | 'REJECTED' | null>(null)
  const [error, setError] = useState('')

  async function action(status: 'ADMIN_APPROVED' | 'REJECTED') {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/purchases/${purchaseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_note: note }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
        return
      }
      setDone({ status, staffName: data.staff_name || 'Admin' })
      onDone?.()
      // Refresh server component ให้แสดงสถานะล่าสุด
      router.refresh()
    } catch {
      setError('เชื่อมต่อไม่ได้ กรุณาลองใหม่')
    } finally {
      setLoading(false)
      setShowConfirm(null)
    }
  }

  // แสดงผลสำเร็จ
  if (done?.status === 'ADMIN_APPROVED') return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 14px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, color:'#16a34a', fontSize:12, fontWeight:600 }}>
      <CheckCircle size={13} /> อนุมัติสำเร็จ · {done.staffName}
    </div>
  )
  if (done?.status === 'REJECTED') return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 14px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, color:'#dc2626', fontSize:12, fontWeight:600 }}>
      <XCircle size={13} /> ปฏิเสธแล้ว · {done.staffName}
    </div>
  )

  // หน้า confirm
  if (showConfirm) return (
    <div style={{ background: showConfirm === 'ADMIN_APPROVED' ? '#f0fdf4' : '#fef2f2', border:`1px solid ${showConfirm === 'ADMIN_APPROVED' ? '#bbf7d0' : '#fecaca'}`, borderRadius:12, padding:'14px 16px' }}>
      <p style={{ fontSize:13, fontWeight:600, color: showConfirm === 'ADMIN_APPROVED' ? '#15803d' : '#dc2626', margin:'0 0 10px' }}>
        {showConfirm === 'ADMIN_APPROVED' ? '✅ ยืนยันการอนุมัติ?' : '❌ ยืนยันการปฏิเสธ?'}
      </p>
      <input
        type="text"
        placeholder="หมายเหตุ (ถ้ามี)"
        value={note}
        onChange={e => setNote(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && !loading && action(showConfirm)}
        autoFocus
        style={{ width:'100%', background:'#fff', border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px', fontSize:13, color:'#111827', outline:'none', boxSizing:'border-box', marginBottom:10 }}
        onFocus={e => (e.target as HTMLInputElement).style.borderColor = showConfirm === 'ADMIN_APPROVED' ? '#86efac' : '#fca5a5'}
        onBlur={e => (e.target as HTMLInputElement).style.borderColor = '#e5e7eb'}
      />
      {error && <p style={{ fontSize:12, color:'#dc2626', margin:'0 0 8px' }}>⚠️ {error}</p>}
      <div style={{ display:'flex', gap:8 }}>
        <button
          onClick={() => action(showConfirm)}
          disabled={loading}
          style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px 0', borderRadius:8, border:'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize:13, fontWeight:700, color:'#fff', background: loading ? '#9ca3af' : showConfirm === 'ADMIN_APPROVED' ? '#16a34a' : '#dc2626', transition:'all 0.15s' }}>
          {loading
            ? <><Loader2 size={13} style={{ animation:'spin 0.8s linear infinite' }} /> กำลังบันทึก...</>
            : showConfirm === 'ADMIN_APPROVED'
              ? <><Check size={13} /> ยืนยันอนุมัติ</>
              : <><X size={13} /> ยืนยันปฏิเสธ</>}
        </button>
        <button
          onClick={() => { setShowConfirm(null); setNote(''); setError('') }}
          disabled={loading}
          style={{ flex:1, padding:'9px 0', borderRadius:8, border:'1px solid #e5e7eb', cursor:'pointer', fontSize:13, fontWeight:600, color:'#6b7280', background:'#fff', transition:'all 0.15s' }}>
          ยกเลิก
        </button>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ปุ่มหลัก
  return (
    <div style={{ display:'flex', gap:8 }}>
      <button
        onClick={() => setShowConfirm('ADMIN_APPROVED')}
        style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, color:'#15803d', fontSize:13, fontWeight:600, cursor:'pointer', transition:'all 0.15s' }}
        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#dcfce7'}
        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = '#f0fdf4'}>
        <Check size={14} /> อนุมัติ
      </button>
      <button
        onClick={() => setShowConfirm('REJECTED')}
        style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, color:'#dc2626', fontSize:13, fontWeight:600, cursor:'pointer', transition:'all 0.15s' }}
        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#fee2e2'}
        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2'}>
        <X size={14} /> ปฏิเสธ
      </button>
    </div>
  )
}