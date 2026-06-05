'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ChevronRight, TrendingUp, RefreshCw, AlertCircle, Crown, Sparkles,
} from 'lucide-react'

interface UserRow {
  id: string
  member_id: string | null
  full_name: string | null
  email: string | null
  phone: string | null
  current_tier: 'SILVER' | 'GOLD'
  lifetime_points: number
  next_tier: 'GOLD' | 'PLATINUM'
  points_to_next: number
  next_threshold: number
}

interface Forecast {
  window: number
  total: number
  buckets: { critical: UserRow[]; close: UserRow[]; soon: UserRow[] }
  totals: { silver_to_gold: number; gold_to_platinum: number }
}

export default function TierUpForecastPage() {
  const [data, setData] = useState<Forecast | null>(null)
  const [win, setWin] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const r = await fetch(`/api/admin/insights/tier-up?window=${win}`, { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setData(d)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [win])

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--admin-bg)' }}>
      {/* Breadcrumb */}
      <div className="border-b flex-shrink-0"
        style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <div className="px-6 lg:px-8 h-11 flex items-center gap-2 text-sm">
          <Link href="/admin" className="hover:opacity-70" style={{ color: 'var(--admin-ink-mute)' }}>
            Dashboard
          </Link>
          <ChevronRight size={12} style={{ color: 'var(--admin-ink-faint)' }} />
          <Link href="/admin/insights" className="hover:opacity-70" style={{ color: 'var(--admin-ink-mute)' }}>
            Insights
          </Link>
          <ChevronRight size={12} style={{ color: 'var(--admin-ink-faint)' }} />
          <span className="font-medium" style={{ color: 'var(--admin-ink)' }}>Tier-up forecast</span>
        </div>
      </div>

      {/* Header */}
      <header className="border-b flex-shrink-0"
        style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <div className="px-6 lg:px-8 py-5 flex items-start justify-between gap-4">
          <div>
            <p style={{ color: '#4A7BC1', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 4 }}>
              Marketing Insights
            </p>
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--admin-ink)' }}>
              <TrendingUp size={20} style={{ color: '#4A7BC1' }} /> Tier-up Forecast
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--admin-ink-mute)' }}>
              สมาชิกที่เหลือ ≤ {win} คะแนนถึง tier ถัดไป — โอกาส preemptive campaign
            </p>
          </div>
          <div className="flex gap-2 items-center flex-shrink-0">
            <label className="text-xs" style={{ color: 'var(--admin-ink-mute)' }}>Window:</label>
            <select value={win} onChange={e => setWin(Number(e.target.value))}
              className="admin-field" style={{ width: 80, fontSize: 12 }}>
              <option value={5}>≤5</option>
              <option value={10}>≤10</option>
              <option value={20}>≤20</option>
              <option value={50}>≤50</option>
              <option value={100}>≤100</option>
            </select>
            <button onClick={load} disabled={loading} className="admin-btn admin-btn-ghost">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="px-6 lg:px-8 pt-3 flex-shrink-0">
          <div className="admin-card p-3 flex items-start gap-2"
            style={{ background: '#FBE9E9', borderColor: '#E8B4B4', color: '#B14242' }}>
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <p className="text-xs">{error}</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-5 space-y-5">
        {/* Summary */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard icon={<AlertCircle size={14}/>} label="Critical (≤5)"
              value={data.buckets.critical.length} color="#B14242" />
            <SummaryCard icon={<TrendingUp size={14}/>} label="Close (6–10)"
              value={data.buckets.close.length} color="#C99B3E" />
            <SummaryCard icon={<Sparkles size={14}/>} label="Soon (11–20)"
              value={data.buckets.soon.length} color="#4A7BC1" />
            <SummaryCard icon={<Crown size={14}/>} label="รวม Total"
              value={data.total} />
          </div>
        )}

        {/* Tier breakdown */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <BreakdownCard
              from="SILVER" to="GOLD" threshold={80}
              count={data.totals.silver_to_gold}
              users={[...data.buckets.critical, ...data.buckets.close, ...data.buckets.soon]
                .filter(u => u.current_tier === 'SILVER')} />
            <BreakdownCard
              from="GOLD" to="PLATINUM" threshold={400}
              count={data.totals.gold_to_platinum}
              users={[...data.buckets.critical, ...data.buckets.close, ...data.buckets.soon]
                .filter(u => u.current_tier === 'GOLD')} />
          </div>
        )}

        {loading && !data && (
          <div className="text-center py-12" style={{ color: 'var(--admin-ink-mute)' }}>
            <RefreshCw size={18} className="mx-auto mb-2 animate-spin" /> โหลด…
          </div>
        )}

        {data && data.total === 0 && (
          <div className="admin-card p-10 text-center" style={{ color: 'var(--admin-ink-mute)' }}>
            <Sparkles size={20} className="mx-auto mb-2" style={{ color: 'var(--admin-ink-faint)' }} />
            <p className="text-sm">ไม่มีสมาชิกอยู่ในช่วง ≤ {win} คะแนน</p>
            <p className="text-xs mt-1" style={{ color: 'var(--admin-ink-faint)' }}>
              เพิ่ม window ที่หัวมุมขวาเพื่อดูสมาชิกที่ใกล้ขึ้นเเล้วยังไม่ถึง
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: number; color?: string
}) {
  return (
    <div className="admin-card p-4">
      <div className="flex items-center gap-2" style={{ color: color || 'var(--admin-ink-mute)' }}>
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums mt-2" style={{ color: color || 'var(--admin-ink)' }}>
        {value.toLocaleString()}
      </p>
    </div>
  )
}

function BreakdownCard({ from, to, threshold, count, users }: {
  from: string; to: string; threshold: number; count: number; users: UserRow[]
}) {
  return (
    <div className="admin-card overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--admin-border)', background: 'var(--admin-bg)' }}>
        <div>
          <p className="text-xs font-bold" style={{ color: 'var(--admin-ink)' }}>
            {from} → {to}
          </p>
          <p className="text-[10px]" style={{ color: 'var(--admin-ink-mute)' }}>
            ขีดเส้น {threshold} คะแนน
          </p>
        </div>
        <span className="admin-pill admin-pill-blue">{count}</span>
      </div>
      {users.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs" style={{ color: 'var(--admin-ink-faint)' }}>
          ไม่มีสมาชิกในช่วงนี้
        </div>
      ) : (
        <div className="max-h-[480px] overflow-y-auto">
          {users.slice(0, 50).map(u => (
            <Link key={u.id} href={`/admin/members/${u.id}`}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--admin-bg)] transition-colors border-b last:border-b-0"
              style={{ borderColor: 'var(--admin-border-2)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--admin-ink)' }}>
                  {u.full_name || '—'}
                </p>
                <p className="text-[10px] font-mono" style={{ color: 'var(--admin-ink-faint)' }}>
                  {u.member_id || u.email || u.phone}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums" style={{ color: '#C99B3E' }}>
                  {u.points_to_next} pts
                </p>
                <p className="text-[10px]" style={{ color: 'var(--admin-ink-faint)' }}>
                  มี {u.lifetime_points}
                </p>
              </div>
            </Link>
          ))}
          {users.length > 50 && (
            <p className="text-[10px] text-center py-2" style={{ color: 'var(--admin-ink-faint)' }}>
              … อีก {users.length - 50} คน
            </p>
          )}
        </div>
      )}
    </div>
  )
}
