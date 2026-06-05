import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Search, ChevronRight, Trophy, X } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import PageShell from '@/components/admin/PageShell'

interface SearchParams {
  q?: string; staff?: string; action?: string
  from?: string; to?: string; user?: string; page?: string
}

const ACTION_LABEL: Record<string, { label: string; color: string }> = {
  PURCHASE_APPROVED:     { label: 'อนุมัติ',        color: '#3A8E5A' },
  PURCHASE_REJECTED:     { label: 'ปฏิเสธ',        color: '#B14242' },
  PURCHASE_ADDED:        { label: 'เพิ่มประวัติ',   color: '#4A7BC1' },
  PURCHASE_EDITED:       { label: 'แก้ไขประวัติ',   color: '#C99B3E' },
  PURCHASE_DELETED:      { label: 'ลบประวัติ',     color: '#B14242' },
  PURCHASE_BQ_RECHECKED: { label: 'ดึง BQ',                color: '#4A7BC1' },
  POINTS_ADJUSTED:       { label: 'ปรับแต้ม',              color: '#C99B3E' },
  TIER_OVERRIDDEN:       { label: 'ปรับ Tier',             color: '#8B5CF6' },
  COUPON_CREATED:        { label: 'สร้างคูปอง',            color: '#C99B3E' },
  COUPON_SHOPIFY_BATCH_CREATED: { label: 'สร้าง Shopify batch', color: '#5E8E3E' },
  COUPON_SHOPIFY_REDEEMED:      { label: 'ใช้คูปอง Shopify',    color: '#5E8E3E' },
  COUPON_SELF_REFUND:    { label: 'ลูกค้าแลกคืน',          color: '#A0782B' },
  MEMBER_VIEWED:         { label: 'ดูสมาชิก',              color: '#6B5A48' },
}

function actionPill(action: string) {
  const cfg = ACTION_LABEL[action]
  if (!cfg) return <span className="admin-pill">{action}</span>
  return (
    <span className="admin-pill"
      style={{ background: `${cfg.color}1A`, color: cfg.color, borderColor: `${cfg.color}40` }}>
      {cfg.label}
    </span>
  )
}

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createServiceClient()
  const q = searchParams.q || ''
  const staffFilter = searchParams.staff || ''
  const action = searchParams.action || ''
  const from = searchParams.from || ''
  const to = searchParams.to || ''
  const userFilter = searchParams.user || ''
  const page = parseInt(searchParams.page || '1')
  const pageSize = 50

  let query = supabase
    .from('admin_audit_log')
    .select(`id, action_type, created_at, target_id, user_id, detail, staff_id,
             admin_staff(name, role),
             user:users!admin_audit_log_user_id_fkey(full_name, member_id)`, { count: 'exact' })

  if (action)       query = query.eq('action_type', action)
  if (staffFilter)  query = query.eq('staff_id', staffFilter)
  if (userFilter)   query = query.eq('user_id', userFilter)
  if (from)         query = query.gte('created_at', from)
  if (to)           query = query.lte('created_at', to)

  const { data: logs, count } = await query
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const { data: staffList } = await supabase.from('admin_staff').select('id, name').order('name')

  // ── Per-staff KPI (last 30d) ──
  const since30d = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { data: kpiRows } = await supabase
    .from('admin_audit_log')
    .select('staff_id, action_type, admin_staff(name)')
    .gte('created_at', since30d)
    .neq('action_type', 'MEMBER_VIEWED')
    .limit(5000)

  const staffStats: Record<string, { name: string; total: number; approved: number; rejected: number; points: number }> = {}
  for (const row of (kpiRows || []) as Array<{ staff_id: string; action_type: string; admin_staff: { name: string } | { name: string }[] | null }>) {
    const sid = row.staff_id
    if (!sid) continue
    const sname = Array.isArray(row.admin_staff) ? row.admin_staff[0]?.name : row.admin_staff?.name
    if (!staffStats[sid]) staffStats[sid] = { name: sname || '-', total: 0, approved: 0, rejected: 0, points: 0 }
    staffStats[sid].total++
    if (row.action_type === 'PURCHASE_APPROVED') staffStats[sid].approved++
    if (row.action_type === 'PURCHASE_REJECTED') staffStats[sid].rejected++
    if (row.action_type === 'POINTS_ADJUSTED')   staffStats[sid].points++
  }
  const leaderboard = Object.values(staffStats).sort((a, b) => b.total - a.total).slice(0, 5)

  const totalPages = Math.ceil((count || 0) / pageSize)
  const hasFilter = staffFilter || action || from || to || userFilter || q

  const filters = (
    <form className="flex flex-wrap gap-2 items-center" method="GET">
      <div className="relative flex-1 min-w-[200px]">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--admin-ink-faint)' }} />
        <input type="text" name="q" defaultValue={q} placeholder="ค้นใน detail / member ID / order"
          className="admin-field" style={{ paddingLeft: 34 }} />
      </div>
      <select name="staff" defaultValue={staffFilter} className="admin-field" style={{ width: 170 }}>
        <option value="">ทุกพนักงาน</option>
        {(staffList || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <select name="action" defaultValue={action} className="admin-field" style={{ width: 160 }}>
        <option value="">ทุก action</option>
        {Object.entries(ACTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
      <input type="date" name="from" defaultValue={from} className="admin-field" style={{ width: 140 }} />
      <input type="date" name="to"   defaultValue={to}   className="admin-field" style={{ width: 140 }} />
      {userFilter && <input type="hidden" name="user" value={userFilter} />}
      <button type="submit" className="admin-btn admin-btn-ink">ค้นหา</button>
      {hasFilter && <Link href="/admin/audit" className="admin-btn admin-btn-ghost"><X size={12} /> ล้าง</Link>}
    </form>
  )

  return (
    <PageShell
      eyebrow="Audit Log"
      title="ประวัติการทำงาน"
      subtitle={`${(count ?? 0).toLocaleString()} events${hasFilter ? ' · ใช้ filter อยู่' : ''}`}
      filters={filters}>

      {/* Leaderboard (last 30d) */}
      {leaderboard.length > 0 && (
        <div className="admin-card p-5 mb-5">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3" style={{ color: 'var(--admin-ink)' }}>
            <Trophy size={15} style={{ color: 'var(--admin-gold)' }} />
            Top staff — 30 วันล่าสุด
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {leaderboard.map((s, i) => (
              <div key={s.name} className="p-3 rounded-xl"
                style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border-2)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                    style={{ background: i === 0 ? '#C99B3E' : 'var(--admin-ink-ghost)', color: i === 0 ? '#fff' : 'var(--admin-ink-soft)' }}>
                    {i + 1}
                  </div>
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--admin-ink)' }}>{s.name}</p>
                </div>
                <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--admin-ink)' }}>
                  {s.total.toLocaleString()}
                </p>
                <p className="text-[10px]" style={{ color: 'var(--admin-ink-mute)' }}>actions ทั้งหมด</p>
                <div className="mt-2 flex gap-2 text-[10px]">
                  <span style={{ color: '#3A8E5A' }}>✓ {s.approved}</span>
                  <span style={{ color: '#B14242' }}>✗ {s.rejected}</span>
                  <span style={{ color: '#C99B3E' }}>⭐ {s.points}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-user filter banner */}
      {userFilter && (
        <div className="admin-card p-3 flex items-center justify-between mb-5"
          style={{ background: 'rgba(74,123,193,0.06)', borderColor: 'rgba(74,123,193,0.20)' }}>
          <div className="flex items-center gap-2 text-sm" style={{ color: '#4A7BC1' }}>
            <Search size={14} /> กรองเฉพาะ user
            <Link href={`/admin/members/${userFilter}`}
              className="font-mono text-xs underline">{userFilter}</Link>
          </div>
          <Link href="/admin/audit" className="text-xs" style={{ color: '#4A7BC1' }}>ล้าง user filter</Link>
        </div>
      )}

      {/* Audit table */}
      <div className="admin-card overflow-hidden">
        <table className="admin-table">
          <thead>
            <tr>
              <th>เวลา</th>
              <th>พนักงาน</th>
              <th>Action</th>
              <th>สมาชิก</th>
              <th>รายละเอียด</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(logs || []).map((l: Record<string, unknown>) => {
              const staffRaw = l.admin_staff as { name?: string; role?: string } | { name?: string; role?: string }[] | null
              const staff = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw
              const userRaw = l.user as { full_name?: string; member_id?: string } | { full_name?: string; member_id?: string }[] | null
              const u = Array.isArray(userRaw) ? userRaw[0] : userRaw
              const detail = (l.detail as Record<string, unknown> | null) || {}
              const detailEntries = Object.entries(detail).filter(([k]) => k !== 'staff_name')

              // simple text-search across detail values (client-side; for full FTS use Postgres ilike)
              if (q) {
                const hay = JSON.stringify(detail).toLowerCase()
                if (!hay.includes(q.toLowerCase())) return null
              }

              return (
                <tr key={l.id as string}>
                  <td className="muted whitespace-nowrap" style={{ fontSize: 11 }}>{formatDateTime(l.created_at as string)}</td>
                  <td>
                    <p className="font-semibold text-[12.5px]" style={{ color: 'var(--admin-ink)' }}>{staff?.name || '-'}</p>
                    <p className="text-[10.5px]" style={{ color: 'var(--admin-ink-mute)' }}>{staff?.role}</p>
                  </td>
                  <td>{actionPill(l.action_type as string)}</td>
                  <td>
                    {u ? (
                      <Link href={`/admin/members/${l.user_id}`}
                        className="block hover:underline">
                        <p className="text-[12.5px]" style={{ color: 'var(--admin-ink)' }}>{u.full_name || '-'}</p>
                        <p className="font-mono text-[10.5px]" style={{ color: 'var(--admin-ink-faint)' }}>{u.member_id}</p>
                      </Link>
                    ) : <span className="muted text-[11px]">—</span>}
                  </td>
                  <td className="text-[11.5px]">
                    {detailEntries.map(([k, v]) => (
                      <span key={k} className="mr-3" style={{ color: 'var(--admin-ink-soft)' }}>
                        <span style={{ color: 'var(--admin-ink-faint)' }}>{k}:</span>{' '}
                        <span title={String(v)}>{String(v).slice(0, 80)}</span>
                      </span>
                    ))}
                  </td>
                  <td>
                    {l.user_id ? (
                      <Link href={`/admin/members/${l.user_id}`} style={{ color: 'var(--admin-ink-mute)' }}>
                        <ChevronRight size={15} />
                      </Link>
                    ) : null}
                  </td>
                </tr>
              )
            })}
            {(logs || []).length === 0 && (
              <tr><td colSpan={6} className="py-12 text-center" style={{ color: 'var(--admin-ink-faint)' }}>ไม่พบ events ตาม filter</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 flex-wrap mt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .slice(Math.max(0, page - 4), page + 3)
            .map(p => {
              const sp = new URLSearchParams()
              if (q) sp.set('q', q); if (staffFilter) sp.set('staff', staffFilter); if (action) sp.set('action', action)
              if (from) sp.set('from', from); if (to) sp.set('to', to); if (userFilter) sp.set('user', userFilter)
              sp.set('page', String(p))
              return (
                <Link key={p} href={'?' + sp.toString()}
                  className={p === page ? 'admin-btn admin-btn-ink' : 'admin-btn admin-btn-ghost'}
                  style={{ padding: '6px 12px', fontSize: 12 }}>
                  {p}
                </Link>
              )
            })}
        </div>
      )}
    </PageShell>
  )
}
