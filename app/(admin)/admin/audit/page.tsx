import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Search, ChevronRight, History } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

interface SearchParams { q?: string; staff?: string; action?: string; from?: string; to?: string; page?: string }

const ACTION_LABEL: Record<string, string> = {
  PURCHASE_APPROVED: 'อนุมัติ',
  PURCHASE_REJECTED: 'ปฏิเสธ',
  PURCHASE_ADDED:    'เพิ่มประวัติ',
  PURCHASE_DELETED:  'ลบประวัติ',
  POINTS_ADJUSTED:   'ปรับแต้ม',
  COUPON_CREATED:    'สร้างคูปอง',
  MEMBER_VIEWED:     'ดูสมาชิก',
}

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createServiceClient()
  const q = searchParams.q || ''
  const staffFilter = searchParams.staff || ''
  const action = searchParams.action || ''
  const from = searchParams.from || ''
  const to = searchParams.to || ''
  const page = parseInt(searchParams.page || '1')
  const pageSize = 50

  let query = supabase
    .from('admin_audit_log')
    .select('id, action_type, created_at, target_id, user_id, detail, staff_id, admin_staff(name, role)', { count: 'exact' })

  if (action) query = query.eq('action_type', action)
  if (staffFilter) query = query.eq('staff_id', staffFilter)
  if (from)   query = query.gte('created_at', from)
  if (to)     query = query.lte('created_at', to)

  const { data: logs, count } = await query
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const { data: staffList } = await supabase.from('admin_staff').select('id, name').order('name')

  const totalPages = Math.ceil((count || 0) / pageSize)

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <div style={{ marginBottom: 18 }}>
        <h1 className="admin-h1"><History size={18} style={{ verticalAlign: 'baseline' }} /> Audit Log</h1>
        <p className="admin-sub">{(count ?? 0).toLocaleString()} events</p>
      </div>

      <form className="admin-card" style={{ padding: 14, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }} method="GET">
        <select name="staff" defaultValue={staffFilter} className="admin-field" style={{ width: 180 }}>
          <option value="">ทุกพนักงาน</option>
          {(staffList || []).map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select name="action" defaultValue={action} className="admin-field" style={{ width: 160 }}>
          <option value="">ทุก action</option>
          {Object.entries(ACTION_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={from} className="admin-field" style={{ width: 140 }} />
        <input type="date" name="to" defaultValue={to} className="admin-field" style={{ width: 140 }} />
        <button type="submit" className="admin-btn admin-btn-ink">ค้นหา</button>
        {(staffFilter || action || from || to) && <a href="/admin/audit" className="admin-btn admin-btn-ghost">ล้าง</a>}
      </form>

      <div className="admin-card" style={{ overflow: 'hidden' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>เวลา</th>
              <th>พนักงาน</th>
              <th>Action</th>
              <th>รายละเอียด</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(logs || []).map((l: Record<string, unknown>) => {
              const staff = l.admin_staff as { name?: string; role?: string } | null
              const detail = (l.detail as Record<string, unknown> | null) || {}
              return (
                <tr key={l.id as string}>
                  <td className="muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{formatDateTime(l.created_at as string)}</td>
                  <td>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 12.5 }}>{staff?.name || '-'}</p>
                    <p className="muted" style={{ margin: 0, fontSize: 10.5 }}>{staff?.role}</p>
                  </td>
                  <td>
                    <span className="admin-pill">{ACTION_LABEL[l.action_type as string] || (l.action_type as string)}</span>
                  </td>
                  <td style={{ fontSize: 11.5 }}>
                    {Object.entries(detail).filter(([k]) => k !== 'staff_name').map(([k, v]) => (
                      <span key={k} style={{ marginRight: 10, color: 'var(--ink-soft)' }}>
                        <span style={{ color: 'var(--ink-faint)' }}>{k}:</span> {String(v).slice(0, 60)}
                      </span>
                    ))}
                  </td>
                  <td>
                    {l.user_id ? (
                      <Link href={`/admin/members/${l.user_id}`} style={{ color: 'var(--ink-mute)' }}>
                        <ChevronRight size={15} />
                      </Link>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .slice(Math.max(0, page - 4), page + 3)
            .map(p => {
              const sp = new URLSearchParams()
              if (q) sp.set('q', q); if (staffFilter) sp.set('staff', staffFilter); if (action) sp.set('action', action)
              if (from) sp.set('from', from); if (to) sp.set('to', to); sp.set('page', String(p))
              return (
                <a key={p} href={'?' + sp.toString()}
                  className={p === page ? 'admin-btn admin-btn-ink' : 'admin-btn admin-btn-ghost'}
                  style={{ padding: '6px 12px', fontSize: 12 }}>
                  {p}
                </a>
              )
            })}
        </div>
      )}
    </div>
  )
}
