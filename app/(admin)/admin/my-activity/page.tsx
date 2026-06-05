import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

import Link from 'next/link'
import { Package, Star, CheckCircle, XCircle, PlusCircle, Eye } from 'lucide-react'
import PageShell from '@/components/admin/PageShell'

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
  label: string; icon: React.ElementType; color: string; emoji: string
}> = {
  PURCHASE_APPROVED: { label: 'อนุมัติการลงทะเบียน', icon: CheckCircle, color: '#3A8E5A', emoji: '✅' },
  PURCHASE_REJECTED: { label: 'ปฏิเสธการลงทะเบียน', icon: XCircle,     color: '#B14242', emoji: '❌' },
  PURCHASE_ADDED:    { label: 'เพิ่มประวัติการซื้อ', icon: PlusCircle,  color: '#4A7BC1', emoji: '➕' },
  PURCHASE_EDITED:   { label: 'แก้ไขประวัติการซื้อ', icon: Eye,         color: '#C99B3E', emoji: '✏️' },
  PURCHASE_DELETED:  { label: 'ลบประวัติการซื้อ',    icon: XCircle,     color: '#B14242', emoji: '🗑' },
  POINTS_ADJUSTED:   { label: 'ปรับแต้ม',            icon: Star,        color: '#C99B3E', emoji: '⭐' },
  TIER_OVERRIDDEN:   { label: 'ปรับระดับสมาชิก',     icon: Star,        color: '#8B5CF6', emoji: '🏅' },
  MEMBER_VIEWED:     { label: 'ดูข้อมูลสมาชิก',      icon: Eye,         color: '#6B5A48', emoji: '👁' },
}

function getLink(log: AuditLog): { href: string; label: string } | null {
  if (['PURCHASE_APPROVED','PURCHASE_REJECTED','PURCHASE_ADDED','PURCHASE_DELETED','POINTS_ADJUSTED'].includes(log.action_type)) {
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

  const summary = {
    total:    (logs || []).length,
    approved: (logs || []).filter(l => l.action_type === 'PURCHASE_APPROVED').length,
    rejected: (logs || []).filter(l => l.action_type === 'PURCHASE_REJECTED').length,
    points:   (logs || []).filter(l => l.action_type === 'POINTS_ADJUSTED').length,
  }

  const grouped: Record<string, AuditLog[]> = {}
  for (const log of ((logs || []) as AuditLog[])) {
    const date = new Date(log.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    if (!grouped[date]) grouped[date] = []
    grouped[date]!.push(log)
  }

  return (
    <PageShell
      eyebrow="My Activity"
      title="ประวัติการทำงานของฉัน"
      subtitle={
        <>
          <span style={{ color: 'var(--admin-gold)' }} className="font-medium">{staff.name}</span>
          <span className="mx-2">·</span>
          <span style={{ color: 'var(--admin-ink-faint)' }}>{staff.role}</span>
        </>
      }>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'ทั้งหมด',  value: summary.total,    color: 'var(--admin-ink)' },
          { label: 'อนุมัติ',  value: summary.approved, color: '#3A8E5A' },
          { label: 'ปฏิเสธ',   value: summary.rejected, color: '#B14242' },
          { label: 'ปรับแต้ม', value: summary.points,   color: '#C99B3E' },
        ].map(s => (
          <div key={s.label} className="admin-card p-4 text-center">
            <p className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--admin-ink-mute)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Log list */}
      {Object.keys(grouped).length === 0 ? (
        <div className="admin-card py-16 text-center">
          <Package size={36} className="mx-auto mb-3" style={{ color: 'var(--admin-ink-ghost)' }} />
          <p style={{ color: 'var(--admin-ink-mute)' }}>ยังไม่มีประวัติการทำงาน</p>
          <p className="text-xs mt-1" style={{ color: 'var(--admin-ink-faint)' }}>
            ระบบจะบันทึกเมื่อคุณอนุมัติ ปฏิเสธ หรือปรับแต้มสมาชิก
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, dateLogs]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1" style={{ background: 'var(--admin-border)' }} />
                <span className="text-xs font-medium px-2" style={{ color: 'var(--admin-ink-mute)' }}>{date}</span>
                <div className="h-px flex-1" style={{ background: 'var(--admin-border)' }} />
              </div>

              <div className="space-y-2">
                {(dateLogs || []).map((log: AuditLog) => {
                  const cfg = ACTION_CONFIG[log.action_type] || ACTION_CONFIG.MEMBER_VIEWED
                  const detail = log.detail
                  const u = log.user
                  const link = getLink(log)

                  return (
                    <div key={log.id} className="admin-card p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                          style={{ background: `${cfg.color}1A` }}>
                          {cfg.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold" style={{ color: cfg.color }}>{cfg.label}</p>
                            <p className="text-xs flex-shrink-0" style={{ color: 'var(--admin-ink-faint)' }}>
                              {new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>

                          {u && (
                            <p className="text-xs mt-0.5" style={{ color: 'var(--admin-ink-mute)' }}>
                              สมาชิก: <span style={{ color: 'var(--admin-ink)' }}>{u.full_name || '-'}</span>
                              <span style={{ color: 'var(--admin-ink-faint)' }} className="mx-1">·</span>
                              <span className="font-mono" style={{ color: 'var(--admin-ink-faint)' }}>{u.member_id}</span>
                            </p>
                          )}

                          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs"
                            style={{ color: 'var(--admin-ink-mute)' }}>
                            {detail?.order_sn && <span>Order: <span className="font-mono" style={{ color: 'var(--admin-ink-soft)' }}>{detail.order_sn}</span></span>}
                            {detail?.model_name && <span>สินค้า: <span style={{ color: 'var(--admin-ink-soft)' }}>{detail.model_name}</span></span>}
                            {detail?.admin_note && <span>หมายเหตุ: <span className="italic" style={{ color: 'var(--admin-ink-soft)' }}>{detail.admin_note}</span></span>}
                            {detail?.delta !== undefined && (
                              <span>
                                แต้ม:{' '}
                                <span className="font-semibold" style={{ color: Number(detail.delta) > 0 ? '#3A8E5A' : '#B14242' }}>
                                  {Number(detail.delta) > 0 ? '+' : ''}{detail.delta}
                                </span>
                              </span>
                            )}
                            {detail?.description && <span>เหตุผล: <span style={{ color: 'var(--admin-ink-soft)' }}>{detail.description}</span></span>}
                            {detail?.action === 'DELETED' && (
                              <span style={{ color: '#B14242', opacity: 0.7 }}>
                                🗑 ลบรายการแล้ว {detail.points_reverted ? `(หัก ${detail.points_reverted} แต้ม)` : ''}
                              </span>
                            )}
                          </div>

                          {link && (
                            <Link href={link.href}
                              className="inline-flex items-center gap-1 mt-2 text-xs underline underline-offset-2 transition-colors"
                              style={{ color: 'var(--admin-gold)' }}>
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
    </PageShell>
  )
}
