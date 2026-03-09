import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'
import { ArrowLeft, Package, Star, CheckCircle, XCircle, PlusCircle, Eye } from 'lucide-react'

type AuditDetail = {
  staff_name?: string
  order_sn?: string
  model_name?: string
  admin_note?: string
  delta?: number
  description?: string
  action?: string
  points_reverted?: number
}

type AuditLog = {
  id: string
  action_type: string
  created_at: string
  user_id: string | null
  detail: AuditDetail | null
  user?: { full_name: string | null; member_id: string | null } | null
}

const ACTION_CONFIG: Record<string, {
  label: string; icon: React.ElementType
  bg: string; text: string; border: string; emoji: string
}> = {
  PURCHASE_APPROVED: { label: 'อนุมัติการลงทะเบียน', icon: CheckCircle, bg: 'bg-green-900/20', text: 'text-green-400', border: 'border-green-800/30', emoji: '✅' },
  PURCHASE_REJECTED: { label: 'ปฏิเสธการลงทะเบียน', icon: XCircle,    bg: 'bg-red-900/20',   text: 'text-red-400',   border: 'border-red-800/30',   emoji: '❌' },
  PURCHASE_ADDED:    { label: 'เพิ่มประวัติการซื้อ',  icon: PlusCircle, bg: 'bg-blue-900/20',  text: 'text-blue-400',  border: 'border-blue-800/30',  emoji: '➕' },
  POINTS_ADJUSTED:   { label: 'ปรับแต้ม',             icon: Star,       bg: 'bg-amber-900/20', text: 'text-amber-400', border: 'border-amber-800/30', emoji: '⭐' },
  MEMBER_VIEWED:     { label: 'ดูข้อมูลสมาชิก',       icon: Eye,        bg: 'bg-gray-800',     text: 'text-gray-400',  border: 'border-gray-700',     emoji: '👁' },
}

function getLink(log: AuditLog): { href: string; label: string } | null {
  if (log.action_type === 'PURCHASE_APPROVED' || log.action_type === 'PURCHASE_REJECTED' || log.action_type === 'PURCHASE_ADDED' || log.action_type === 'POINTS_ADJUSTED') {
    if (log.user_id) return { href: `/admin/members/${log.user_id}`, label: 'ดูสมาชิก →' }
  }
  return null
}

export default async function MyActivityPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceSupabase = createServiceClient()
  const { data: staff } = await serviceSupabase
    .from('admin_staff').select('id, name, role').eq('auth_user_id', user!.id).eq('is_active', true).single()
  if (!staff) redirect('/home')

  const { data: logs } = await serviceSupabase
    .from('admin_audit_log')
    .select('*, user:users!user_id(full_name, member_id)')
    .eq('staff_id', staff.id)
    .order('created_at', { ascending: false })
    .limit(200)

  // Summary stats
  const summary = {
    total:    (logs || []).length,
    approved: (logs || []).filter(l => l.action_type === 'PURCHASE_APPROVED').length,
    rejected: (logs || []).filter(l => l.action_type === 'PURCHASE_REJECTED').length,
    added:    (logs || []).filter(l => l.action_type === 'PURCHASE_ADDED').length,
    points:   (logs || []).filter(l => l.action_type === 'POINTS_ADJUSTED').length,
  }

  // Group by date
  const grouped: Record<string, AuditLog[]> = {}
  for (const log of ((logs || []) as AuditLog[])) {
    const date = new Date(log.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    if (!grouped[date]) grouped[date] = []
    grouped[date]!.push(log)
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-white text-xl font-bold">ประวัติการทำงานของฉัน</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            <span className="text-amber-400 font-medium">{staff.name}</span>
            <span className="mx-2">·</span>
            <span className="text-gray-500">{staff.role}</span>
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'ทั้งหมด',       value: summary.total,    color: 'text-white',        bg: 'bg-gray-900 border-gray-800' },
          { label: 'อนุมัติ',       value: summary.approved, color: 'text-green-400',    bg: 'bg-green-900/10 border-green-800/30' },
          { label: 'ปฏิเสธ',       value: summary.rejected, color: 'text-red-400',      bg: 'bg-red-900/10 border-red-800/30' },
          { label: 'ปรับแต้ม',     value: summary.points,   color: 'text-amber-400',    bg: 'bg-amber-900/10 border-amber-800/30' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border rounded-xl p-4 text-center`}>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-gray-500 text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Log list grouped by date */}
      {Object.keys(grouped).length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl py-16 text-center">
          <Package size={36} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">ยังไม่มีประวัติการทำงาน</p>
          <p className="text-gray-600 text-xs mt-1">
            ระบบจะบันทึกเมื่อคุณอนุมัติ ปฏิเสธ หรือปรับแต้มสมาชิก
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, dateLogs]) => (
            <div key={date}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-gray-800" />
                <span className="text-gray-500 text-xs font-medium px-2">{date}</span>
                <div className="h-px flex-1 bg-gray-800" />
              </div>

              <div className="space-y-2">
                {(dateLogs || []).map((log: AuditLog) => {
                  const cfg = ACTION_CONFIG[log.action_type] || ACTION_CONFIG.MEMBER_VIEWED
                  const detail = log.detail
                  const user = log.user
                  const link = getLink(log)

                  return (
                    <div key={log.id}
                      className={`${cfg.bg} border ${cfg.border} rounded-xl p-4 transition-colors hover:brightness-110`}>
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">
                          {cfg.emoji}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm font-semibold ${cfg.text}`}>{cfg.label}</p>
                            <p className="text-gray-600 text-xs flex-shrink-0">
                              {new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>

                          {/* Member info */}
                          {user && (
                            <p className="text-gray-400 text-xs mt-0.5">
                              สมาชิก: <span className="text-gray-300">{user.full_name || '-'}</span>
                              <span className="text-gray-600 mx-1">·</span>
                              <span className="font-mono text-gray-500">{user.member_id}</span>
                            </p>
                          )}

                          {/* Detail */}
                          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                            {detail?.order_sn && <span>Order: <span className="font-mono text-gray-400">{detail.order_sn}</span></span>}
                            {detail?.model_name && <span>สินค้า: <span className="text-gray-400">{detail.model_name}</span></span>}
                            {detail?.admin_note && <span>หมายเหตุ: <span className="text-gray-400 italic">{detail.admin_note}</span></span>}
                            {detail?.delta !== undefined && (
                              <span>
                                แต้ม: <span className={Number(detail.delta) > 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                                  {Number(detail.delta) > 0 ? '+' : ''}{detail.delta}
                                </span>
                              </span>
                            )}
                            {detail?.description && <span>เหตุผล: <span className="text-gray-400">{detail.description}</span></span>}
                            {detail?.action === 'DELETED' && (
                              <span className="text-red-400/70">
                                🗑 ลบรายการแล้ว {detail.points_reverted ? `(หัก ${detail.points_reverted} แต้ม)` : ''}
                              </span>
                            )}
                          </div>

                          {/* Link to member */}
                          {link && (
                            <Link href={link.href}
                              className="inline-flex items-center gap-1 mt-2 text-xs text-amber-400/80 hover:text-amber-400 transition-colors underline underline-offset-2">
                              {link.label}
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}