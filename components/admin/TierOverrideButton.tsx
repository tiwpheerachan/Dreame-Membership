'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Star, Award, ChevronDown, AlertTriangle } from 'lucide-react'

interface Props {
  userId: string
  currentTier: string
}

const TIERS = [
  { key: 'SILVER',   label: 'Silver',   icon: Shield, color: '#94A3B8' },
  { key: 'GOLD',     label: 'Gold',     icon: Star,   color: '#C99B3E' },
  { key: 'PLATINUM', label: 'Platinum', icon: Award,  color: '#1F1F1F' },
] as const

export default function TierOverrideButton({ userId, currentTier }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string>('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!selected || selected === currentTier) return
    setLoading(true); setError('')
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tier: selected, reason }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'แก้ไม่สำเร็จ'); return }
    setOpen(false); setSelected(''); setReason('')
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="admin-btn admin-btn-ghost"
        style={{ fontSize: 11, padding: '6px 10px' }}>
        ปรับ Tier <ChevronDown size={11} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(14,14,14,0.45)', backdropFilter: 'blur(6px)' }}>
          <div className="admin-card p-5 w-full max-w-md">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(201,155,62,0.12)' }}>
                <AlertTriangle size={18} style={{ color: '#C99B3E' }} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm" style={{ color: 'var(--admin-ink)' }}>
                  ปรับระดับสมาชิก (Admin override)
                </h3>
                <p className="text-xs mt-1" style={{ color: 'var(--admin-ink-mute)' }}>
                  ระดับปัจจุบัน: <strong>{currentTier}</strong> — การกระทำนี้จะถูกบันทึกใน audit log
                </p>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {TIERS.map(t => {
                const active = selected === t.key
                const isCurrent = currentTier === t.key
                return (
                  <button key={t.key}
                    disabled={isCurrent}
                    onClick={() => setSelected(t.key)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors"
                    style={{
                      background: active ? 'rgba(201,155,62,0.10)' : isCurrent ? 'var(--admin-bg)' : 'var(--admin-card)',
                      border: `1px solid ${active ? 'var(--admin-gold)' : 'var(--admin-border)'}`,
                      cursor: isCurrent ? 'not-allowed' : 'pointer',
                      opacity: isCurrent ? 0.5 : 1,
                    }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                      style={{ background: t.color }}>
                      <t.icon size={14} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold" style={{ color: 'var(--admin-ink)' }}>{t.label}</p>
                      {isCurrent && <p className="text-[10px]" style={{ color: 'var(--admin-ink-faint)' }}>ระดับปัจจุบัน</p>}
                    </div>
                    {active && <span className="admin-pill admin-pill-gold text-[10px]">เลือก</span>}
                  </button>
                )
              })}
            </div>

            <div className="mb-4">
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--admin-ink-mute)' }}>
                เหตุผล (จะแสดงใน audit)
              </label>
              <textarea
                placeholder="เช่น VIP customer / ของขวัญพิเศษ / แก้ไขข้อผิดพลาด"
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={2}
                className="admin-field resize-none" />
            </div>

            {error && (
              <p className="text-xs mb-3 px-3 py-2 rounded-lg"
                style={{ background: '#FBE9E9', color: '#B14242' }}>{error}</p>
            )}

            <div className="flex gap-2">
              <button onClick={() => { setOpen(false); setSelected(''); setReason(''); setError('') }}
                className="admin-btn admin-btn-ghost flex-1">
                ยกเลิก
              </button>
              <button onClick={submit}
                disabled={!selected || selected === currentTier || loading}
                className="admin-btn admin-btn-ink flex-1">
                {loading ? 'กำลังบันทึก…' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
