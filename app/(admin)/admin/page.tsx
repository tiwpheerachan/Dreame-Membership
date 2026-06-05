import { createServiceClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/admin/DashboardClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Valid period keys → days back from today (null = all-time)
const PERIODS: Record<string, number | null> = {
  '7d':  7,
  '30d': 30,
  '90d': 90,
  '6m':  180,
  '1y':  365,
  'all': null,
}

export default async function AdminDashboard({
  searchParams,
}: { searchParams?: { period?: string } }) {
  const supabase = createServiceClient()

  const periodKey = (searchParams?.period && PERIODS[searchParams.period] !== undefined)
    ? searchParams.period
    : '30d'
  const periodDays = PERIODS[periodKey]

  const now = new Date()
  const startISO = periodDays
    ? new Date(now.getTime() - periodDays * 86_400_000).toISOString()
    : null
  // Trend chart: always show last 6 months regardless of period, so the
  // shape of the long-term trajectory is preserved.
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()

  const inPeriod = <T,>(q: T): T => {
    if (!startISO) return q
    // @ts-expect-error supabase chain
    return q.gte('created_at', startISO)
  }

  const [
    { count: totalMembers },
    { count: totalPurchases },
    { count: pendingCount },
    { count: approvedCount },
    { count: newMembersInPeriod },
    { count: newPurchasesInPeriod },
    { data: tierData },
    { data: channelData },
    { data: statusData },
    { data: pointsAggData },
    { data: topMembersRaw },
    { data: monthlyMembers },
    { data: monthlyPurchases },
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('purchase_registrations').select('*', { count: 'exact', head: true }),
    supabase.from('purchase_registrations').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
    supabase.from('purchase_registrations').select('*', { count: 'exact', head: true }).in('status', ['ADMIN_APPROVED', 'BQ_VERIFIED']),
    inPeriod(supabase.from('users').select('*', { count: 'exact', head: true })),
    inPeriod(supabase.from('purchase_registrations').select('*', { count: 'exact', head: true })),
    // Tier breakdown: members + sum of lifetime points per tier (for "Tier Point")
    supabase.from('users').select('tier, total_points, lifetime_points'),
    // Channel breakdown — count purchases per channel (within period if applicable)
    inPeriod(supabase.from('purchase_registrations').select('channel')),
    supabase.from('purchase_registrations').select('status'),
    // Total points issued (all-time) — single aggregate
    supabase.from('points_log').select('points_delta').eq('type', 'EARNED'),
    // Top 10 members by lifetime points
    supabase.from('users').select(`member_id, full_name, tier, total_points, lifetime_points, purchase_registrations(id)`).order('lifetime_points', { ascending: false }).limit(10),
    // 6-month trend
    supabase.from('users').select('created_at').gte('created_at', sixMonthsAgo),
    supabase.from('purchase_registrations').select('created_at').gte('created_at', sixMonthsAgo),
  ])

  // ── Tier breakdown (members + summed points per tier) ──
  type TierStat = { name: string; users: number; points: number }
  const tierMap: Record<string, TierStat> = {
    SILVER:   { name: 'SILVER',   users: 0, points: 0 },
    GOLD:     { name: 'GOLD',     users: 0, points: 0 },
    PLATINUM: { name: 'PLATINUM', users: 0, points: 0 },
  }
  ;(tierData || []).forEach((u: Record<string, unknown>) => {
    const t = (u.tier as string) || 'SILVER'
    if (!tierMap[t]) tierMap[t] = { name: t, users: 0, points: 0 }
    tierMap[t].users += 1
    tierMap[t].points += Number(u.lifetime_points || 0)
  })
  const tierBreakdown = Object.values(tierMap)

  // ── Channel breakdown ──
  const channelCount: Record<string, number> = {}
  ;(channelData || []).forEach((p: Record<string, unknown>) => {
    const ch = (p.channel as string) || 'OTHER'
    channelCount[ch] = (channelCount[ch] || 0) + 1
  })
  const channelBreakdown = Object.entries(channelCount)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }))

  // ── Status breakdown ──
  const statusCount: Record<string, number> = {}
  ;(statusData || []).forEach((p: Record<string, unknown>) => {
    const s = (p.status as string) || 'UNKNOWN'
    statusCount[s] = (statusCount[s] || 0) + 1
  })
  const statusBreakdown = Object.entries(statusCount).map(([name, value]) => ({ name, value }))

  // ── Totals ──
  const totalPointsIssued = (pointsAggData || [])
    .reduce((s: number, p: Record<string, unknown>) => s + Number(p.points_delta || 0), 0)

  // ── Monthly trend (6 months, no revenue) ──
  const monthKeys: string[] = []
  const monthLabels: string[] = []
  const monthMap: Record<string, { members: number; purchases: number }> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthKeys.push(key)
    monthLabels.push(d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }))
    monthMap[key] = { members: 0, purchases: 0 }
  }
  ;(monthlyMembers || []).forEach((u: Record<string, unknown>) => {
    const key = (u.created_at as string)?.substring(0, 7)
    if (monthMap[key]) monthMap[key].members++
  })
  ;(monthlyPurchases || []).forEach((p: Record<string, unknown>) => {
    const key = (p.created_at as string)?.substring(0, 7)
    if (monthMap[key]) monthMap[key].purchases++
  })
  const monthlyTrend = monthKeys.map((key, i) => ({ month: monthLabels[i], ...monthMap[key] }))

  // ── Top members ──
  const topMembers = (topMembersRaw || []).map((m: Record<string, unknown>) => ({
    member_id: m.member_id as string,
    full_name: (m.full_name as string) || '',
    tier: (m.tier as string) || 'SILVER',
    total_points: Number(m.total_points || 0),
    lifetime_points: Number(m.lifetime_points || 0),
    purchase_count: Array.isArray(m.purchase_registrations) ? m.purchase_registrations.length : 0,
  }))

  return (
    <DashboardClient data={{
      periodKey,
      stats: {
        totalMembers:        totalMembers ?? 0,
        totalPurchases:      totalPurchases ?? 0,
        pendingCount:        pendingCount ?? 0,
        approvedCount:       approvedCount ?? 0,
        totalPointsIssued,
        newMembersInPeriod:  newMembersInPeriod ?? 0,
        newPurchasesInPeriod: newPurchasesInPeriod ?? 0,
      },
      tierBreakdown,
      channelBreakdown,
      statusBreakdown,
      monthlyTrend,
      topMembers,
    }} />
  )
}
