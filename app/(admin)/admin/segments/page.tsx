import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ChevronRight, BarChart3 } from 'lucide-react'

const SEGMENTS = [
  { key: 'champions', label: 'Champions', desc: 'ซื้อล่าสุด · บ่อย · ยอดสูง', cls: 'admin-pill-gold',  rec: [1,2], freq: [1,2], mon: [1,2] },
  { key: 'loyal',     label: 'Loyal Customers', desc: 'ซื้อบ่อย ยอดดี', cls: 'admin-pill-blue', rec: [1,2,3], freq: [1,2,3], mon: [1,2,3] },
  { key: 'at-risk',   label: 'At Risk', desc: 'เคยดี เริ่มหาย',          cls: 'admin-pill-amber', rec: [3,4], freq: [1,2,3], mon: [1,2,3] },
  { key: 'lost',      label: 'Lost',     desc: 'ไม่ซื้อมากกว่า 1 ปี',     cls: 'admin-pill-red', rec: [5], freq: [1,2,3,4,5], mon: [1,2,3,4,5] },
  { key: 'new',       label: 'New',      desc: 'เพิ่งซื้อล่าสุด',          cls: 'admin-pill-green', rec: [1], freq: [4,5], mon: [3,4,5] },
  { key: 'high-value',label: 'High Value', desc: 'ยอดสูง',                cls: 'admin-pill-gold', rec: [1,2,3,4,5], freq: [1,2,3,4,5], mon: [1] },
  { key: 'sleeping',  label: 'Sleeping',  desc: 'ไม่ซื้อ 90+ วัน',         cls: 'admin-pill', rec: [3,4,5], freq: [1,2,3,4,5], mon: [1,2,3,4,5] },
]

export default async function SegmentsPage() {
  const supabase = createServiceClient()
  const { data: rfm } = await supabase.from('v_member_rfm').select('*').limit(2000)
  const list = (rfm || []) as Array<Record<string, unknown>>

  const stats = SEGMENTS.map(s => {
    const matched = list.filter(m =>
      s.rec.includes(Number(m.recency_score)) &&
      s.freq.includes(Number(m.frequency_score)) &&
      s.mon.includes(Number(m.monetary_score))
    )
    return {
      ...s,
      count: matched.length,
      revenue: matched.reduce((sum, m) => sum + Number(m.monetary || 0), 0),
    }
  })

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <div style={{ marginBottom: 18 }}>
        <h1 className="admin-h1"><BarChart3 size={18} style={{ verticalAlign: 'baseline' }} /> Customer Segments</h1>
        <p className="admin-sub">RFM segmentation — Recency · Frequency · Monetary</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {stats.map(s => (
          <div key={s.key} className="admin-card" style={{ padding: 18 }}>
            <span className={`admin-pill ${s.cls}`}>{s.label}</span>
            <p className="num" style={{ fontSize: 28, fontWeight: 800, margin: '12px 0 4px' }}>{s.count.toLocaleString()}</p>
            <p style={{ fontSize: 11, color: 'var(--ink-mute)', margin: '0 0 8px' }}>{s.desc}</p>
            <p className="num" style={{ fontSize: 11, color: 'var(--gold-deep)', margin: 0, fontWeight: 600 }}>
              ฿{Math.round(s.revenue).toLocaleString()} lifetime
            </p>
          </div>
        ))}
      </div>

      {/* All members RFM table */}
      <div className="admin-card" style={{ marginTop: 20, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--hair)' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>All members · RFM Detail</p>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-mute)' }}>Recency / Frequency / Monetary scores (1=best, 5=worst)</p>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Member ID</th>
              <th>ชื่อ</th>
              <th>Tier</th>
              <th>R</th>
              <th>F</th>
              <th>M</th>
              <th>Last buy</th>
              <th>Lifetime</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.slice(0, 100).map((m, i) => (
              <tr key={i}>
                <td className="num muted">{m.member_id as string}</td>
                <td style={{ fontWeight: 600 }}>{(m.full_name as string) || '-'}</td>
                <td><span className="admin-pill">{m.tier as string}</span></td>
                <td className="num">{m.recency_score as number}</td>
                <td className="num">{m.frequency_score as number}</td>
                <td className="num">{m.monetary_score as number}</td>
                <td className="muted" style={{ fontSize: 11 }}>{m.last_purchase ? new Date(m.last_purchase as string).toLocaleDateString('th-TH') : '-'}</td>
                <td className="num" style={{ fontWeight: 700 }}>฿{Number(m.monetary || 0).toLocaleString()}</td>
                <td>
                  <Link href={`/admin/members/${m.id}`} style={{ color: 'var(--ink-mute)' }}>
                    <ChevronRight size={14} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length > 100 && (
          <p style={{ padding: 12, fontSize: 11, color: 'var(--ink-mute)', textAlign: 'center' }}>
            แสดง 100 แถวแรก · ทั้งหมด {list.length} คน
          </p>
        )}
      </div>
    </div>
  )
}
