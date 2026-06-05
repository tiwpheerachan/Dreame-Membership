'use client'
import { useEffect, useState } from 'react'
import { Heart, RefreshCw, CheckCircle, XCircle, AlertTriangle, HelpCircle } from 'lucide-react'

interface Probe {
  name: string
  status: 'ok' | 'degraded' | 'down' | 'unknown'
  ms?: number
  detail?: string
}

export default function HealthPage() {
  const [probes, setProbes] = useState<Probe[]>([])
  const [loading, setLoading] = useState(false)
  const [lastCheck, setLastCheck] = useState<string | null>(null)

  async function check() {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/health', { cache: 'no-store' })
      if (r.ok) {
        const d = await r.json()
        setProbes(d.probes || [])
        setLastCheck(d.ts || new Date().toISOString())
      }
    } catch {
      setProbes([{ name: 'Probe API', status: 'down', detail: 'failed to reach /api/admin/health' }])
    }
    setLoading(false)
  }

  useEffect(() => { check() }, [])

  function statusIcon(s: Probe['status']) {
    if (s === 'ok')       return <CheckCircle size={16} style={{ color: '#3A8E5A' }} />
    if (s === 'degraded') return <AlertTriangle size={16} style={{ color: '#C99B3E' }} />
    if (s === 'down')     return <XCircle size={16} style={{ color: '#B14242' }} />
    return <HelpCircle size={16} style={{ color: 'var(--admin-ink-faint)' }} />
  }
  function statusBg(s: Probe['status']) {
    if (s === 'ok')       return 'rgba(58,142,90,0.12)'
    if (s === 'degraded') return 'rgba(201,155,62,0.12)'
    if (s === 'down')     return 'rgba(177,66,66,0.12)'
    return 'var(--admin-bg)'
  }
  function msColor(ms?: number) {
    if (ms == null) return 'var(--admin-ink-faint)'
    if (ms < 200)   return '#3A8E5A'
    if (ms < 800)   return '#C99B3E'
    return '#B14242'
  }

  const allOk = probes.length > 0 && probes.every(p => p.status === 'ok')
  const anyDown = probes.some(p => p.status === 'down')

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--admin-bg)' }}>
      <header className="border-b flex-shrink-0"
        style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <div className="px-6 lg:px-8 py-5 flex items-start justify-between gap-4">
          <div>
            <p style={{ color: 'var(--admin-gold)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 4 }}>
              Diagnostics
            </p>
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--admin-ink)' }}>
              <Heart size={22} /> System Health
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--admin-ink-mute)' }}>
              เช็คสถานะของ services ที่ระบบพึ่งพา
              {lastCheck && <span className="ml-2">· เช็คล่าสุด {new Date(lastCheck).toLocaleTimeString('th-TH')}</span>}
            </p>
          </div>
          <button onClick={check} disabled={loading} className="admin-btn admin-btn-ink flex-shrink-0">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-5 space-y-5">

      {/* Overall summary */}
      {probes.length > 0 && (
        <div className="admin-card p-4 flex items-center gap-3"
          style={{
            borderColor: allOk ? 'rgba(58,142,90,0.25)' : anyDown ? 'rgba(177,66,66,0.25)' : 'rgba(201,155,62,0.25)',
            background: allOk ? 'rgba(58,142,90,0.04)' : anyDown ? 'rgba(177,66,66,0.04)' : 'rgba(201,155,62,0.04)',
          }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: allOk ? 'rgba(58,142,90,0.12)' : anyDown ? 'rgba(177,66,66,0.12)' : 'rgba(201,155,62,0.12)' }}>
            {allOk
              ? <CheckCircle size={18} style={{ color: '#3A8E5A' }} />
              : anyDown
                ? <XCircle size={18} style={{ color: '#B14242' }} />
                : <AlertTriangle size={18} style={{ color: '#C99B3E' }} />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: 'var(--admin-ink)' }}>
              {allOk ? 'ทุกอย่างทำงานปกติ' : anyDown ? 'มี service ล่ม — ต้องดูด่วน' : 'มี service ที่ degraded'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--admin-ink-mute)' }}>
              {probes.filter(p => p.status === 'ok').length} ok ·
              {' '}{probes.filter(p => p.status === 'degraded').length} degraded ·
              {' '}{probes.filter(p => p.status === 'down').length} down
            </p>
          </div>
        </div>
      )}

      {/* Probes */}
      <div className="space-y-2">
        {probes.length === 0 && loading && (
          <div className="admin-card p-12 text-center">
            <RefreshCw size={20} className="mx-auto mb-2 animate-spin" style={{ color: 'var(--admin-ink-mute)' }} />
            <p className="text-sm" style={{ color: 'var(--admin-ink-mute)' }}>กำลังเช็ค services…</p>
          </div>
        )}
        {probes.map(p => (
          <div key={p.name} className="admin-card p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: statusBg(p.status) }}>
              {statusIcon(p.status)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm" style={{ color: 'var(--admin-ink)' }}>{p.name}</p>
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--admin-ink-mute)' }}>{p.detail || ''}</p>
            </div>
            {p.ms != null && (
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-sm tabular-nums" style={{ color: msColor(p.ms) }}>{p.ms}ms</p>
                <p className="text-[10px]" style={{ color: 'var(--admin-ink-faint)' }}>latency</p>
              </div>
            )}
          </div>
        ))}
      </div>
      </div>
    </div>
  )
}
