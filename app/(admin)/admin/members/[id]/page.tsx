// ============================================================
// Member detail — CRM pattern (Attio / Linear / Stripe inspired)
//   • Slim breadcrumb
//   • Hero strip (avatar + name + tier + actions)
//   • Two-column: dense Properties sidebar (sticky) + Tabbed content
//   • Tabs URL-driven (?tab=overview|purchases|coupons|audit)
// ============================================================

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logAdminAction } from '@/lib/audit'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Phone, Mail, Award, Star, Shield,
  TrendingUp, Ticket, ShoppingBag, Activity as ActivityIcon,
  Calendar, Sparkles, CheckCircle, AlertCircle, XCircle,
  ExternalLink, FileText, CreditCard, ChevronRight, Clock,
} from 'lucide-react'
import { formatDate, formatDateTime, warrantyDaysLeft } from '@/lib/utils'
import AdjustPointsForm from '@/components/admin/AdjustPointsForm'
import MemberAccountActions from '@/components/admin/MemberAccountActions'
import MemberTags from '@/components/admin/MemberTags'
import MemberNotes from '@/components/admin/MemberNotes'
import ApprovePurchaseButtons from '@/components/admin/ApprovePurchaseButtons'
import AddPurchaseForm from '@/components/admin/AddPurchaseForm'
import DeletePurchaseButton from '@/components/admin/DeletePurchaseButton'
import TierOverrideButton from '@/components/admin/TierOverrideButton'
import MemberAvatar from '@/components/admin/MemberAvatar'
import PlatformLogo from '@/components/admin/PlatformLogo'
import ProductThumb from '@/components/admin/ProductThumb'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Purchase = {
  id: string; order_sn: string; model_name: string | null; channel: string
  total_amount: number; serial_number: string | null; sku: string | null
  purchase_date: string | null; points_awarded: number; warranty_end: string | null
  receipt_image_url: string | null; admin_note: string | null; status: string
  approved_by: string | null; approved_at: string | null; user_id: string; created_at: string
  bq_raw_data: Record<string, unknown> | null
}
type PointsLog = {
  id: string; description: string | null; created_at: string
  points_delta: number; balance_after: number; adjusted_by: string | null
}
type Coupon = {
  id: string; code: string; title: string | null
  discount_type: string; discount_value: number
  min_purchase: number | null; valid_until: string
  used_at: string | null; auto_issue_key: string | null
  created_at: string
  apply_url?: string | null
  shopify_price_rule_id?: number | null
  status?: 'active' | 'paused' | 'archived' | 'draft' | null
}
type AuditLogRow = {
  id: string; action_type: string; created_at: string
  detail: Record<string, unknown> | null
  staff?: { name: string | null; role: string } | { name: string | null; role: string }[] | null
}

const TIER_THEME: Record<string, { name: string; pill: string; color: string }> = {
  PLATINUM: { name: 'Platinum', pill: 'admin-pill admin-pill-ink',  color: '#1F1F1F' },
  GOLD:     { name: 'Gold',     pill: 'admin-pill admin-pill-gold', color: '#C99B3E' },
  SILVER:   { name: 'Silver',   pill: 'admin-pill',                  color: '#94A3B8' },
}

const ACTION_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PURCHASE_APPROVED: { label: 'อนุมัติการซื้อ',     color: '#3A8E5A', icon: <CheckCircle size={12} /> },
  PURCHASE_REJECTED: { label: 'ปฏิเสธการซื้อ',      color: '#B14242', icon: <XCircle size={12} /> },
  PURCHASE_ADDED:    { label: 'เพิ่มประวัติการซื้อ', color: '#4A7BC1', icon: <ShoppingBag size={12} /> },
  PURCHASE_DELETED:  { label: 'ลบประวัติการซื้อ',    color: '#B14242', icon: <XCircle size={12} /> },
  PURCHASE_EDITED:   { label: 'แก้ไขประวัติ',        color: '#C99B3E', icon: <FileText size={12} /> },
  PURCHASE_BQ_RECHECKED: { label: 'Re-check BQ',    color: '#4A7BC1', icon: <ActivityIcon size={12} /> },
  POINTS_ADJUSTED:   { label: 'ปรับแต้ม',            color: '#C99B3E', icon: <Star size={12} /> },
  TIER_OVERRIDDEN:   { label: 'ปรับระดับสมาชิก',     color: '#8B5CF6', icon: <Award size={12} /> },
  COUPON_SHOPIFY_BATCH_CREATED: { label: 'สร้าง Shopify batch', color: '#5E8E3E', icon: <Ticket size={12} /> },
  COUPON_SHOPIFY_REDEEMED:      { label: 'ใช้คูปอง Shopify',    color: '#5E8E3E', icon: <Ticket size={12} /> },
  MEMBER_VIEWED:     { label: 'ดูข้อมูล',            color: '#6B5A48', icon: <ActivityIcon size={12} /> },
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    ADMIN_APPROVED: { label: 'อนุมัติแล้ว', cls: 'admin-pill admin-pill-green' },
    BQ_VERIFIED:    { label: 'ยืนยันแล้ว',  cls: 'admin-pill admin-pill-green' },
    PENDING:        { label: 'รอตรวจ',      cls: 'admin-pill admin-pill-amber' },
    REJECTED:       { label: 'ปฏิเสธ',      cls: 'admin-pill admin-pill-red'   },
  }
  const c = cfg[status] || cfg.PENDING
  return <span className={c.cls}>{c.label}</span>
}

const TABS = [
  { key: 'overview',  label: 'ภาพรวม',     icon: ActivityIcon },
  { key: 'purchases', label: 'การซื้อ',     icon: ShoppingBag },
  { key: 'coupons',   label: 'คูปอง',       icon: Ticket },
  { key: 'points',    label: 'คะแนน',       icon: Star },
  { key: 'audit',     label: 'Audit',       icon: Shield },
] as const

type TabKey = typeof TABS[number]['key']

export default async function MemberDetailPage({
  params, searchParams,
}: {
  params: { id: string }
  searchParams?: { tab?: string }
}) {
  const tab: TabKey = (TABS.find(t => t.key === searchParams?.tab)?.key ?? 'overview') as TabKey
  const supabase = createServiceClient()

  const [
    { data: user },
    { data: purchases },
    { data: pointsLog },
    { data: staffList },
    { data: coupons },
    { data: auditRows },
  ] = await Promise.all([
    supabase.from('users').select('*').eq('id', params.id).single(),
    supabase.from('purchase_registrations').select('*').eq('user_id', params.id).order('created_at', { ascending: false }),
    supabase.from('points_log').select('*').eq('user_id', params.id).order('created_at', { ascending: false }).limit(50),
    supabase.from('admin_staff').select('id, name, role'),
    supabase.from('coupons').select('*').eq('user_id', params.id).order('created_at', { ascending: false }).limit(50),
    supabase.from('admin_audit_log')
      .select('id, action_type, created_at, detail, staff:admin_staff!staff_id(name, role)')
      .eq('user_id', params.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (!user) notFound()

  // Audit "viewed" (fire-and-forget) + capture the viewing admin's role so we
  // can gate the sensitive account actions (password / login-link) to SUPER_ADMIN.
  let currentStaffRole: string | null = null
  try {
    const auth = createClient()
    const { data: { user: authUser } } = await auth.auth.getUser()
    if (authUser) {
      const { data: staff } = await supabase.from('admin_staff')
        .select('id, name, role').eq('auth_user_id', authUser.id).eq('is_active', true).single()
      if (staff) {
        currentStaffRole = staff.role
        await logAdminAction({
          staffId: staff.id, action: 'MEMBER_VIEWED', targetType: 'user',
          targetId: user.id, userId: user.id,
          detail: { staff_name: staff.name, member_id: user.member_id },
        })
      }
    }
  } catch {/* don't break render */}
  const isSuperAdmin = currentStaffRole === 'SUPER_ADMIN'

  const staffMap: Record<string, string> = Object.fromEntries(
    (staffList || []).map((s: { id: string; name: string }) => [s.id, s.name])
  )

  const tierInfo = TIER_THEME[user.tier as keyof typeof TIER_THEME] || TIER_THEME.SILVER
  const purchaseList = (purchases || []) as Purchase[]
  const pointsList   = (pointsLog || []) as PointsLog[]
  const couponList   = (coupons || []) as Coupon[]
  const auditList    = (auditRows || []) as AuditLogRow[]

  const approved = purchaseList.filter(p => p.status === 'ADMIN_APPROVED' || p.status === 'BQ_VERIFIED').length
  const pending  = purchaseList.filter(p => p.status === 'PENDING').length
  const today    = new Date().toISOString().split('T')[0]
  // archived = แลกคืนเอง / admin paused → ไม่ใช่ active แล้ว
  const isVisible = (c: Coupon) => !c.status || c.status === 'active'
  const activeCoupons  = couponList.filter(c => isVisible(c) && !c.used_at && c.valid_until >= today)
  const usedCoupons    = couponList.filter(c => c.used_at)
  const expiredCoupons = couponList.filter(c => isVisible(c) && !c.used_at && c.valid_until < today)
  const archivedCoupons = couponList.filter(c => c.status === 'archived')

  const tierProgress = user.tier === 'SILVER' ? { label: 'Gold', max: 80 }
    : user.tier === 'GOLD' ? { label: 'Platinum', max: 400 } : null

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--admin-bg)' }}>

      {/* ── Slim breadcrumb (sticky) ── */}
      <div className="border-b flex-shrink-0"
        style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <div className="px-6 lg:px-8 h-11 flex items-center gap-2 text-sm">
          <Link href="/admin/members"
            className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
            style={{ color: 'var(--admin-ink-mute)' }}>
            <ArrowLeft size={14} /> สมาชิก
          </Link>
          <ChevronRight size={12} style={{ color: 'var(--admin-ink-faint)' }} />
          <span className="font-medium truncate" style={{ color: 'var(--admin-ink)' }}>
            {user.full_name || 'สมาชิก'}
          </span>
        </div>
      </div>

      {/* ── Hero strip (sticky) ── */}
      <div className="border-b flex-shrink-0"
        style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <div className="px-6 lg:px-8 py-5">
          <div className="flex items-start gap-5">
            <MemberAvatar name={user.full_name} src={user.profile_image_url} tier={user.tier} size={72} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-2xl font-bold leading-tight" style={{ color: 'var(--admin-ink)' }}>
                  {user.full_name || 'สมาชิก'}
                </h1>
                <span className={tierInfo.pill} style={{ marginLeft: 4 }}>
                  {user.tier === 'PLATINUM' ? <Award size={11} /> : user.tier === 'GOLD' ? <Star size={11} /> : <Shield size={11} />}
                  {tierInfo.name}
                </span>
                {user.is_vip && <span className="admin-pill admin-pill-gold">VIP</span>}
                {user.is_blacklisted && <span className="admin-pill admin-pill-red">Blacklisted</span>}
              </div>
              <p className="text-xs font-mono mb-3" style={{ color: 'var(--admin-ink-faint)' }}>
                {user.member_id}
              </p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs"
                style={{ color: 'var(--admin-ink-mute)' }}>
                {user.phone && <span className="flex items-center gap-1.5"><Phone size={11} /> {user.phone}</span>}
                {user.email && <span className="flex items-center gap-1.5"><Mail size={11} /> {user.email}</span>}
                <span className="flex items-center gap-1.5">
                  <Calendar size={11} /> สมัคร {formatDate(user.created_at)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <TierOverrideButton userId={user.id} currentTier={user.tier} />
              <AddPurchaseForm userId={user.id} userName={user.full_name || 'สมาชิก'} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Main: full-width 2-pane with independent scroll ── */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[320px_1fr]">

        {/* ─── LEFT: Properties panel (independent scroll) ─── */}
        <aside className="space-y-5 px-5 py-5 overflow-y-auto border-r"
          style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>

          {/* Key metrics */}
          <div className="admin-card">
            <PropHeader>คะแนน</PropHeader>
            <div className="grid grid-cols-2 divide-x" style={{ borderColor: 'var(--admin-border-2)' }}>
              <Stat value={user.total_points.toLocaleString()} label="คงเหลือ" accent="#A0782B" />
              <Stat value={user.lifetime_points.toLocaleString()} label="สะสมตลอดกาล" />
            </div>
            {tierProgress && (
              <div className="px-4 py-3" style={{ borderTop: '1px solid var(--admin-border-2)', background: 'var(--admin-bg)' }}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--admin-ink-mute)' }}>
                    <TrendingUp size={10} /> สู่ระดับ {tierProgress.label}
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--admin-gold)' }}>
                    {Math.min(user.lifetime_points, tierProgress.max).toLocaleString()} / {tierProgress.max}
                  </span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--admin-border)' }}>
                  <div className="h-full transition-all" style={{
                    width: `${Math.min(100, (user.lifetime_points / tierProgress.max) * 100)}%`,
                    background: 'linear-gradient(90deg, #C99B3E, #A0782B)',
                  }} />
                </div>
              </div>
            )}
            <div className="px-4 py-3" style={{ borderTop: '1px solid var(--admin-border-2)' }}>
              <AdjustPointsForm userId={user.id} currentPoints={user.total_points} />
            </div>
          </div>

          {/* Quick stats list */}
          <div className="admin-card">
            <PropHeader>สถิติ</PropHeader>
            <PropRow label="การซื้อทั้งหมด" value={purchaseList.length} />
            <PropRow label="ยืนยันแล้ว" value={approved} color="#3A8E5A" />
            <PropRow label="รอตรวจสอบ" value={pending} color={pending > 0 ? '#C99B3E' : undefined} />
            <PropRow label="คูปองพร้อมใช้" value={activeCoupons.length} color={activeCoupons.length > 0 ? '#3A8E5A' : undefined} />
            <PropRow label="คูปองใช้แล้ว" value={usedCoupons.length} />
            <PropRow label="คูปองหมดอายุ" value={expiredCoupons.length} />
          </div>

          {/* Contact / account — view + edit + (super-admin) password & login link */}
          <MemberAccountActions
            userId={user.id}
            isSuperAdmin={isSuperAdmin}
            initial={{
              full_name: user.full_name ?? null,
              email: user.email ?? null,
              phone: user.phone ?? null,
              address: user.address ?? null,
              date_of_birth: user.date_of_birth ?? null,
            }}
          />

          {/* Tags & flags */}
          <div className="admin-card p-4">
            <PropHeader bare>Tags &amp; Flags</PropHeader>
            <MemberTags
              userId={user.id}
              initialTags={(user.tags as string[]) || []}
              initialVip={!!user.is_vip}
              initialBlacklisted={!!user.is_blacklisted} />
          </div>

          {/* Notes */}
          <div className="admin-card p-4">
            <PropHeader bare>โน้ตภายใน</PropHeader>
            <MemberNotes userId={user.id} />
          </div>
        </aside>

        {/* ─── RIGHT: Tabs (sticky) + tab content (scroll) ─── */}
        <main className="min-w-0 flex flex-col h-full overflow-hidden">
          {/* Tab nav — sticky inside main */}
          <div className="flex items-center gap-1 px-5 lg:px-6 overflow-x-auto flex-shrink-0"
            style={{ borderBottom: '1px solid var(--admin-border)', background: 'var(--admin-card)' }}>
            {TABS.map(t => {
              const active = tab === t.key
              const count = t.key === 'purchases' ? purchaseList.length
                          : t.key === 'coupons'   ? couponList.length
                          : t.key === 'points'    ? pointsList.length
                          : t.key === 'audit'     ? auditList.length
                          : undefined
              return (
                <Link key={t.key}
                  href={`/admin/members/${user.id}${t.key === 'overview' ? '' : '?tab=' + t.key}`}
                  className="flex items-center gap-1.5 px-3 py-3.5 text-sm font-medium transition-colors relative whitespace-nowrap"
                  style={{
                    color: active ? 'var(--admin-ink)' : 'var(--admin-ink-mute)',
                  }}>
                  <t.icon size={14} />
                  {t.label}
                  {count !== undefined && count > 0 && (
                    <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: active ? 'var(--admin-gold)' : 'var(--admin-border)',
                        color: active ? '#fff' : 'var(--admin-ink-mute)',
                      }}>
                      {count}
                    </span>
                  )}
                  {active && (
                    <span className="absolute left-0 right-0 bottom-[-1px] h-[2px]"
                      style={{ background: 'var(--admin-ink)' }} />
                  )}
                </Link>
              )
            })}
          </div>

          {/* Tab content — scrollable */}
          <div className="flex-1 overflow-y-auto px-5 lg:px-6 py-5">
          {tab === 'overview' && (
            <OverviewTab
              user={user}
              purchaseList={purchaseList}
              pointsList={pointsList}
              couponList={couponList}
              auditList={auditList}
              staffMap={staffMap}
              today={today}
            />
          )}
          {tab === 'purchases' && (
            <PurchasesTab purchaseList={purchaseList} staffMap={staffMap} />
          )}
          {tab === 'coupons' && (
            <CouponsTab couponList={couponList} today={today} userId={user.id} />
          )}
          {tab === 'points' && (
            <PointsTab pointsList={pointsList} staffMap={staffMap} />
          )}
          {tab === 'audit' && (
            <AuditTab auditList={auditList} userId={user.id} />
          )}
          </div>
        </main>
      </div>
    </div>
  )
}

// ============================================================
// Sub-components
// ============================================================

function PropHeader({ children, bare }: { children: React.ReactNode; bare?: boolean }) {
  return (
    <div className={bare ? 'mb-3' : 'px-4 pt-3 pb-2'}>
      <p className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--admin-ink-mute)' }}>{children}</p>
    </div>
  )
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <div className="p-3 text-center">
      <p className="text-xl font-bold tabular-nums leading-none"
        style={{ color: accent || 'var(--admin-ink)' }}>{value}</p>
      <p className="text-[10px] mt-1.5 font-medium" style={{ color: 'var(--admin-ink-mute)' }}>{label}</p>
    </div>
  )
}

function PropRow({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="px-4 py-2.5 flex items-center justify-between"
      style={{ borderTop: '1px solid var(--admin-border-2)' }}>
      <span className="text-xs" style={{ color: 'var(--admin-ink-mute)' }}>{label}</span>
      <span className="text-sm font-semibold tabular-nums"
        style={{ color: color || 'var(--admin-ink)' }}>{value}</span>
    </div>
  )
}

function EmptyState({ icon: Icon, title, hint }: { icon: React.ElementType; title: string; hint?: string }) {
  return (
    <div className="admin-card py-16 px-6 text-center">
      <Icon size={28} className="mx-auto mb-3" style={{ color: 'var(--admin-ink-ghost)' }} />
      <p className="text-sm font-medium" style={{ color: 'var(--admin-ink-mute)' }}>{title}</p>
      {hint && <p className="text-xs mt-1" style={{ color: 'var(--admin-ink-faint)' }}>{hint}</p>}
    </div>
  )
}

// ─── Overview tab: timeline of recent activity ───
function OverviewTab({
  user, purchaseList, pointsList, couponList, auditList, staffMap, today,
}: {
  user: Record<string, unknown>
  purchaseList: Purchase[]; pointsList: PointsLog[]; couponList: Coupon[]
  auditList: AuditLogRow[]; staffMap: Record<string, string>; today: string
}) {
  // Build unified timeline (most recent 12 items across all sources)
  type Event = { ts: string; kind: string; node: React.ReactNode }
  const events: Event[] = []

  for (const p of purchaseList.slice(0, 8)) {
    events.push({
      ts: p.created_at, kind: 'purchase',
      node: (
        <div key={`p-${p.id}`} className="flex gap-3 py-3"
          style={{ borderBottom: '1px solid var(--admin-border-2)' }}>
          <ProductThumb bqRaw={p.bq_raw_data} channel={p.channel} size={48} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--admin-ink)' }}>
                  {p.model_name || `Order ${p.order_sn}`}
                </p>
                <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--admin-ink-faint)' }}>
                  {p.order_sn}
                </p>
              </div>
              <StatusBadge status={p.status} />
            </div>
            <p className="text-[10px] mt-1" style={{ color: 'var(--admin-ink-faint)' }}>
              {formatDateTime(p.created_at)}
            </p>
          </div>
        </div>
      ),
    })
  }
  for (const log of pointsList.slice(0, 8)) {
    events.push({
      ts: log.created_at, kind: 'points',
      node: (
        <TimelineRow key={`pt-${log.id}`} ts={log.created_at} dotColor={log.points_delta > 0 ? '#3A8E5A' : '#B14242'}
          icon={<Star size={14} style={{ color: log.points_delta > 0 ? '#3A8E5A' : '#B14242' }} />}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm" style={{ color: 'var(--admin-ink)' }}>
                {log.description || 'ปรับแต้ม'}
              </p>
              <p className="text-[11px]" style={{ color: 'var(--admin-ink-faint)' }}>
                {log.adjusted_by && staffMap[log.adjusted_by] ? `โดย ${staffMap[log.adjusted_by]}` : 'ระบบ'}
                {' · คงเหลือ '}{log.balance_after.toLocaleString()}
              </p>
            </div>
            <span className="text-sm font-bold tabular-nums whitespace-nowrap"
              style={{ color: log.points_delta > 0 ? '#3A8E5A' : '#B14242' }}>
              {log.points_delta > 0 ? '+' : ''}{log.points_delta.toLocaleString()}
            </span>
          </div>
        </TimelineRow>
      ),
    })
  }
  for (const a of auditList.slice(0, 6)) {
    if (a.action_type === 'MEMBER_VIEWED') continue // de-noise
    const meta = ACTION_META[a.action_type] || { label: a.action_type, color: '#6B5A48', icon: <ActivityIcon size={12} /> }
    const staff = Array.isArray(a.staff) ? a.staff[0] : a.staff
    events.push({
      ts: a.created_at, kind: 'audit',
      node: (
        <TimelineRow key={`a-${a.id}`} ts={a.created_at} dotColor={meta.color} icon={meta.icon}>
          <p className="text-sm" style={{ color: 'var(--admin-ink)' }}>
            {meta.label}
            {staff?.name && <span style={{ color: 'var(--admin-ink-faint)' }}> โดย {staff.name}</span>}
          </p>
        </TimelineRow>
      ),
    })
  }

  events.sort((a, b) => (a.ts > b.ts ? -1 : 1))
  const recent = events.slice(0, 15)

  return (
    <div className="space-y-5">
      {/* Highlight cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <HighlightCard
          icon={<ShoppingBag size={14} />}
          label="ซื้อล่าสุด"
          value={purchaseList[0] ? formatDate(purchaseList[0].created_at) : '—'}
          sub={purchaseList[0]?.model_name || 'ยังไม่มี'} />
        {(() => {
          const isVisible = (c: Coupon) => !c.status || c.status === 'active'
          const activeC   = couponList.filter(c => isVisible(c) && !c.used_at && c.valid_until >= today)
          const archivedC = couponList.filter(c => c.status === 'archived')
          return (
            <HighlightCard
              icon={<Ticket size={14} />}
              label="คูปองพร้อมใช้"
              value={activeC.length.toString()}
              sub={archivedC.length > 0
                ? `${couponList.length - archivedC.length} ปัจจุบัน · ${archivedC.length} แลกคืน`
                : `จากทั้งหมด ${couponList.length}`} />
          )
        })()}
        <HighlightCard
          icon={<Sparkles size={14} />}
          label="คะแนนที่ได้รับ"
          value={pointsList.filter(p => p.points_delta > 0).reduce((s, p) => s + p.points_delta, 0).toLocaleString()}
          sub="ตลอดอายุสมาชิก" />
      </div>

      {/* Activity feed */}
      <div className="admin-card">
        <div className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--admin-border-2)' }}>
          <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--admin-ink)' }}>
            <ActivityIcon size={14} style={{ color: 'var(--admin-gold)' }} />
            กิจกรรมล่าสุด
          </h2>
          <p className="text-xs" style={{ color: 'var(--admin-ink-faint)' }}>{recent.length} รายการ</p>
        </div>
        {recent.length === 0
          ? <div className="py-12 text-center text-sm" style={{ color: 'var(--admin-ink-mute)' }}>ยังไม่มีกิจกรรม</div>
          : <div className="px-5 py-2">{recent.map(e => e.node)}</div>}
      </div>
    </div>
  )
}

function HighlightCard({ icon, label, value, sub }: {
  icon: React.ReactNode; label: string; value: string; sub?: string
}) {
  return (
    <div className="admin-card p-4">
      <div className="flex items-center gap-2 mb-2 text-xs"
        style={{ color: 'var(--admin-ink-mute)' }}>
        {icon} {label}
      </div>
      <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--admin-ink)' }}>{value}</p>
      {sub && <p className="text-[11px] mt-1 truncate" style={{ color: 'var(--admin-ink-faint)' }}>{sub}</p>}
    </div>
  )
}

function TimelineRow({ ts, dotColor, icon, children }: {
  ts: string; dotColor: string; icon: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="flex gap-3 py-3 relative"
      style={{ borderBottom: '1px solid var(--admin-border-2)' }}>
      <div className="flex-shrink-0 mt-0.5">
        <div className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: `${dotColor}1A`, color: dotColor }}>
          {icon}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        {children}
        <p className="text-[10px] mt-1" style={{ color: 'var(--admin-ink-faint)' }}>
          {formatDateTime(ts)}
        </p>
      </div>
    </div>
  )
}

// ─── Purchases tab ───
function PurchasesTab({ purchaseList, staffMap }: { purchaseList: Purchase[]; staffMap: Record<string, string> }) {
  if (purchaseList.length === 0) {
    return <EmptyState icon={ShoppingBag} title="ยังไม่มีประวัติการซื้อ"
      hint="กด 'เพิ่มประวัติการซื้อ' ที่หัวหน้าเพื่อสร้าง" />
  }
  return (
    <div className="admin-card overflow-hidden">
      {purchaseList.map((p, i) => {
        const daysLeft = warrantyDaysLeft(p.warranty_end ?? '')
        const warrantyOk = daysLeft > 0
        return (
          <div key={p.id} className="px-5 py-4"
            style={{ borderBottom: i < purchaseList.length - 1 ? '1px solid var(--admin-border-2)' : undefined }}>
            <div className="flex items-start gap-3">
              <ProductThumb bqRaw={p.bq_raw_data} channel={p.channel} size={56} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--admin-ink)' }}>
                      {p.model_name || `Order ${p.order_sn}`}
                    </p>
                    <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--admin-ink-faint)' }}>
                      {p.order_sn}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={p.status} />
                    <DeletePurchaseButton purchaseId={p.id} orderSn={p.order_sn}
                      modelName={p.model_name ?? undefined} pointsAwarded={p.points_awarded} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {p.total_amount > 0 && <Chip><CreditCard size={10} /> ฿{p.total_amount.toLocaleString()}</Chip>}
                  {p.serial_number && <Chip><FileText size={10} /> S/N: {p.serial_number}</Chip>}
                  {p.purchase_date && <Chip><Calendar size={10} /> {formatDate(p.purchase_date)}</Chip>}
                  {p.points_awarded > 0 && <Chip color="#C99B3E"><Star size={10} /> +{p.points_awarded} แต้ม</Chip>}
                  {p.warranty_end && (
                    <Chip color={warrantyOk ? '#3A8E5A' : '#A0907A'}>
                      <Shield size={10} />
                      {warrantyOk ? `ประกัน ${daysLeft} วัน` : `ประกันหมด ${formatDate(p.warranty_end)}`}
                    </Chip>
                  )}
                  {p.receipt_image_url && (
                    <a href={p.receipt_image_url} target="_blank" rel="noopener noreferrer">
                      <Chip color="#4A7BC1"><ExternalLink size={10} /> ดูใบเสร็จ</Chip>
                    </a>
                  )}
                </div>
                {p.admin_note && (
                  <p className="text-[11px] italic mt-2" style={{ color: 'var(--admin-ink-mute)' }}>
                    <FileText size={10} className="inline mr-1" />{p.admin_note}
                  </p>
                )}
                {p.approved_by && (p.status === 'ADMIN_APPROVED' || p.status === 'REJECTED') && (
                  <p className="text-[11px] mt-2" style={{ color: 'var(--admin-ink-mute)' }}>
                    {p.status === 'REJECTED' ? 'ปฏิเสธโดย' : 'อนุมัติโดย'}{' '}
                    <strong style={{ color: 'var(--admin-gold)' }}>{staffMap[p.approved_by] || 'Admin'}</strong>
                    {p.approved_at && <span style={{ color: 'var(--admin-ink-faint)' }}> · {formatDateTime(p.approved_at)}</span>}
                  </p>
                )}
                {p.status === 'PENDING' && (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--admin-border-2)' }}>
                    <ApprovePurchaseButtons purchaseId={p.id} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Chip({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full"
      style={{
        background: color ? `${color}14` : 'var(--admin-bg)',
        color: color || 'var(--admin-ink-soft)',
        border: `1px solid ${color ? `${color}33` : 'var(--admin-border)'}`,
      }}>
      {children}
    </span>
  )
}

// ─── Coupons tab ───
function CouponsTab({ couponList, today, userId }: { couponList: Coupon[]; today: string; userId: string }) {
  if (couponList.length === 0) {
    return <EmptyState icon={Ticket} title="ยังไม่มีคูปอง"
      hint="คูปอง welcome / upgrade จะออกอัตโนมัติเมื่อ user ถึง tier" />
  }
  const isVisible = (c: Coupon) => !c.status || c.status === 'active'
  const active   = couponList.filter(c => isVisible(c) && !c.used_at && c.valid_until >= today)
  const used     = couponList.filter(c => c.used_at)
  const expired  = couponList.filter(c => isVisible(c) && !c.used_at && c.valid_until < today)
  const archived = couponList.filter(c => c.status === 'archived')

  function Row({ c, kind }: { c: Coupon; kind: 'active' | 'used' | 'expired' | 'archived' }) {
    return (
      <div className="px-5 py-3 flex items-center justify-between gap-3"
        style={{ borderBottom: '1px solid var(--admin-border-2)', opacity: kind !== 'active' ? 0.65 : 1 }}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold" style={{ color: 'var(--admin-ink)' }}>
              {c.title || (c.discount_type === 'PERCENT' ? `ส่วนลด ${c.discount_value}%` : `ส่วนลด ฿${c.discount_value}`)}
            </p>
            {c.auto_issue_key && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(201,155,62,0.10)', color: '#A0782B' }}>
                {c.auto_issue_key}
              </span>
            )}
            {c.shopify_price_rule_id && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(94,142,62,0.12)', color: '#5E8E3E' }}>
                Shopify
              </span>
            )}
          </div>
          <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--admin-ink-faint)' }}>
            {c.code} · valid → {formatDate(c.valid_until)}
            {Number(c.min_purchase) > 0 && ` · ขั้นต่ำ ฿${Number(c.min_purchase).toLocaleString()}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {kind === 'active' && c.apply_url && (
            <a href={c.apply_url} target="_blank" rel="noopener noreferrer"
              className="admin-pill admin-pill-green"
              title="เปิด apply URL ที่ Shopify">
              <ExternalLink size={10} /> ใช้
            </a>
          )}
          <span className={
            kind === 'used'     ? 'admin-pill admin-pill-green' :
            kind === 'expired'  ? 'admin-pill' :
            kind === 'archived' ? 'admin-pill admin-pill-amber' :
                                  'admin-pill admin-pill-blue'
          }>
            {kind === 'used'     ? `ใช้ ${formatDate(c.used_at!)}` :
             kind === 'expired'  ? 'หมดอายุ' :
             kind === 'archived' ? 'แลกคืน' :
                                   'ใช้ได้'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {[
        { title: `ใช้ได้ (${active.length})`,    list: active,   kind: 'active'   as const, color: '#3A8E5A' },
        { title: `ใช้แล้ว (${used.length})`,    list: used,     kind: 'used'     as const, color: '#6B5A48' },
        { title: `หมดอายุ (${expired.length})`,  list: expired,  kind: 'expired'  as const, color: '#A0907A' },
        { title: `แลกคืน (${archived.length})`, list: archived, kind: 'archived' as const, color: '#C99B3E' },
      ].map(group => group.list.length > 0 && (
        <div key={group.title} className="admin-card overflow-hidden">
          <div className="px-5 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--admin-border-2)', background: 'var(--admin-bg)' }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: group.color }}>
              {group.title}
            </h3>
            <Link href={`/admin/coupons?user=${userId}`}
              className="text-[11px]" style={{ color: 'var(--admin-ink-mute)' }}>
              จัดการในหน้าคูปอง →
            </Link>
          </div>
          {group.list.map(c => <Row key={c.id} c={c} kind={group.kind} />)}
        </div>
      ))}
    </div>
  )
}

// ─── Points tab ───
function PointsTab({ pointsList, staffMap }: { pointsList: PointsLog[]; staffMap: Record<string, string> }) {
  if (pointsList.length === 0) {
    return <EmptyState icon={Star} title="ยังไม่มีประวัติแต้ม" />
  }
  return (
    <div className="admin-card overflow-hidden">
      {pointsList.map((log, i) => (
        <div key={log.id} className="px-5 py-3 flex items-center gap-3"
          style={{ borderBottom: i < pointsList.length - 1 ? '1px solid var(--admin-border-2)' : undefined }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: log.points_delta > 0 ? 'rgba(58,142,90,0.10)' : 'rgba(177,66,66,0.10)' }}>
            <TrendingUp size={14}
              style={{ color: log.points_delta > 0 ? '#3A8E5A' : '#B14242', transform: log.points_delta < 0 ? 'rotate(180deg)' : 'none' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--admin-ink)' }}>
              {log.description || '-'}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--admin-ink-faint)' }}>
              <Clock size={9} className="inline mr-0.5" />{formatDateTime(log.created_at)}
              {log.adjusted_by && staffMap[log.adjusted_by] && (
                <span className="font-semibold ml-1" style={{ color: 'var(--admin-gold)' }}>
                  · {staffMap[log.adjusted_by]}
                </span>
              )}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold tabular-nums"
              style={{ color: log.points_delta > 0 ? '#3A8E5A' : '#B14242' }}>
              {log.points_delta > 0 ? '+' : ''}{log.points_delta.toLocaleString()}
            </p>
            <p className="text-[10px] tabular-nums" style={{ color: 'var(--admin-ink-faint)' }}>
              คงเหลือ {log.balance_after.toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Audit tab ───
function AuditTab({ auditList, userId }: { auditList: AuditLogRow[]; userId: string }) {
  if (auditList.length === 0) {
    return <EmptyState icon={Shield} title="ยังไม่มี action ใน audit log" />
  }
  return (
    <div className="admin-card overflow-hidden">
      <div className="px-5 py-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--admin-border-2)', background: 'var(--admin-bg)' }}>
        <p className="text-xs" style={{ color: 'var(--admin-ink-mute)' }}>
          {auditList.length} actions
        </p>
        <Link href={`/admin/audit?user=${userId}`}
          className="text-[11px]" style={{ color: 'var(--admin-gold)' }}>
          ดูใน audit page →
        </Link>
      </div>
      {auditList.map((a, i) => {
        const meta = ACTION_META[a.action_type] || { label: a.action_type, color: '#6B5A48', icon: <ActivityIcon size={12} /> }
        const staff = Array.isArray(a.staff) ? a.staff[0] : a.staff
        return (
          <div key={a.id} className="px-5 py-3 flex items-center gap-3"
            style={{ borderBottom: i < auditList.length - 1 ? '1px solid var(--admin-border-2)' : undefined }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `${meta.color}1A`, color: meta.color }}>
              {meta.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: meta.color }}>{meta.label}</p>
              <p className="text-[11px]" style={{ color: 'var(--admin-ink-faint)' }}>
                {staff?.name ? <span className="font-semibold" style={{ color: 'var(--admin-gold)' }}>{staff.name}</span> : 'System'}
                {' · '}{formatDateTime(a.created_at)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
