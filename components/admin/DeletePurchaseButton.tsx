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

  if (done) return <span className="text-xs text-red-500 opacity-60">ลบแล้ว</span>

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
        title="ลบรายการนี้"
      >
        <Trash2 size={14} />
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-red-900/50 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-red-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">ยืนยันการลบ?</h3>
                <p className="text-gray-400 text-xs mt-1">
                  <span className="font-mono text-gray-300">{orderSn}</span>
                  {modelName && <><br />{modelName}</>}
                </p>
                {Number(pointsAwarded) > 0 && (
                  <div className="mt-2 bg-amber-900/20 border border-amber-800/30 rounded-lg px-3 py-1.5 text-xs text-amber-400">
                    ⚠️ แต้ม <strong>{pointsAwarded}</strong> แต้มที่เคยได้รับจะถูกหักคืน
                  </div>
                )}
                <p className="text-red-400/70 text-xs mt-2">การกระทำนี้ไม่สามารถยกเลิกได้</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                {loading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><Trash2 size={14} /> ลบออก</>}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2.5 rounded-xl text-sm transition-colors"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}