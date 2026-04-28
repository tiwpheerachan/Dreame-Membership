import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Search, ChevronRight, Package, ExternalLink } from 'lucide-react'
import { formatDate, channelLabel } from '@/lib/utils'

interface SearchParams {
  q?: string; status?: string; channel?: string;
  from?: string; to?: string; page?: string;
}

const STATUS_PILL: Record<string, string> = {
  ADMIN_APPROVED: 'admin-pill admin-pill-green',
  BQ_VERIFIED:    'admin-pill admin-pill-green',
  PENDING:        'admin-pill admin-pill-amber',
  REJECTED:       'admin-pill admin-pill-red',
}
const STATUS_LABEL: Record<string, string> = {
  ADMIN_APPROVED: 'อนุมัติ',
  BQ_VERIFIED:    'BQ Verified',
  PENDING:        'รอตรวจ',
  REJECTED:       'ปฏิเสธ',
}

export default async function PurchasesAdminPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createServiceClient()
  const q       = searchParams.q || ''
  const status  = searchParams.status || ''
  const channel = searchParams.channel || ''
  const from    = searchParams.from || ''
  const to      = searchParams.to || ''
  const page    = parseInt(searchParams.page || '1')
  const pageSize = 30

  let query = supabase
    .from('purchase_registrations')
    .select(`
      id, order_sn, model_name, serial_number, channel, channel_type, status,
      total_amount, points_awarded, purchase_date, warranty_end, created_at,
      users!inner(member_id, full_name, phone)
    `, { count: 'exact' })

  if (q)       query = query.or(`order_sn.ilike.%${q}%,serial_number.ilike.%${q}%,model_name.ilike.%${q}%`)
  if (status)  query = query.eq('status', status)
  if (channel) query = query.eq('channel', channel)
  if (from)    query = query.gte('created_at', from)
  if (to)      query = query.lte('created_at', to)

  const { data: purchases, count } = await query
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const totalPages = Math.ceil((count || 0) / pageSize)
  function buildQS(extra: Record<string, string>) {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q); if (status) sp.set('status', status); if (channel) sp.set('channel', channel)
    if (from) sp.set('from', from); if (to) sp.set('to', to)
    Object.entries(extra).forEach(([k, v]) => v ? sp.set(k, v) : sp.delete(k))
    return '?' + sp.toString()
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <div style={{ marginBottom: 18 }}>
        <h1 className="admin-h1">สินค้าทั้งหมด</h1>
        <p className="admin-sub">{(count ?? 0).toLocaleString()} รายการ</p>
      </div>

      {/* Filters */}
      <form className="admin-card" style={{ padding: 14, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }} method="GET">
        <div style={{ position: 'relative', flex: '1 1 280px', minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint)' }} />
          <input name="q" defaultValue={q}
            placeholder="ค้นหา order_sn, serial, model..."
            className="admin-field" style={{ paddingLeft: 36 }} />
        </div>
        <select name="status" defaultValue={status} className="admin-field" style={{ width: 140 }}>
          <option value="">ทุกสถานะ</option>
          <option value="PENDING">รอตรวจ</option>
          <option value="BQ_VERIFIED">BQ Verified</option>
          <option value="ADMIN_APPROVED">อนุมัติ</option>
          <option value="REJECTED">ปฏิเสธ</option>
        </select>
        <select name="channel" defaultValue={channel} className="admin-field" style={{ width: 130 }}>
          <option value="">ทุกช่องทาง</option>
          <option value="SHOPEE">Shopee</option>
          <option value="LAZADA">Lazada</option>
          <option value="WEBSITE">Website</option>
          <option value="TIKTOK">TikTok</option>
          <option value="STORE">หน้าร้าน</option>
          <option value="OTHER">อื่นๆ</option>
        </select>
        <input type="date" name="from" defaultValue={from} className="admin-field" style={{ width: 140 }} />
        <input type="date" name="to" defaultValue={to} className="admin-field" style={{ width: 140 }} />
        <button type="submit" className="admin-btn admin-btn-ink">ค้นหา</button>
        {(q || status || channel || from || to) && (
          <a href="/admin/purchases" className="admin-btn admin-btn-ghost">ล้าง</a>
        )}
      </form>

      <div className="admin-card" style={{ overflow: 'hidden' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>สมาชิก</th>
              <th>สินค้า</th>
              <th>ช่องทาง</th>
              <th>สถานะ</th>
              <th>ยอด</th>
              <th>คะแนน</th>
              <th>วันที่</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(purchases || []).map((p: Record<string, unknown>) => {
              const u = p.users as Record<string, unknown> | null
              return (
                <tr key={p.id as string}>
                  <td className="num" style={{ fontSize: 11 }}>{p.order_sn as string}</td>
                  <td>
                    <p style={{ margin: 0, fontWeight: 600 }}>{(u?.full_name as string) || '-'}</p>
                    <p className="num muted" style={{ margin: 0, fontSize: 10.5 }}>{(u?.member_id as string) || '-'}</p>
                  </td>
                  <td>
                    <p style={{ margin: 0, fontSize: 12.5, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(p.model_name as string) || '-'}
                    </p>
                    {p.serial_number ? <p className="muted" style={{ margin: 0, fontSize: 10.5 }}>SN: {p.serial_number as string}</p> : null}
                  </td>
                  <td className="muted" style={{ fontSize: 11 }}>{channelLabel(p.channel as string)}</td>
                  <td><span className={STATUS_PILL[p.status as string] || 'admin-pill'}>{STATUS_LABEL[p.status as string] || (p.status as string)}</span></td>
                  <td className="num" style={{ fontWeight: 700 }}>฿{Number(p.total_amount || 0).toLocaleString()}</td>
                  <td className="num" style={{ color: 'var(--gold-deep)', fontWeight: 600 }}>
                    {Number(p.points_awarded || 0) > 0 ? `+${Number(p.points_awarded).toLocaleString()}` : '-'}
                  </td>
                  <td className="muted" style={{ fontSize: 11 }}>{formatDate(p.created_at as string)}</td>
                  <td>
                    <Link href={`/admin/members/${(p as { user_id?: string }).user_id ?? ''}`}
                      style={{ color: 'var(--ink-mute)' }}>
                      <ChevronRight size={15} />
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {(purchases || []).length === 0 && (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--ink-mute)' }}>
            <Package size={28} style={{ margin: '0 auto 8px', display: 'block', color: 'var(--ink-faint)' }} />
            <p style={{ margin: 0, fontSize: 13 }}>ไม่พบข้อมูล</p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .slice(Math.max(0, page - 4), page + 3)
            .map(p => (
              <a key={p} href={buildQS({ page: String(p) })}
                className={p === page ? 'admin-btn admin-btn-ink' : 'admin-btn admin-btn-ghost'}
                style={{ padding: '6px 12px', fontSize: 12, minWidth: 32 }}>
                {p}
              </a>
            ))}
        </div>
      )}
    </div>
  )
}
