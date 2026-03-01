import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Search, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface SearchParams { q?: string; tier?: string; page?: string }

export default async function MembersPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createServiceClient()
  const q = searchParams.q || ''
  const tier = searchParams.tier || ''
  const page = parseInt(searchParams.page || '1')
  const pageSize = 20

  let query = supabase.from('users').select('id, member_id, full_name, phone, email, tier, total_points, lifetime_points, created_at, is_active', { count: 'exact' })

  if (q) query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,member_id.ilike.%${q}%`)
  if (tier) query = query.eq('tier', tier)

  const { data: users, count } = await query
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const totalPages = Math.ceil((count || 0) / pageSize)

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-white text-2xl font-bold">สมาชิกทั้งหมด</h1>
        <p className="text-gray-400 text-sm">{count?.toLocaleString()} คน</p>
      </div>

      {/* Search & filters */}
      <div className="flex gap-3">
        <form className="flex-1 flex gap-2" method="GET">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input name="q" defaultValue={q} placeholder="ค้นหาชื่อ, เบอร์, อีเมล, Member ID..."
              className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 text-sm" />
          </div>
          <select name="tier" defaultValue={tier}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 text-gray-400 focus:outline-none text-sm">
            <option value="">ทุก Tier</option>
            <option value="SILVER">Silver</option>
            <option value="GOLD">Gold</option>
            <option value="PLATINUM">Platinum</option>
          </select>
          <button type="submit" className="bg-amber-500 hover:bg-amber-400 text-gray-900 px-4 rounded-lg font-semibold text-sm">ค้นหา</button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/70">
              {['Member ID', 'ชื่อ', 'ติดต่อ', 'Tier', 'คะแนน', 'วันสมัคร', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-gray-400 font-medium text-xs">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(users || []).map((u: Record<string, unknown>) => (
              <tr key={u.id as string} className="border-b border-gray-800/40 hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3 font-mono text-gray-400 text-xs">{u.member_id as string}</td>
                <td className="px-4 py-3">
                  <p className="text-white font-medium">{u.full_name as string || '-'}</p>
                  {!u.is_active && <span className="text-red-400 text-xs">ปิดใช้งาน</span>}
                </td>
                <td className="px-4 py-3">
                  <p className="text-gray-400 text-xs">{u.phone as string || '-'}</p>
                  <p className="text-gray-500 text-xs">{u.email as string || '-'}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    u.tier === 'PLATINUM' ? 'bg-cyan-900/30 text-cyan-400' :
                    u.tier === 'GOLD' ? 'bg-yellow-900/30 text-yellow-400' :
                    'bg-gray-800 text-gray-400'}`}>
                    {u.tier as string}
                  </span>
                </td>
                <td className="px-4 py-3 text-amber-400 font-semibold">{Number(u.total_points).toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(u.created_at as string)}</td>
                <td className="px-4 py-3">
                  <Link href={`/admin/members/${u.id}`} className="text-gray-400 hover:text-white transition-colors">
                    <ChevronRight size={16} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(users || []).length === 0 && (
          <div className="py-12 text-center text-gray-500">ไม่พบข้อมูล</div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex gap-2 justify-center">
          {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, page - 3), page + 2).map(p => (
            <a key={p} href={`?q=${q}&tier=${tier}&page=${p}`}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors ${p === page ? 'bg-amber-500 text-gray-900 font-bold' : 'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-700'}`}>
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
