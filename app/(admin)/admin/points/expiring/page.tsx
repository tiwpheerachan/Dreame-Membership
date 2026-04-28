import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface SearchParams { window?: string }

export default async function PointsExpiringPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createServiceClient()
  const win = parseInt(searchParams.window || '30')

  const { data: rows } = await supabase
    .from('v_points_expiring')
    .select('*')
    .lte('days_left', win)
    .order('expires_at', { ascending: true })
    .limit(500)

  const totalExpiring = (rows || []).reduce((s, r) => s + Number(r.points_remaining || 0), 0)
  const userCount = new Set((rows || []).map(r => r.user_id)).size

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
        <div>
          <h1 className="admin-h1">แต้มจะหมดอายุ</h1>
          <p className="admin-sub">ใน {win} วันข้างหน้า · {userCount} คน · {totalExpiring.toLocaleString()} pts</p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[7, 30, 60, 90].map(d => (
            <a key={d} href={`?window=${d}`}
              className={d === win ? 'admin-btn admin-btn-ink' : 'admin-btn admin-btn-ghost'}
              style={{ padding: '6px 14px', fontSize: 12 }}>
              {d} วัน
            </a>
          ))}
        </div>
      </div>

      <div className="admin-card" style={{ overflow: 'hidden' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Member ID</th>
              <th>ชื่อ</th>
              <th>คะแนน</th>
              <th>หมดอายุ</th>
              <th>เหลือ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((r: Record<string, unknown>, i: number) => (
              <tr key={`${r.user_id}-${i}`}>
                <td className="num muted">{r.member_id as string}</td>
                <td style={{ fontWeight: 600 }}>{(r.full_name as string) || '-'}</td>
                <td className="num" style={{ color: 'var(--gold-deep)', fontWeight: 700 }}>
                  {Number(r.points_remaining).toLocaleString()}
                </td>
                <td className="muted" style={{ fontSize: 11 }}>{formatDate(r.expires_at as string)}</td>
                <td>
                  <span className={Number(r.days_left) <= 7 ? 'admin-pill admin-pill-red' : Number(r.days_left) <= 30 ? 'admin-pill admin-pill-amber' : 'admin-pill'}>
                    {r.days_left as number} วัน
                  </span>
                </td>
                <td>
                  <Link href={`/admin/members/${r.user_id}`} style={{ color: 'var(--ink-mute)' }}>
                    <ChevronRight size={15} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(rows || []).length === 0 && (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--ink-mute)' }}>
            <AlertTriangle size={28} style={{ margin: '0 auto 8px', display: 'block', color: 'var(--ink-faint)' }} />
            <p style={{ margin: 0, fontSize: 13 }}>ไม่มีแต้มที่จะหมดอายุในช่วงนี้</p>
          </div>
        )}
      </div>
    </div>
  )
}
