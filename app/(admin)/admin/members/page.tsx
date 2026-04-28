import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Search, ChevronRight, Users as UsersIcon, Crown } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface SearchParams { q?: string; tier?: string; tag?: string; page?: string; vip?: string }

const TIER_PILL: Record<string, string> = {
  PLUS:     'admin-pill',
  PRO:      'admin-pill admin-pill-ink',
  ULTRA:    'admin-pill admin-pill-amber',
  MASTER:   'admin-pill admin-pill-gold',
  SILVER:   'admin-pill',
  GOLD:     'admin-pill admin-pill-ink',
  PLATINUM: 'admin-pill admin-pill-gold',
}
const TIER_LABEL: Record<string, string> = {
  PLUS: 'Plus', PRO: 'Pro', ULTRA: 'Ultra', MASTER: 'Master',
  SILVER: 'Plus', GOLD: 'Pro', PLATINUM: 'Master',
}

export default async function MembersPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createServiceClient()
  const q    = searchParams.q || ''
  const tier = searchParams.tier || ''
  const tag  = searchParams.tag || ''
  const vip  = searchParams.vip === '1'
  const page = parseInt(searchParams.page || '1')
  const pageSize = 25

  let query = supabase.from('users').select('id, member_id, full_name, phone, email, tier, total_points, lifetime_points, created_at, is_active, tags, is_vip', { count: 'exact' })

  if (q)    query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,member_id.ilike.%${q}%`)
  if (tier) query = query.eq('tier', tier)
  if (vip)  query = query.eq('is_vip', true)
  if (tag)  query = query.contains('tags', [tag])

  const { data: users, count } = await query
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  // Pull existing tags for filter chip suggestions
  const { data: tagSamples } = await supabase
    .from('users').select('tags').not('tags', 'is', null).limit(500)
  const allTags = Array.from(new Set((tagSamples || []).flatMap(t => t.tags as string[]))).filter(Boolean).sort()

  const totalPages = Math.ceil((count || 0) / pageSize)

  function buildQS(extra: Record<string, string>) {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (tier) sp.set('tier', tier)
    if (tag) sp.set('tag', tag)
    if (vip) sp.set('vip', '1')
    Object.entries(extra).forEach(([k, v]) => v ? sp.set(k, v) : sp.delete(k))
    return '?' + sp.toString()
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1280 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 className="admin-h1">สมาชิก</h1>
          <p className="admin-sub">{(count ?? 0).toLocaleString()} คน</p>
        </div>
      </div>

      {/* Filter bar */}
      <form className="admin-card" style={{ padding: 14, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }} method="GET">
        <div style={{ position: 'relative', flex: '1 1 320px', minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint)' }} />
          <input name="q" defaultValue={q}
            placeholder="ค้นหาชื่อ, เบอร์, อีเมล, Member ID..."
            className="admin-field" style={{ paddingLeft: 36 }} />
        </div>
        <select name="tier" defaultValue={tier} className="admin-field" style={{ width: 140 }}>
          <option value="">ทุก Tier</option>
          <option value="PLUS">Plus</option>
          <option value="PRO">Pro</option>
          <option value="ULTRA">Ultra</option>
          <option value="MASTER">Master</option>
        </select>
        {allTags.length > 0 && (
          <select name="tag" defaultValue={tag} className="admin-field" style={{ width: 160 }}>
            <option value="">ทุก Tag</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 12px', background: 'var(--bg-soft)', borderRadius: 'var(--r-md)', fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)' }}>
          <input type="checkbox" name="vip" value="1" defaultChecked={vip} /> VIP เท่านั้น
        </label>
        <button type="submit" className="admin-btn admin-btn-ink">ค้นหา</button>
      </form>

      {/* Table */}
      <div className="admin-card" style={{ overflow: 'hidden' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Member ID</th>
              <th>ชื่อ</th>
              <th>ติดต่อ</th>
              <th>Tier</th>
              <th>คะแนน</th>
              <th>Tags</th>
              <th>วันสมัคร</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(users || []).map((u: Record<string, unknown>) => (
              <tr key={u.id as string}>
                <td className="num muted">{u.member_id as string}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600 }}>{(u.full_name as string) || '-'}</span>
                    {u.is_vip ? <Crown size={11} color="var(--gold)" /> : null}
                  </div>
                  {!u.is_active ? <span style={{ fontSize: 10, color: 'var(--red)' }}>ปิดใช้งาน</span> : null}
                </td>
                <td>
                  <p style={{ margin: 0, fontSize: 12 }}>{(u.phone as string) || '-'}</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-mute)' }}>{(u.email as string) || '-'}</p>
                </td>
                <td>
                  <span className={TIER_PILL[u.tier as string] || 'admin-pill'}>
                    {TIER_LABEL[u.tier as string] || (u.tier as string)}
                  </span>
                </td>
                <td className="num" style={{ color: 'var(--gold-deep)', fontWeight: 700 }}>
                  {Number(u.total_points).toLocaleString()}
                </td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {((u.tags as string[]) || []).slice(0, 3).map(t => (
                      <span key={t} className="admin-pill admin-pill-blue" style={{ fontSize: 10 }}>{t}</span>
                    ))}
                  </div>
                </td>
                <td className="muted" style={{ fontSize: 11 }}>{formatDate(u.created_at as string)}</td>
                <td>
                  <Link href={`/admin/members/${u.id}`} style={{ color: 'var(--ink-mute)' }}>
                    <ChevronRight size={15} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(users || []).length === 0 && (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--ink-mute)' }}>
            <UsersIcon size={28} style={{ margin: '0 auto 8px', display: 'block', color: 'var(--ink-faint)' }} />
            <p style={{ margin: 0, fontSize: 13 }}>ไม่พบข้อมูล</p>
          </div>
        )}
      </div>

      {/* Pagination */}
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
