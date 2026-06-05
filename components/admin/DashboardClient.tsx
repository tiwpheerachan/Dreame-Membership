'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend
} from 'recharts'
import {
  Users, Package, Clock, Star, Download, Award, Sparkles,
  RefreshCw, ChevronDown, ShoppingBag, Coins, Calendar, ArrowUpRight
} from 'lucide-react'
import * as XLSX from 'xlsx'
import PlatformLogo from '@/components/admin/PlatformLogo'

// ─── Types ───────────────────────────────────────────────────
interface DashboardData {
  periodKey: string
  stats: {
    totalMembers: number
    totalPurchases: number
    pendingCount: number
    approvedCount: number
    totalPointsIssued: number
    newMembersInPeriod: number
    newPurchasesInPeriod: number
  }
  tierBreakdown:  { name: string; users: number; points: number }[]
  channelBreakdown: { name: string; value: number }[]
  statusBreakdown: { name: string; value: number }[]
  monthlyTrend:    { month: string; members: number; purchases: number }[]
  topMembers: {
    member_id: string; full_name: string; tier: string
    total_points: number; lifetime_points: number; purchase_count: number
  }[]
}

const PERIODS: { key: string; label: string }[] = [
  { key: '7d',  label: '7 วัน' },
  { key: '30d', label: '30 วัน' },
  { key: '90d', label: '3 เดือน' },
  { key: '6m',  label: '6 เดือน' },
  { key: '1y',  label: '1 ปี' },
  { key: 'all', label: 'ทั้งหมด' },
]

// Brand palette — warm cream/gold tones to match user app
const TIER_COLORS: Record<string, string> = {
  SILVER:   '#94A3B8',
  GOLD:     '#C99B3E',
  PLATINUM: '#1F1F1F',
}
const STATUS_COLORS: Record<string, string> = {
  ADMIN_APPROVED: '#3A8E5A',
  BQ_VERIFIED:    '#4A7BC1',
  PENDING:        '#C99B3E',
  REJECTED:       '#B14242',
}
const CHANNEL_COLORS = ['#C99B3E', '#4A7BC1', '#8B5CF6', '#3A8E5A', '#EC4899', '#F97316']

// ── Reusable card primitives ──
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-[#EDE3D2] rounded-2xl shadow-[0_2px_10px_rgba(154,110,31,0.04)] ${className}`}>
      {children}
    </div>
  )
}

function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  accent: string
}) {
  return (
    <Card className="p-5 hover:shadow-[0_4px_18px_rgba(154,110,31,0.08)] transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[#7A6B5B] text-[11px] uppercase tracking-[0.06em] font-medium mb-1.5">
            {label}
          </p>
          <p className="text-[#1A1A1A] text-2xl font-bold tabular-nums leading-none">
            {value}
          </p>
          {sub && <p className="text-[#A0907A] text-[11px] mt-2">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}14`, color: accent }}>
          <Icon size={18} strokeWidth={1.8} />
        </div>
      </div>
    </Card>
  )
}

const LightTooltip = ({ active, payload, label }: Record<string, unknown>) => {
  if (!active || !payload || !(payload as unknown[]).length) return null
  return (
    <div className="bg-white border border-[#EDE3D2] rounded-xl p-3 text-xs shadow-lg">
      <p className="text-[#3F2A1A] font-semibold mb-1.5">{label as string}</p>
      {(payload as { color: string; name: string; value: number }[]).map((p, i) => (
        <p key={i} className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[#6B5A48]">{p.name}:</span>
          <strong className="text-[#1A1A1A] tabular-nums">
            {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
          </strong>
        </p>
      ))}
    </div>
  )
}

export default function DashboardClient({ data }: { data: DashboardData }) {
  const router = useRouter()
  const params = useSearchParams()
  const [exporting, setExporting] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  const period = data.periodKey
  const periodLabel = PERIODS.find(p => p.key === period)?.label ?? '30 วัน'

  function setPeriod(p: string) {
    const sp = new URLSearchParams(params.toString())
    sp.set('period', p)
    router.push(`?${sp.toString()}`)
  }

  const { stats, tierBreakdown, channelBreakdown, statusBreakdown, monthlyTrend, topMembers } = data

  // ── Excel export (lazy fetch all data) ──
  async function exportExcel(type: 'members' | 'purchases' | 'summary') {
    setExporting(type)
    try {
      const wb = XLSX.utils.book_new()
      if (type === 'members' || type === 'summary') {
        const r = await fetch('/api/admin/export/members')
        const j = r.ok ? await r.json() : { members: [] }
        const rows = (j.members || []).map((m: Record<string, unknown>) => ({
          'Member ID': m.member_id,
          'ชื่อ-นามสกุล': m.full_name || '-',
          'อีเมล': m.email || '-',
          'เบอร์โทร': m.phone || '-',
          'Tier': m.tier,
          'คะแนนคงเหลือ': m.total_points,
          'คะแนนสะสมตลอดกาล': m.lifetime_points,
          'วันที่สมัคร': m.created_at ? new Date(m.created_at as string).toLocaleDateString('th-TH') : '-',
        }))
        const ws = XLSX.utils.json_to_sheet(rows)
        ws['!cols'] = [14, 20, 28, 14, 10, 14, 18, 14].map(w => ({ wch: w }))
        XLSX.utils.book_append_sheet(wb, ws, 'รายชื่อสมาชิก')
      }
      if (type === 'purchases' || type === 'summary') {
        const r = await fetch('/api/admin/export/purchases')
        const j = r.ok ? await r.json() : { purchases: [] }
        const rows = (j.purchases || []).map((p: Record<string, unknown>) => {
          const u = p.users as Record<string, unknown> | null
          return {
            'Order ID': p.order_sn, 'Member ID': u?.member_id || '',
            'ชื่อสมาชิก': u?.full_name || '-', 'ช่องทาง': p.channel, 'สถานะ': p.status,
            'คะแนนที่ได้': p.points_awarded || 0,
            'วันที่ลงทะเบียน': p.created_at ? new Date(p.created_at as string).toLocaleDateString('th-TH') : '-',
          }
        })
        const ws = XLSX.utils.json_to_sheet(rows)
        XLSX.utils.book_append_sheet(wb, ws, 'ประวัติการลงทะเบียน')
      }
      if (type === 'summary') {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
          tierBreakdown.map(t => ({ Tier: t.name, สมาชิก: t.users, คะแนนรวม: t.points }))
        ), 'สรุปตาม Tier')
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
          channelBreakdown.map(c => ({ ช่องทาง: c.name, จำนวน: c.value }))
        ), 'สรุปตามช่องทาง')
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
          monthlyTrend.map(m => ({ เดือน: m.month, สมาชิกใหม่: m.members, ลงทะเบียน: m.purchases }))
        ), 'แนวโน้มรายเดือน')
      }
      const name = type === 'members' ? 'dreame_members' : type === 'purchases' ? 'dreame_purchases' : 'dreame_summary'
      XLSX.writeFile(wb, `${name}_${new Date().toISOString().split('T')[0]}.xlsx`)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#FAF7F2]">

      {/* Sticky header */}
      <header className="border-b flex-shrink-0"
        style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <div className="px-6 lg:px-8 py-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[#A0782B] text-[11px] uppercase tracking-[0.18em] font-medium mb-1">
              Overview
            </p>
            <h1 className="text-[#1A1A1A] text-2xl font-bold leading-tight">
              Dreame Membership <span className="font-light italic text-[#7A6B5B]">Dashboard</span>
            </h1>
            <p className="text-[#7A6B5B] text-sm mt-1">
              ข้อมูลแบบ real-time · ช่วง <span className="font-semibold text-[#3F2A1A]">{periodLabel}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Period selector */}
            <div className="flex items-center bg-white border border-[#EDE3D2] rounded-xl p-1 shadow-sm">
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => setPeriod(p.key)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    p.key === period
                      ? 'bg-[#1F1F1F] text-[#E8C58C] font-semibold'
                      : 'text-[#7A6B5B] hover:text-[#1A1A1A]'
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Export dropdown */}
            <div className="relative">
              <button onClick={() => setExportOpen(!exportOpen)}
                className="flex items-center gap-2 bg-[#1F1F1F] hover:bg-black text-[#E8C58C] font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors shadow-sm">
                <Download size={14} strokeWidth={2} />
                Export
                <ChevronDown size={14} className={`transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
              </button>
              {exportOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
                  <div className="absolute right-0 top-12 z-50 bg-white border border-[#EDE3D2] rounded-xl shadow-xl overflow-hidden w-60">
                    {[
                      { k: 'members',   label: 'รายชื่อสมาชิกทั้งหมด',     sub: `${stats.totalMembers.toLocaleString()} คน` },
                      { k: 'purchases', label: 'ประวัติการลงทะเบียน',     sub: `${stats.totalPurchases.toLocaleString()} รายการ` },
                      { k: 'summary',   label: 'ภาพรวมทั้งหมด',            sub: 'ทุก sheet รวมกัน' },
                    ].map(item => (
                      <button key={item.k}
                        onClick={() => { setExportOpen(false); exportExcel(item.k as 'members' | 'purchases' | 'summary') }}
                        disabled={!!exporting}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#FAF7F2] transition-colors text-left border-b border-[#EDE3D2] last:border-0">
                        <div>
                          <p className="text-[#1A1A1A] text-sm font-medium">{item.label}</p>
                          <p className="text-[#A0907A] text-xs mt-0.5">{item.sub}</p>
                        </div>
                        {exporting === item.k && <RefreshCw size={14} className="text-[#A0782B] animate-spin" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6 space-y-6">

        {/* ─── Stat Cards (Row 1) — clickable where it makes sense ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/admin/members" className="block">
            <StatCard label="สมาชิกทั้งหมด" value={stats.totalMembers.toLocaleString()}
              sub={`+${stats.newMembersInPeriod} ใน ${periodLabel} →`}
              icon={Users} accent="#4A7BC1" />
          </Link>
          <Link href="/admin/members" className="block">
            <StatCard label="สมาชิกใหม่" value={`+${stats.newMembersInPeriod.toLocaleString()}`}
              sub={`ช่วง ${periodLabel} →`}
              icon={Sparkles} accent="#3A8E5A" />
          </Link>
          <StatCard label="คะแนนสะสมทั้งหมด" value={stats.totalPointsIssued.toLocaleString()}
            sub="แจกไปแล้วทุกสมาชิก"
            icon={Coins} accent="#C99B3E" />
          <Link href="/admin/pending" className="block">
            <StatCard label="รออนุมัติ" value={stats.pendingCount.toLocaleString()}
              sub={`อนุมัติแล้ว ${stats.approvedCount.toLocaleString()} →`}
              icon={Clock} accent="#B14242" />
          </Link>
        </div>

        {/* ─── Tier Cards (User + Point per Tier) — clickable → filtered members ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {tierBreakdown.map(t => {
            const color = TIER_COLORS[t.name] || '#94A3B8'
            const totalUsers = tierBreakdown.reduce((s, x) => s + x.users, 0)
            const pct = totalUsers ? (t.users / totalUsers * 100) : 0
            return (
              <Link key={t.name} href={`/admin/members?tier=${t.name}`}>
                <Card className="p-5 cursor-pointer">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-8 rounded-full" style={{ background: color }} />
                      <h3 className="text-[#1A1A1A] font-bold text-sm tracking-wide">{t.name}</h3>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium px-2 py-1 rounded-full"
                        style={{ background: `${color}1A`, color }}>
                        {pct.toFixed(1)}%
                      </span>
                      <ArrowUpRight size={12} className="text-[#A0907A]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[#A0907A] text-[10px] uppercase tracking-wider mb-1">Users</p>
                      <p className="text-[#1A1A1A] text-xl font-bold tabular-nums">
                        {t.users.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#A0907A] text-[10px] uppercase tracking-wider mb-1">Points</p>
                      <p className="text-[#1A1A1A] text-xl font-bold tabular-nums">
                        {t.points.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 h-1 rounded-full bg-[#F3EBDB] overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: color }} />
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>

        {/* ─── Charts Row: Trend + Tier Pie ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Monthly trend */}
          <Card className="lg:col-span-2 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[#1A1A1A] font-semibold text-sm flex items-center gap-2">
                <Calendar size={15} className="text-[#A0782B]" />
                แนวโน้มรายเดือน (6 เดือนล่าสุด)
              </h2>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0E6D4" />
                <XAxis dataKey="month" tick={{ fill: '#7A6B5B', fontSize: 11 }} axisLine={{ stroke: '#EDE3D2' }} />
                <YAxis tick={{ fill: '#7A6B5B', fontSize: 11 }} axisLine={{ stroke: '#EDE3D2' }} />
                <Tooltip content={<LightTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#6B5A48' }} />
                <Line type="monotone" dataKey="members" name="สมาชิกใหม่" stroke="#4A7BC1" strokeWidth={2.5} dot={{ r: 3, fill: '#4A7BC1' }} />
                <Line type="monotone" dataKey="purchases" name="ลงทะเบียน" stroke="#C99B3E" strokeWidth={2.5} dot={{ r: 3, fill: '#C99B3E' }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Tier ratio pie */}
          <Card className="p-5">
            <h2 className="text-[#1A1A1A] font-semibold text-sm mb-4 flex items-center gap-2">
              <Award size={15} className="text-[#A0782B]" />
              สัดส่วน Tier
            </h2>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={tierBreakdown} cx="50%" cy="50%" innerRadius={42} outerRadius={68}
                  dataKey="users" nameKey="name" paddingAngle={3}>
                  {tierBreakdown.map((entry, i) => (
                    <Cell key={i} fill={TIER_COLORS[entry.name] || '#94A3B8'} />
                  ))}
                </Pie>
                <Tooltip content={<LightTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-2">
              {tierBreakdown.map(t => (
                <div key={t.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: TIER_COLORS[t.name] }} />
                    <span className="text-[#6B5A48]">{t.name}</span>
                  </div>
                  <span className="text-[#1A1A1A] font-semibold tabular-nums">{t.users.toLocaleString()} คน</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ─── Charts Row: Channel + Status ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[#1A1A1A] font-semibold text-sm flex items-center gap-2">
                <ShoppingBag size={15} className="text-[#A0782B]" />
                ลงทะเบียนตามช่องทาง
              </h2>
              <Link href="/admin/purchases" className="text-xs text-[#A0782B] hover:text-[#3F2A1A] flex items-center gap-1">
                ดูทั้งหมด <ArrowUpRight size={11} />
              </Link>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={channelBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#F0E6D4" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#7A6B5B', fontSize: 11 }} axisLine={{ stroke: '#EDE3D2' }} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#3F2A1A', fontSize: 12 }} width={78} axisLine={{ stroke: '#EDE3D2' }} />
                <Tooltip content={<LightTooltip />} />
                <Bar dataKey="value" name="จำนวน" radius={[0, 8, 8, 0]}>
                  {channelBreakdown.map((entry, i) => (
                    <Cell key={i} fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* Quick filter links with real brand logos */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {channelBreakdown.slice(0, 6).map(c => (
                <Link key={c.name} href={`/admin/purchases?channel=${c.name}`}
                  className="text-[11px] px-2 py-1 rounded-full font-medium transition-colors flex items-center gap-1.5 hover:opacity-80"
                  style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-ink-soft)' }}>
                  <PlatformLogo channel={c.name} size={14} />
                  {c.name} <span style={{ color: 'var(--admin-ink-faint)' }}>({c.value})</span>
                </Link>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[#1A1A1A] font-semibold text-sm flex items-center gap-2">
                <Package size={15} className="text-[#A0782B]" />
                สถานะการลงทะเบียน
              </h2>
              <Link href="/admin/pending" className="text-xs text-[#A0782B] hover:text-[#3F2A1A] flex items-center gap-1">
                จัดการ <ArrowUpRight size={11} />
              </Link>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={statusBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0E6D4" />
                <XAxis dataKey="name" tick={{ fill: '#3F2A1A', fontSize: 10 }} axisLine={{ stroke: '#EDE3D2' }} />
                <YAxis tick={{ fill: '#7A6B5B', fontSize: 11 }} axisLine={{ stroke: '#EDE3D2' }} />
                <Tooltip content={<LightTooltip />} />
                <Bar dataKey="value" name="จำนวน" radius={[6, 6, 0, 0]}>
                  {statusBreakdown.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.name] || '#94A3B8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {statusBreakdown.map(s => (
                <Link key={s.name} href={`/admin/purchases?status=${s.name}`}
                  className="flex items-center gap-2 text-xs rounded-lg px-2 py-1 transition-colors hover:bg-[#FAF7F2]">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[s.name] || '#94A3B8' }} />
                  <span className="text-[#6B5A48] truncate">{s.name.replace('_', ' ')}</span>
                  <span className="text-[#1A1A1A] font-semibold ml-auto tabular-nums">{s.value}</span>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        {/* ─── Top Members Table ─── */}
        <Card>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#EDE3D2]">
            <h2 className="text-[#1A1A1A] font-semibold text-sm flex items-center gap-2">
              <Star size={15} className="text-[#A0782B]" />
              Top 10 สมาชิกคะแนนสูงสุด
            </h2>
            <button onClick={() => exportExcel('members')} disabled={!!exporting}
              className="flex items-center gap-1.5 text-xs text-[#A0782B] hover:text-[#3F2A1A] transition-colors font-medium">
              {exporting === 'members'
                ? <><RefreshCw size={12} className="animate-spin" /> กำลัง export…</>
                : <><Download size={12} /> Export รายชื่อทั้งหมด</>}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#FAF7F2] border-b border-[#EDE3D2]">
                  {['#', 'Member ID', 'ชื่อ', 'Tier', 'คะแนนคงเหลือ', 'สะสมตลอดกาล', 'จำนวนสินค้า'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] text-[#6B5A48] uppercase tracking-wider font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topMembers.map((m, i) => (
                  <tr key={m.member_id} className="border-b border-[#F3EBDB] last:border-0 hover:bg-[#FAF7F2] transition-colors">
                    <td className="px-4 py-3 text-[#A0907A] font-mono text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-mono text-[#6B5A48] text-xs">{m.member_id}</td>
                    <td className="px-4 py-3 text-[#1A1A1A] font-medium">{m.full_name || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{
                          background: `${TIER_COLORS[m.tier] || '#94A3B8'}1A`,
                          color: TIER_COLORS[m.tier] || '#94A3B8',
                        }}>
                        {m.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#A0782B] font-bold tabular-nums">{m.total_points.toLocaleString()}</td>
                    <td className="px-4 py-3 text-[#3F2A1A] tabular-nums">{m.lifetime_points.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center text-[#3F2A1A] tabular-nums">{m.purchase_count}</td>
                  </tr>
                ))}
                {topMembers.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-[#A0907A]">ยังไม่มีข้อมูล</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

      </div>
    </div>
  )
}
