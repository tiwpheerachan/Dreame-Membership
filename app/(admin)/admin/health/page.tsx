'use client'
import { useEffect, useState } from 'react'
import { Heart, Database, Cloud, Mail, RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

interface Probe {
  name: string
  status: 'ok' | 'degraded' | 'down' | 'unknown'
  ms?: number
  detail?: string
}

export default function HealthPage() {
  const [probes, setProbes] = useState<Probe[]>([])
  const [loading, setLoading] = useState(false)

  async function check() {
    setLoading(true)
    const next: Probe[] = []
    // App health
    const t0 = Date.now()
    try {
      const r = await fetch('/api/health')
      const d = await r.json()
      next.push({
        name: 'App + Database',
        status: r.ok ? 'ok' : 'down',
        ms: d.db_latency_ms ?? Date.now() - t0,
        detail: r.ok ? `connected · ${d.db_latency_ms}ms` : (d.error || 'unreachable'),
      })
    } catch {
      next.push({ name: 'App + Database', status: 'down', detail: 'request failed' })
    }
    setProbes(next)
    setLoading(false)
  }

  useEffect(() => { check() }, [])

  function statusIcon(s: Probe['status']) {
    if (s === 'ok')        return <CheckCircle size={16} color="var(--green)" />
    if (s === 'degraded')  return <AlertTriangle size={16} color="var(--amber)" />
    if (s === 'down')      return <XCircle size={16} color="var(--red)" />
    return <RefreshCw size={16} color="var(--ink-mute)" className="spinner" />
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 800 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
        <div>
          <h1 className="admin-h1"><Heart size={18} style={{ verticalAlign: 'baseline' }} /> System Health</h1>
          <p className="admin-sub">เช็คสถานะ services ของระบบ</p>
        </div>
        <button onClick={check} disabled={loading} className="admin-btn admin-btn-ink">
          <RefreshCw size={13} className={loading ? 'spinner' : ''} /> Refresh
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {probes.map(p => (
          <div key={p.name} className="admin-card" style={{
            padding: '14px 18px',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 'var(--r-md)',
              background: p.status === 'ok' ? 'var(--green-soft)' : p.status === 'down' ? 'var(--red-soft)' : 'var(--bg-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {statusIcon(p.status)}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{p.name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ink-mute)' }}>{p.detail || ''}</p>
            </div>
            {p.ms != null && (
              <div className="num" style={{ fontSize: 13, fontWeight: 700, color: p.ms < 200 ? 'var(--green)' : p.ms < 800 ? 'var(--amber)' : 'var(--red)' }}>
                {p.ms}ms
              </div>
            )}
          </div>
        ))}

        {/* Static reference items */}
        <div className="admin-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, opacity: 0.6 }}>
          <div style={{ width: 38, height: 38, borderRadius: 'var(--r-md)', background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Cloud size={16} color="var(--ink-mute)" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>BigQuery</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ink-mute)' }}>เช็คผ่าน /api/cron/verify-pending logs</p>
          </div>
        </div>
        <div className="admin-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, opacity: 0.6 }}>
          <div style={{ width: 38, height: 38, borderRadius: 'var(--r-md)', background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Mail size={16} color="var(--ink-mute)" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>Email (Supabase Auth)</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ink-mute)' }}>Check Supabase dashboard → Auth → Logs</p>
          </div>
        </div>
      </div>
    </div>
  )
}
