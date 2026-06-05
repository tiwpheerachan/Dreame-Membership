'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, AlertTriangle } from 'lucide-react'

interface Props {
  purchaseId: string
  orderSn: string
  modelName?: string
  pointsAwarded?: number
}

export default function DeletePurchaseButton({ purchaseId, orderSn, modelName, pointsAwarded }: Props) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const res = await fetch(`/api/admin/purchases/${purchaseId}`, { method: 'DELETE' })
    const text = await res.text()
    const data = text ? JSON.parse(text) : {}
    setLoading(false)
    if (res.ok) {
      setDone(true)
      setShowConfirm(false)
      setTimeout(() => router.refresh(), 400)
    } else {
      alert(data.error || 'ลบไม่สำเร็จ')
      setShowConfirm(false)
    }
  }

  if (done) return <span className="text-xs opacity-60" style={{ color: '#B14242' }}>ลบแล้ว</span>

  return (
    <>
      <button onClick={() => setShowConfirm(true)} title="ลบรายการนี้"
        className="p-1.5 rounded-lg transition-colors"
        style={{ color: 'var(--admin-ink-faint)' }}
        onMouseEnter={e => { e.currentTarget.style.color = '#B14242'; e.currentTarget.style.background = '#FBE9E9' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--admin-ink-faint)'; e.currentTarget.style.background = 'transparent' }}>
        <Trash2 size={14} />
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(14,14,14,0.45)', backdropFilter: 'blur(6px)' }}>
          <div className="admin-card p-5 w-full max-w-sm" style={{ borderColor: '#E8B4B4' }}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#FBE9E9' }}>
                <AlertTriangle size={20} style={{ color: '#B14242' }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm" style={{ color: 'var(--admin-ink)' }}>ยืนยันการลบ?</h3>
                <p className="text-xs mt-1" style={{ color: 'var(--admin-ink-mute)' }}>
                  <span className="font-mono" style={{ color: 'var(--admin-ink-soft)' }}>{orderSn}</span>
                  {modelName && <><br />{modelName}</>}
                </p>
                {Number(pointsAwarded) > 0 && (
                  <div className="mt-2 rounded-lg px-3 py-1.5 text-xs"
                    style={{ background: 'rgba(201,155,62,0.12)', border: '1px solid rgba(201,155,62,0.25)', color: '#B07823' }}>
                    ⚠️ แต้ม <strong>{pointsAwarded}</strong> แต้มที่เคยได้รับจะถูกหักคืน
                  </div>
                )}
                <p className="text-xs mt-2" style={{ color: '#B14242', opacity: 0.7 }}>
                  การกระทำนี้ไม่สามารถยกเลิกได้
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleDelete} disabled={loading}
                className="admin-btn admin-btn-danger flex-1"
                style={{ background: '#B14242', color: '#fff', borderColor: '#B14242' }}>
                {loading
                  ? <div className="w-4 h-4 rounded-full animate-spin"
                      style={{ border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                  : <><Trash2 size={14} /> ลบออก</>}
              </button>
              <button onClick={() => setShowConfirm(false)} className="admin-btn admin-btn-ghost flex-1">
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
