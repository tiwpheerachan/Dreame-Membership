import { createServiceClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/admin/DashboardClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminDashboard() {
  const supabase = createServiceClient()

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    { count: totalMembers },
    { count: totalPurchases },
    { count: pendingCount },
    { count: approvedCount },
    { count: newMembersThisMonth },
    { count: newPurchasesThisMonth },
    { data: tierData },
    { data: channelData },
    { data: statusData },
    { data: pointsData },
    { data: revenueData },
    { data: allMembers },
    { data: allPurchases },
    { data: topMembersRaw },
    { data: monthlyPurchases },
    { data: monthlyMembers },
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('purchase_registrations').select('*', { count: 'exact', head: true }),
    supabase.from('purchase_registrations').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
    supabase.from('purchase_registrations').select('*', { count: 'exact', head: true }).in('status', ['ADMIN_APPROVED', 'BQ_VERIFIED']),
    supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth),
    supabase.from('purchase_registrations').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth),
    supabase.from('users').select('tier'),
    supabase.from('purchase_registrations').select('channel'),
    supabase.from('purchase_registrations').select('status'),
    supabase.from('points_log').select('points_delta').eq('type', 'EARNED'),
    supabase.from('purchase_registrations').select('total_amount').in('status', ['ADMIN_APPROVED', 'BQ_VERIFIED']),
    supabase.from('users').select('member_id, full_name, email, phone, tier, total_points, lifetime_points, created_at').order('created_at', { ascending: false }),
    supabase.from('purchase_registrations').select(`order_sn, channel, status, total_amount, points_awarded, purchase_date, warranty_end, serial_number, model_name, created_at, users!inner(member_id, full_name)`).order('created_at', { ascending: false }),
    supabase.from('users').select(`member_id, full_name, tier, total_points, lifetime_points, purchase_registrations(id)`).order('lifetime_points', { ascending: false }).limit(10),
    supabase.from('purchase_registrations').select('created_at, total_amount').order('created_at', { ascending: true }),
    supabase.from('users').select('created_at').order('created_at', { ascending: true }),
  ])

  // Tier Breakdown
  const tierCount: Record<string, number> = { SILVER: 0, GOLD: 0, PLATINUM: 0 }
  ;(tierData || []).forEach((u: Record<string, unknown>) => {
    const t = u.tier as string
    if (tierCount[t] !== undefined) tierCount[t]++
  })
  const tierBreakdown = Object.entries(tierCount).map(([name, value]) => ({ name, value, color: '' }))

  // Channel Breakdown
  const channelCount: Record<string, number> = {}
  ;(channelData || []).forEach((p: Record<string, unknown>) => {
    const ch = (p.channel as string) || 'OTHER'
    channelCount[ch] = (channelCount[ch] || 0) + 1
  })
  const channelBreakdown = Object.entries(channelCount).sort((a,b) => b[1]-a[1]).map(([name, value]) => ({ name, value, color: '' }))

  // Status Breakdown
  const statusCount: Record<string, number> = {}
  ;(statusData || []).forEach((p: Record<string, unknown>) => {
    const st = (p.status as string) || 'UNKNOWN'
    statusCount[st] = (statusCount[st] || 0) + 1
  })
  const statusBreakdown = Object.entries(statusCount).map(([name, value]) => ({ name, value, color: '' }))

  // Totals
  const totalPointsIssued = (pointsData || []).reduce((sum: number, p: Record<string, unknown>) => sum + (Number(p.points_delta) || 0), 0)
  const totalRevenue = (revenueData || []).reduce((sum: number, p: Record<string, unknown>) => sum + (Number(p.total_amount) || 0), 0)

  // Monthly Trend (last 6 months)
  const monthKeys: string[] = []
  const monthLabels: string[] = []
  const monthMap: Record<string, { members: number; purchases: number; revenue: number }> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthKeys.push(key)
    monthLabels.push(d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }))
    monthMap[key] = { members: 0, purchases: 0, revenue: 0 }
  }
  ;(monthlyMembers || []).forEach((u: Record<string, unknown>) => {
    const key = (u.created_at as string)?.substring(0, 7)
    if (monthMap[key]) monthMap[key].members++
  })
  ;(monthlyPurchases || []).forEach((p: Record<string, unknown>) => {
    const key = (p.created_at as string)?.substring(0, 7)
    if (monthMap[key]) { monthMap[key].purchases++; monthMap[key].revenue += Number(p.total_amount) || 0 }
  })
  const monthlyTrend = monthKeys.map((key, i) => ({ month: monthLabels[i], ...monthMap[key] }))

  // Top Members
  const topMembers = (topMembersRaw || []).map((m: Record<string, unknown>) => ({
    member_id: m.member_id as string,
    full_name: m.full_name as string,
    email: '', phone: '',
    tier: m.tier as string,
    total_points: Number(m.total_points),
    lifetime_points: Number(m.lifetime_points),
    purchase_count: Array.isArray(m.purchase_registrations) ? m.purchase_registrations.length : 0,
    created_at: '',
  }))

  // Export data
  const membersForExport = (allMembers || []).map((m: Record<string, unknown>) => ({
    member_id: m.member_id as string,
    full_name: m.full_name as string,
    email: m.email as string,
    phone: m.phone as string,
    tier: m.tier as string,
    total_points: Number(m.total_points),
    lifetime_points: Number(m.lifetime_points),
    created_at: m.created_at as string,
  }))

  const purchasesForExport = (allPurchases || []).map((p: Record<string, unknown>) => {
    const user = p.users as Record<string, unknown> | null
    return {
      order_sn: p.order_sn as string,
      member_id: (user?.member_id as string) || '',
      full_name: (user?.full_name as string) || '',
      model_name: (p.model_name as string) || '',
      channel: p.channel as string,
      status: p.status as string,
      total_amount: Number(p.total_amount),
      points_awarded: Number(p.points_awarded) || 0,
      serial_number: (p.serial_number as string) || '',
      purchase_date: (p.purchase_date as string) || '',
      warranty_end: (p.warranty_end as string) || '',
      created_at: p.created_at as string,
    }
  })

  return (
    <DashboardClient data={{
      stats: {
        totalMembers: totalMembers ?? 0,
        totalPurchases: totalPurchases ?? 0,
        pendingCount: pendingCount ?? 0,
        approvedCount: approvedCount ?? 0,
        totalPointsIssued,
        totalRevenue,
        newMembersThisMonth: newMembersThisMonth ?? 0,
        newPurchasesThisMonth: newPurchasesThisMonth ?? 0,
      },
      tierBreakdown,
      channelBreakdown,
      statusBreakdown,
      monthlyTrend,
      topMembers,
      allMembers: membersForExport,
      allPurchases: purchasesForExport,
    }} />
  )
}