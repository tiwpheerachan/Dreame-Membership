import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Search, ChevronRight, Users as UsersIcon, Crown } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import MemberAvatar from '@/components/admin/MemberAvatar'
import PageShell from '@/components/admin/PageShell'

interface SearchParams { q?: string; tier?: string; tag?: string; page?: string; vip?: string }

const TIER_PILL: Record<string, string> = {
  SILVER:   'admin-pill',
  GOLD:     'admin-pill admin-pill-amber',
  PLATINUM: 'admin-pill admin-pill-ink',
  PLUS:     'admin-pill',
  PRO:      'admin-pill admin-pill-amber',
  ULTRA:    'admin-pill admin-pill-ink',
  MASTER:   'admin-pill admin-pill-ink',
}
const TIER_LABEL: Record<string, string> = {
  SILVER: 'Silver', GOLD: 'Gold', PLATINUM: 'Platinum',
  PLUS: 'Silver', PRO: 'Gold', ULTRA: 'Platinum', MASTER: 'Platinum',
}

export default async function MembersPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createServiceClient()
  const q    = searchParams.q || ''
  const tier = searchParams.tier || ''
  const tag  = searchParams.tag || ''
  const vip  = searchParams.vip === '1'
  const page = parseInt(searchParams.page || '1')
  const pageSize = 25

  let query = supabase.from('users').select(
    'id, member_id, full_name, phone, email, tier, total_points, lifetime_points, created_at, is_active, tags, is_vip, profile_image_url',
    { count: 'exact' }
  )

  if (q)    query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,member_id.ilike.%${q}%`)
  if (tier) query = query.eq('tier', tier)
  if (vip)  query = query.eq('is_vip', true)
  if (tag)  query = query.contains('tags', [tag])

  const { data: users, count } = await query
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

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

  const filters = (
    <form className="flex flex-wrap gap-2 items-center" method="GET">
      <div className="relative flex-1 min-w-[280px]">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--admin-ink-faint)' }} />
        <input name="q" defaultValue={q}
          placeholder="ค้นหาชื่อ, เบอร์, อีเมล, Member ID..."
          className="admin-field" style={{ paddingLeft: 36 }} />
      </div>
      <select name="tier" defaultValue={tier} className="admin-field" style={{ width: 140 }}>
        <option value="">ทุก Tier</option>
        <option value="SILVER">Silver</option>
        <option value="GOLD">Gold</option>
        <option value="PLATINUM">Platinum</option>
      </select>
      {allTags.length > 0 && (
        <select name="tag" defaultValue={tag} className="admin-field" style={{ width: 160 }}>
          <option value="">ทุก Tag</option>
          {allTags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      )}
      <label className="inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-semibold cursor-pointer"
        style={{ background: 'var(--admin-bg)', color: 'var(--admin-ink-soft)', height: 40 }}>
        <input type="checkbox" name="vip" value="1" defaultChecked={vip} /> VIP เท่านั้น
      </label>
      <button type="submit" className="admin-btn admin-btn-ink">ค้นหา</button>
    </form>
  )

  return (
    <PageShell
      eyebrow="Customers"
      title="สมาชิก"
      subtitle={`${(count ?? 0).toLocaleString()} คน${q || tier || tag || vip ? ' (ตามตัวกรอง)' : ''}`}
      filters={filters}>

      <div className="admin-card overflow-hidden">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 56 }}></th>
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
                <td style={{ paddingLeft: 14, paddingRight: 0 }}>
                  <MemberAvatar
                    name={u.full_name as string | null}
                    src={u.profile_image_url as string | null}
                    tier={u.tier as string}
                    size={36} />
                </td>
                <td className="num muted">{u.member_id as string}</td>
                <td>
                  <div className="flex items-center gap-1.5">
                    <span style={{ fontWeight: 600, color: 'var(--admin-ink)' }}>
                      {(u.full_name as string) || '-'}
                    </span>
                    {u.is_vip ? <Crown size={11} style={{ color: 'var(--admin-gold)' }} /> : null}
                  </div>
                  {!u.is_active ? <span style={{ fontSize: 10, color: '#B14242' }}>ปิดใช้งาน</span> : null}
                </td>
                <td>
                  <p className="text-[12px]" style={{ color: 'var(--admin-ink)' }}>{(u.phone as string) || '-'}</p>
                  <p className="text-[11px]" style={{ color: 'var(--admin-ink-mute)' }}>{(u.email as string) || '-'}</p>
                </td>
                <td>
                  <span className={TIER_PILL[u.tier as string] || 'admin-pill'}>
                    {TIER_LABEL[u.tier as string] || (u.tier as string)}
                  </span>
                </td>
                <td className="num font-semibold" style={{ color: 'var(--admin-gold-deep)' }}>
                  {Number(u.total_points).toLocaleString()}
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {((u.tags as string[]) || []).slice(0, 3).map(t => (
                      <span key={t} className="admin-pill admin-pill-blue" style={{ fontSize: 10 }}>{t}</span>
                    ))}
                  </div>
                </td>
                <td className="muted" style={{ fontSize: 11 }}>{formatDate(u.created_at as string)}</td>
                <td>
                  <Link href={`/admin/members/${u.id}`} style={{ color: 'var(--admin-ink-mute)' }}>
                    <ChevronRight size={16} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(users || []).length === 0 && (
          <div className="py-16 text-center" style={{ color: 'var(--admin-ink-mute)' }}>
            <UsersIcon size={28} className="mx-auto mb-2" style={{ color: 'var(--admin-ink-faint)' }} />
            <p className="text-sm">ไม่พบข้อมูล</p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 flex-wrap mt-5">
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
    </PageShell>
  )
}
