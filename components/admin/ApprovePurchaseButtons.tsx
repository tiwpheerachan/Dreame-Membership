'use client'
import { useState } from 'react'
import { Check, X, User } from 'lucide-react'

interface Props {
  purchaseId: string
  onDone?: () => void
}

export default function ApprovePurchaseButtons({ purchaseId, onDone }: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ status: string; staffName: string } | null>(null)
  const [note, setNote] = useState('')
  const [showConfirm, setShowConfirm] = useState<'ADMIN_APPROVED' | 'REJECTED' | null>(null)

  async function action(status: 'ADMIN_APPROVED' | 'REJECTED') {
    setLoading(true)
    const res = await fetch(`/api/admin/purchases/${purchaseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, admin_note: note }),
    })
    const data = await res.json()
    if (res.ok) {
      setResult({ status, staffName: data.staff_name || 'Admin' })
      onDone?.()
    } else {
      setResult({ status: 'ERROR', staffName: data.error || 'เกิดข้อผิดพลาด' })
    }
    setLoading(false)
    setShowConfirm(null)
  }

  if (result?.status === 'ADMIN_APPROVED') return (
    <div className="flex items-center gap-1.5 text-green-400 text-xs bg-green-900/15 border border-green-800/30 rounded-lg px-3 py-1.5 w-fit">
      <Check size={12} /><span>อนุมัติแล้ว</span>
      <span className="text-green-700 mx-0.5">·</span>
      <User size={11} className="text-green-600" />
      <span className="text-green-500 font-semibold">{result.staffName}</span>
    </div>
  )
  if (result?.status === 'REJECTED') return (
    <div className="flex items-center gap-1.5 text-red-400 text-xs bg-red-900/15 border border-red-800/30 rounded-lg px-3 py-1.5 w-fit">
      <X size={12} /><span>ปฏิเสธแล้ว</span>
      <span className="text-red-700 mx-0.5">·</span>
      <User size={11} className="text-red-600" />
      <span className="text-red-500 font-semibold">{result.staffName}</span>
    </div>
  )
  if (result) return <p className="text-red-400 text-xs">{result.staffName}</p>

  if (showConfirm) return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 space-y-2">
      <p className="text-xs text-gray-300 font-medium">
        {showConfirm === 'ADMIN_APPROVED' ? '✅ ยืนยันการอนุมัติ?' : '❌ ยืนยันการปฏิเสธ?'}
      </p>
      <input type="text" placeholder="หมายเหตุ (ถ้ามี)" value={note} onChange={e => setNote(e.target.value)} autoFocus
        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500" />
      <div className="flex gap-2">
        <button onClick={() => action(showConfirm)} disabled={loading}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${showConfirm === 'ADMIN_APPROVED' ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'}`}>
          {loading
            ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
            : showConfirm === 'ADMIN_APPROVED' ? <><Check size={11} />ยืนยัน</> : <><X size={11} />ยืนยัน</>}
        </button>
        <button onClick={() => { setShowConfirm(null); setNote('') }}
          className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs transition-colors">
          ยกเลิก
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex gap-2">
      <button onClick={() => setShowConfirm('ADMIN_APPROVED')}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-900/30 text-green-400 border border-green-800/40 rounded-lg text-xs hover:bg-green-900/50 transition-colors font-medium">
        <Check size={12} /> อนุมัติ
      </button>
      <button onClick={() => setShowConfirm('REJECTED')}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/30 text-red-400 border border-red-800/40 rounded-lg text-xs hover:bg-red-900/50 transition-colors font-medium">
        <X size={12} /> ปฏิเสธ
      </button>
    </div>
  )
}