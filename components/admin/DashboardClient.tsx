'use client'
import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend
} from 'recharts'
import {
  Users, Package, Clock, Star, TrendingUp, Download,
  ShoppingBag, Award, RefreshCw, ChevronDown
} from 'lucide-react'
import * as XLSX from 'xlsx'

// ─── Types ───────────────────────────────────────────────────
interface DashboardData {
  stats: {
    totalMembers: number
    totalPurchases: number
    pendingCount: number
    approvedCount: number
    totalPointsIssued: number
    totalRevenue: number
    newMembersThisMonth: number
    newPurchasesThisMonth: number
  }
  tierBreakdown: { name: string; value: number; color: string }[]
  channelBreakdown: { name: string; value: number; color: string }[]
  statusBreakdown: { name: string; value: number; color: string }[]
  monthlyTrend: { month: string; members: number; purchases: number; revenue: number }[]
  topMembers: {
    member_id: string; full_name: string; email: string; phone: string
    tier: string; total_points: number; lifetime_points: number
    purchase_count: number; created_at: string
  }[]
  allMembers: {
    member_id: string; full_name: string; email: string; phone: string
    tier: string; total_points: number; lifetime_points: number; created_at: string
  }[]
  allPurchases: {
    order_sn: string; member_id: string; full_name: string; model_name: string
    channel: string; status: string; total_amount: number; points_awarded: number
    purchase_date: string; warranty_end: string; serial_number: string; created_at: string
  }[]
}

const TIER_COLORS: Record<string, string> = {
  SILVER: '#94a3b8', GOLD: '#fbbf24', PLATINUM: '#67e8f9'
}
const STATUS_COLORS: Record<string, string> = {
  ADMIN_APPROVED: '#4ade80', BQ_VERIFIED: '#60a5fa',
  PENDING: '#fbbf24', REJECTED: '#f87171'
}
const CHANNEL_COLORS = ['#f59e0b','#3b82f6','#8b5cf6','#10b981','#ec4899','#f97316']

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-gray-400 text-xs mb-1">{label}</p>
          <p className={`text-2xl font-black ${color}`}>{value}</p>
          {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center opacity-80`}
          style={{ background: color.replace('text-','').includes('amber') ? '#451a03' : color.replace('text-','').includes('blue') ? '#0c1e3a' : color.replace('text-','').includes('green') ? '#052e16' : color.replace('text-','').includes('purple') ? '#2e1065' : color.replace('text-','').includes('cyan') ? '#083344' : '#1c1917' }}>
          <Icon size={18} className={color} />
        </div>
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: Record<string, unknown>) => {
  if (active && payload && (payload as unknown[]).length) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs shadow-xl">
        <p className="text-gray-300 font-semibold mb-1">{label as string}</p>
        {(payload as { color: string; name: string; value: number }[]).map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: <strong>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</strong></p>
        ))}
      </div>
    )
  }
  return null
}

export default function DashboardClient({ data }: { data: DashboardData }) {
  const [exporting, setExporting] = useState<string | null>(null)
  const [activeExport, setActiveExport] = useState(false)

  // ─── Excel Export ─────────────────────────────────────────
  async function exportExcel(type: 'members' | 'purchases' | 'summary') {
    setExporting(type)
    await new Promise(r => setTimeout(r, 100))

    const wb = XLSX.utils.book_new()

    if (type === 'members' || type === 'summary') {
      const memberRows = data.allMembers.map(m => ({
        'Member ID':          m.member_id,
        'ชื่อ-นามสกุล':       m.full_name || '-',
        'อีเมล':               m.email || '-',
        'เบอร์โทร':            m.phone || '-',
        'Tier':               m.tier,
        'คะแนนคงเหลือ':        m.total_points,
        'คะแนนสะสมตลอดกาล':    m.lifetime_points,
        'วันที่สมัคร':         m.created_at ? new Date(m.created_at).toLocaleDateString('th-TH') : '-',
      }))
      const ws = XLSX.utils.json_to_sheet(memberRows)
      ws['!cols'] = [14,20,28,14,10,14,18,14].map(w => ({ wch: w }))
      XLSX.utils.book_append_sheet(wb, ws, 'รายชื่อสมาชิก')
    }

    if (type === 'purchases' || type === 'summary') {
      const purchaseRows = data.allPurchases.map(p => ({
        'Order ID':           p.order_sn,
        'Member ID':          p.member_id,
        'ชื่อสมาชิก':         p.full_name || '-',
        'ชื่อสินค้า':         p.model_name || '-',
        'ช่องทาง':            p.channel,
        'สถานะ':              p.status,
        'ยอดรวม (฿)':         p.total_amount,
        'คะแนนที่ได้':         p.points_awarded || 0,
        'Serial Number':      p.serial_number || '-',
        'วันที่ซื้อ':          p.purchase_date ? new Date(p.purchase_date).toLocaleDateString('th-TH') : '-',
        'ประกันถึง':           p.warranty_end ? new Date(p.warranty_end).toLocaleDateString('th-TH') : '-',
        'วันที่ลงทะเบียน':     p.created_at ? new Date(p.created_at).toLocaleDateString('th-TH') : '-',
      }))
      const ws = XLSX.utils.json_to_sheet(purchaseRows)
      ws['!cols'] = [18,14,20,20,12,16,12,12,18,12,12,16].map(w => ({ wch: w }))
      XLSX.utils.book_append_sheet(wb, ws, 'ประวัติการซื้อ')
    }

    if (type === 'summary') {
      // Tier summary sheet
      const tierRows = data.tierBreakdown.map(t => ({ Tier: t.name, จำนวนสมาชิก: t.value }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tierRows), 'สรุปตาม Tier')

      // Channel summary sheet
      const chRows = data.channelBreakdown.map(c => ({ ช่องทาง: c.name, จำนวน: c.value }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(chRows), 'สรุปตามช่องทาง')

      // Monthly trend sheet
      const mRows = data.monthlyTrend.map(m => ({
        เดือน: m.month, สมาชิกใหม่: m.members, ยอดลงทะเบียน: m.purchases, รายได้: m.revenue
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mRows), 'แนวโน้มรายเดือน')

      // Overview sheet
      const overviewRows = [
        { รายการ: 'สมาชิกทั้งหมด',       ค่า: data.stats.totalMembers },
        { รายการ: 'สมาชิกใหม่เดือนนี้',   ค่า: data.stats.newMembersThisMonth },
        { รายการ: 'ลงทะเบียนทั้งหมด',     ค่า: data.stats.totalPurchases },
        { รายการ: 'รออนุมัติ',            ค่า: data.stats.pendingCount },
        { รายการ: 'อนุมัติแล้ว',          ค่า: data.stats.approvedCount },
        { รายการ: 'คะแนนที่แจกทั้งหมด',   ค่า: data.stats.totalPointsIssued },
        { รายการ: 'รายได้รวม (฿)',         ค่า: data.stats.totalRevenue },
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(overviewRows), 'ภาพรวม')
    }

    const filename = type === 'members' ? 'dreame_members' : type === 'purchases' ? 'dreame_purchases' : 'dreame_summary'
    const date = new Date().toISOString().split('T')[0]
    XLSX.writeFile(wb, `${filename}_${date}.xlsx`)
    setExporting(null)
  }

  const { stats, tierBreakdown, channelBreakdown, statusBreakdown, monthlyTrend, topMembers } = data

  return (
    <div className="p-6 space-y-6 max-w-7xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">ภาพรวมระบบ Dreame Membership • อัปเดตแบบ real-time</p>
        </div>

        {/* Export dropdown */}
        <div className="relative">
          <button onClick={() => setActiveExport(!activeExport)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-emerald-900/30">
            <Download size={15} />
            ดาวน์โหลด Excel
            <ChevronDown size={14} className={`transition-transform ${activeExport ? 'rotate-180' : ''}`} />
          </button>

          {activeExport && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setActiveExport(false)} />
              <div className="absolute right-0 top-12 z-50 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden w-56">
                {[
                  { key: 'members', label: '👥 รายชื่อสมาชิกทั้งหมด', sub: `${stats.totalMembers} คน` },
                  { key: 'purchases', label: '📦 ประวัติการซื้อทั้งหมด', sub: `${stats.totalPurchases} รายการ` },
                  { key: 'summary', label: '📊 ภาพรวมทั้งหมด', sub: 'ทุก sheet รวมกัน' },
                ].map(item => (
                  <button key={item.key}
                    onClick={() => { setActiveExport(false); exportExcel(item.key as 'members' | 'purchases' | 'summary') }}
                    disabled={!!exporting}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-700 transition-colors text-left border-b border-gray-700/50 last:border-0">
                    <div>
                      <p className="text-white text-sm font-medium">{item.label}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{item.sub}</p>
                    </div>
                    {exporting === item.key && <RefreshCw size={14} className="text-emerald-400 animate-spin ml-auto mt-1 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="สมาชิกทั้งหมด"       value={stats.totalMembers.toLocaleString()}     icon={Users}       color="text-blue-400"   sub={`+${stats.newMembersThisMonth} เดือนนี้`} />
        <StatCard label="ลงทะเบียนทั้งหมด"    value={stats.totalPurchases.toLocaleString()}    icon={Package}     color="text-green-400"  sub={`+${stats.newPurchasesThisMonth} เดือนนี้`} />
        <StatCard label="รออนุมัติ"           value={stats.pendingCount.toLocaleString()}      icon={Clock}       color="text-amber-400"  sub="ต้องดำเนินการ" />
        <StatCard label="คะแนนที่แจกทั้งหมด"  value={stats.totalPointsIssued.toLocaleString()} icon={Star}        color="text-yellow-400" sub="สะสมทุกสมาชิก" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="อนุมัติแล้ว"         value={stats.approvedCount.toLocaleString()}     icon={Award}       color="text-emerald-400" sub="รายการที่ผ่านแล้ว" />
        <StatCard label="รายได้รวม"           value={`฿${stats.totalRevenue.toLocaleString()}`} icon={TrendingUp}  color="text-purple-400"  sub="จากการลงทะเบียน" />
        <StatCard label="GOLD Members"        value={tierBreakdown.find(t=>t.name==='GOLD')?.value.toLocaleString() || '0'} icon={Award} color="text-yellow-400" />
        <StatCard label="PLATINUM Members"    value={tierBreakdown.find(t=>t.name==='PLATINUM')?.value.toLocaleString() || '0'} icon={ShoppingBag} color="text-cyan-400" />
      </div>

      {/* ── Charts Row 1 ── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Monthly Trend */}
        <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">📈 แนวโน้มรายเดือน</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Line type="monotone" dataKey="members"   name="สมาชิกใหม่"     stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="purchases" name="ลงทะเบียน"      stroke="#4ade80" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Tier Pie */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">🏅 สัดส่วน Tier</h2>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={tierBreakdown} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                dataKey="value" nameKey="name" paddingAngle={3}>
                {tierBreakdown.map((entry, i) => (
                  <Cell key={i} fill={TIER_COLORS[entry.name] || '#6b7280'} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1.5">
            {tierBreakdown.map(t => (
              <div key={t.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: TIER_COLORS[t.name] }} />
                  <span className="text-gray-400">{t.name}</span>
                </div>
                <span className="text-white font-semibold">{t.value.toLocaleString()} คน</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Charts Row 2 ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Channel Bar */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">🛒 ยอดลงทะเบียนตามช่องทาง</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={channelBreakdown} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} width={70} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="จำนวน" radius={[0, 6, 6, 0]}>
                {channelBreakdown.map((entry, i) => (
                  <Cell key={i} fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Breakdown */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">📋 สถานะการลงทะเบียน</h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={statusBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="จำนวน" radius={[4, 4, 0, 0]}>
                {statusBreakdown.map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.name] || '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {statusBreakdown.map(s => (
              <div key={s.name} className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[s.name] || '#6b7280' }} />
                <span className="text-gray-400 truncate">{s.name.replace('_', ' ')}</span>
                <span className="text-white font-semibold ml-auto">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Monthly Revenue Bar ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold text-sm mb-4">💰 รายได้รายเดือน (บาท)</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} formatter={(v: number | string) => [`฿${Number(v).toLocaleString()}`, 'รายได้']} />
            <Bar dataKey="revenue" name="รายได้ (฿)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Top Members Table ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800">
          <h2 className="text-white font-semibold text-sm">🏆 Top 10 สมาชิกคะแนนสูงสุด</h2>
          <button onClick={() => exportExcel('members')} disabled={!!exporting}
            className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
            {exporting === 'members'
              ? <><RefreshCw size={12} className="animate-spin" /> กำลัง export...</>
              : <><Download size={12} /> Export รายชื่อทั้งหมด</>}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800/50 border-b border-gray-800">
                {['#','Member ID','ชื่อ','Tier','คะแนนคงเหลือ','สะสมตลอดกาล','จำนวนสินค้า'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs text-gray-400 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topMembers.map((m, i) => (
                <tr key={m.member_id} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors">
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{i + 1}</td>
                  <td className="px-4 py-3 font-mono text-gray-400 text-xs">{m.member_id}</td>
                  <td className="px-4 py-3 text-white font-medium">{m.full_name || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      m.tier === 'PLATINUM' ? 'bg-cyan-900/30 text-cyan-400 border-cyan-800/40' :
                      m.tier === 'GOLD'     ? 'bg-yellow-900/30 text-yellow-400 border-yellow-800/40' :
                                             'bg-gray-800 text-gray-400 border-gray-700'}`}>
                      {m.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-amber-400 font-bold">{m.total_points.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-300">{m.lifetime_points.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center text-gray-300">{m.purchase_count}</td>
                </tr>
              ))}
              {topMembers.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">ยังไม่มีข้อมูล</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}