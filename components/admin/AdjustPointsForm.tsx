'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User } from 'lucide-react'

interface Props { userId: string; currentPoints: number }

export default function AdjustPointsForm({ userId, currentPoints: _ }: Props) {
  const router = useRouter()
  const [delta, setDelta] = useState('')
  const [desc, setDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [staffName, setStaffName] = useState<string | null>(null)

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
      // Refresh the page so total/lifetime/tier reflect the new value
      router.refresh()
    } else {
      setMsg(data.error || 'เกิดข้อผิดพลาด')
    }
    setLoading(false)
  }

  return (
    <div style={{ paddingTop: 12, borderTop: '1px solid var(--admin-border)' }} className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: 'var(--admin-ink-mute)' }}>
          ปรับแต้ม (Admin)
        </p>
        {staffName && (
          <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--admin-ink-mute)' }}>
            <User size={10} />
            <span style={{ color: 'var(--admin-gold)' }} className="font-medium">{staffName}</span>
          </div>
        )}
      </div>
      <input type="number" placeholder="+100 หรือ -50" value={delta} onChange={e => setDelta(e.target.value)}
        className="admin-field" />
      <input type="text" placeholder="เหตุผล..." value={desc} onChange={e => setDesc(e.target.value)}
        className="admin-field" />

      {delta && desc && staffName && (
        <div className="rounded-xl px-3 py-2 text-xs"
          style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-ink-mute)' }}>
          <span style={{ color: 'var(--admin-ink-faint)' }}>จะบันทึกว่า: </span>
          <span style={{ color: 'var(--admin-gold)' }} className="font-medium">[{staffName}]</span>
          <span> {desc}</span>
        </div>
      )}

      <button onClick={submit} disabled={!delta || !desc || loading}
        className="admin-btn admin-btn-ink w-full">
        {loading ? 'กำลังบันทึก...' : 'ปรับแต้ม'}
      </button>
      {msg && (
        <p className="text-xs text-center flex items-center justify-center gap-1"
          style={{ color: msg.includes('สำเร็จ') ? '#2E7A3D' : '#B14242' }}>
          {msg.includes('สำเร็จ') && <User size={10} />}
          {msg}
        </p>
      )}
    </div>
  )
}
