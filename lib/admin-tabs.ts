// ============================================================
// Admin tab registry + per-tab access helpers (RBAC)
//
// Single source of truth for the admin tabs. Used by:
//   • AdminSidebar  — which tabs to show
//   • (admin)/layout — server-side gate on tab entry
//   • staff page     — per-staff permission editor
//
// Access model: admin_staff.tab_access is a JSONB map { tabKey: 'view' | 'edit' }.
//   • absent key           → no access (tab hidden + entry blocked)
//   • 'view'               → can see + open the tab, but actions are read-only
//   • 'edit'               → full access
// SUPER_ADMIN bypasses tab_access entirely (always full access to every tab).
// ============================================================

export type TabLevel = 'view' | 'edit'
export type TabAccess = Record<string, TabLevel>

export interface AdminTab {
  key: string
  href: string
  label: string
  group?: string
}

// Order + grouping mirror the sidebar. `key` is the stable permission id.
export const ADMIN_TABS: AdminTab[] = [
  { key: 'dashboard',       href: '/admin',                  label: 'Dashboard' },

  { key: 'members',         href: '/admin/members',          label: 'สมาชิก',               group: 'CUSTOMERS' },
  { key: 'segments',        href: '/admin/segments',         label: 'Segmentation' },

  { key: 'purchases',       href: '/admin/purchases',        label: 'สินค้าทั้งหมด',          group: 'OPERATIONS' },
  { key: 'pending',         href: '/admin/pending',          label: 'รอตรวจสอบ' },
  { key: 'import',          href: '/admin/import',           label: 'นำเข้า CSV' },

  { key: 'coupons',         href: '/admin/coupons',          label: 'คูปอง',                group: 'MARKETING' },
  { key: 'promotions',      href: '/admin/promotions',       label: 'โปรโมชั่น' },
  { key: 'branches',        href: '/admin/branches',         label: 'สาขา' },
  { key: 'announcements',   href: '/admin/announcements',    label: 'ประกาศ' },
  { key: 'campaigns',       href: '/admin/campaigns',        label: 'แคมเปญ' },
  { key: 'tier-up',         href: '/admin/insights/tier-up', label: 'Tier-up forecast' },

  { key: 'rewards',         href: '/admin/rewards',          label: 'ของรางวัล',             group: 'LOYALTY' },
  { key: 'redemptions',     href: '/admin/redemptions',      label: 'การจัดส่ง' },
  { key: 'privileges',      href: '/admin/privileges',       label: 'สิทธิพิเศษ (น้ำยาฟรี)' },
  { key: 'points-expiring', href: '/admin/points/expiring',  label: 'แต้มจะหมดอายุ' },

  { key: 'staff',           href: '/admin/staff',            label: 'พนักงาน',              group: 'SETTINGS' },
  { key: 'audit',           href: '/admin/audit',            label: 'Audit log' },
  { key: 'health',          href: '/admin/health',           label: 'System health' },
  { key: 'my-activity',     href: '/admin/my-activity',      label: 'ประวัติของฉัน' },
]

// 'my-activity' is every admin's own history — always allowed so nobody is
// stranded with a fully-empty sidebar.
export const ALWAYS_ALLOWED = new Set<string>(['my-activity'])

const SUPER = 'SUPER_ADMIN'

// Longest-href-first so '/admin/points/expiring' wins over '/admin' etc.
const TABS_BY_SPECIFICITY = [...ADMIN_TABS].sort((a, b) => b.href.length - a.href.length)

/** Map a pathname to the tab it belongs to (null if it's not a known tab). */
export function tabKeyForPath(pathname: string): string | null {
  const p = pathname.replace(/\/+$/, '') || '/admin'
  for (const t of TABS_BY_SPECIFICITY) {
    if (t.href === '/admin') { if (p === '/admin') return t.key; continue }
    if (p === t.href || p.startsWith(t.href + '/')) return t.key
  }
  return null
}

export function canViewTab(role: string, tabAccess: TabAccess | null | undefined, key: string): boolean {
  if (role === SUPER) return true
  if (ALWAYS_ALLOWED.has(key)) return true
  const lvl = tabAccess?.[key]
  return lvl === 'view' || lvl === 'edit'
}

export function canEditTab(role: string, tabAccess: TabAccess | null | undefined, key: string): boolean {
  if (role === SUPER) return true
  return tabAccess?.[key] === 'edit'
}

/** Tabs the given staff may see, in sidebar order. */
export function visibleTabs(role: string, tabAccess: TabAccess | null | undefined): AdminTab[] {
  return ADMIN_TABS.filter(t => canViewTab(role, tabAccess, t.key))
}

/** First tab a staff can land on (for redirects when their target is denied). */
export function firstAllowedHref(role: string, tabAccess: TabAccess | null | undefined): string {
  const t = visibleTabs(role, tabAccess)[0]
  return t ? t.href : '/admin/my-activity'
}
