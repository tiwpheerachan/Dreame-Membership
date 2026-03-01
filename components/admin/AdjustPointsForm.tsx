'use client'
import { useState, useEffect } from 'react'
import { User } from 'lucide-react'

interface Props { userId: string; currentPoints: number }

export default function AdjustPointsForm({ userId, currentPoints }: Props) {
  const [delta, setDelta] = useState('')
  const [desc, setDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [staffName, setStaffName] = useState<string | null>(null)

  // ดึงชื่อ admin ที่ login อยู่
  useEffect(() => {
    fetch('/api/admin/me').then(r => r.json()).then(d => {
      if (d.name) setStaffName(d.name)
    }).catch(() => {})
  }, [])

  async function submit() {
    setLoading(true); setMsg('')
    const res = await fetch('/api/admin/points/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, delta: Number(delta), description: desc }),
    })
    const data = await res.json()
    if (res.ok) {
      setMsg(`ปรับแต้มสำเร็จ (${Number(delta) > 0 ? '+' : ''}${delta}) โดย ${data.staff_name || staffName || 'Admin'}`)
      setDelta(''); setDesc('')
    } else {
      setMsg(data.error || 'เกิดข้อผิดพลาด')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-2 pt-2 border-t border-gray-800">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-xs">ปรับแต้ม (Admin)</p>
        {staffName && (
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <User size={10} />
            <span className="text-amber-600/80 font-medium">{staffName}</span>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <input type="number" placeholder="+100 หรือ -50" value={delta} onChange={e => setDelta(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500" />
      </div>
      <input type="text" placeholder="เหตุผล..." value={desc} onChange={e => setDesc(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500" />

      {/* Preview */}
      {delta && desc && staffName && (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-xs text-gray-400">
          <span className="text-gray-500">จะบันทึกว่า: </span>
          <span className="text-amber-400 font-medium">[{staffName}]</span>
          <span> {desc}</span>
        </div>
      )}

      <button onClick={submit} disabled={!delta || !desc || loading}
        className="w-full bg-amber-500/80 hover:bg-amber-500 disabled:opacity-40 text-gray-900 font-semibold py-1.5 rounded-lg text-xs transition-colors">
        {loading ? 'กำลังบันทึก...' : 'ปรับแต้ม'}
      </button>
      {msg && (
        <p className={`text-xs text-center flex items-center justify-center gap-1 ${msg.includes('สำเร็จ') ? 'text-green-400' : 'text-red-400'}`}>
          {msg.includes('สำเร็จ') && <User size={10} />}
          {msg}
        </p>
      )}
    </div>
  )
}