'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Clock, Package, Tag, Megaphone,
  History, LogOut, UserCog, BarChart3, Search, Heart, Activity,
  CalendarHeart, Bell, AlertTriangle, Gift, Truck, TrendingUp, Sparkles, Store,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ADMIN_TABS, canViewTab, type TabAccess } from '@/lib/admin-tabs'

// Icon per tab key (kept here — icons are client-only; the registry is server-safe)
const TAB_ICONS: Record<string, typeof Users> = {
  dashboard: LayoutDashboard, members: Users, segments: BarChart3,
  purchases: Package, pending: Clock, import: Activity,
  coupons: Tag, promotions: Megaphone, branches: Store, announcements: Bell,
  campaigns: CalendarHeart, 'tier-up': TrendingUp,
  rewards: Gift, redemptions: Truck, privileges: Sparkles, 'points-expiring': AlertTriangle,
  staff: UserCog, audit: History, health: Heart, 'my-activity': History,
}

interface Staff { name: string; role: string; tab_access?: TabAccess }

export default function AdminSidebar({ staff }: { staff: Staff }) {
  const pathname = usePathname()
  // Carry each tab's section down (registry only tags section-starters), then
  // filter — so a visible tab always keeps its group header even if the
  // section-starter above it was hidden by permissions.
  let curSection: string | undefined
  const NAV = ADMIN_TABS
    .map(t => { if (t.group) curSection = t.group; return { ...t, section: curSection } })
    .filter(t => canViewTab(staff.role, staff.tab_access, t.key))
    .map(t => ({ href: t.href, icon: TAB_ICONS[t.key] || Package, label: t.label, section: t.section }))
  const router = useRouter()
  const supabase = createClient()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function openCmdK() {
    window.dispatchEvent(new CustomEvent('cmdk-open'))
  }

  return (
    <aside className="admin-side">
      {/* Logo */}
      <div style={{ padding: 18, borderBottom: '1px solid var(--admin-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11,
            background: '#1F1F1F',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 7, flexShrink: 0,
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/dreame-logo.png" alt="Dreame"
              style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--admin-ink)', letterSpacing: '-0.01em' }}>
              Dreame Admin
            </p>
            <p style={{ margin: 0, fontSize: 9.5, color: 'var(--admin-ink-mute)', fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase' }}>
              {staff.role.replace('_', ' ')}
            </p>
          </div>
        </div>
        {/* Search trigger */}
        <button onClick={openCmdK} style={{
          marginTop: 14, width: '100%',
          background: 'var(--admin-bg)', border: '1px solid var(--admin-border)',
          borderRadius: 11, padding: '9px 11px',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, color: 'var(--admin-ink-mute)', fontFamily: 'inherit',
          cursor: 'pointer',
        }}>
          <Search size={13} />
          <span>ค้นหา…</span>
          <kbd style={{
            marginLeft: 'auto', fontSize: 10, padding: '2px 6px',
            background: '#fff', border: '1px solid var(--admin-border)',
            borderRadius: 4, fontFamily: 'var(--font-mono)', color: 'var(--admin-ink-mute)',
          }}>⌘K</kbd>
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: 12, overflowY: 'auto' }}>
        {NAV.map(({ href, icon: Icon, label, section }, i) => {
          const exact = href === '/admin'
          const active = exact ? pathname === href : pathname.startsWith(href)
          const showHeader = !!section && section !== NAV[i - 1]?.section
          return (
            <div key={href}>
              {showHeader && (
                <p style={{
                  margin: i === 0 ? '0 0 4px' : '14px 0 4px',
                  padding: '0 14px',
                  fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em',
                  color: 'var(--ink-faint)', textTransform: 'uppercase',
                }}>
                  {section}
                </p>
              )}
              <Link href={href} className={`admin-side-link ${active ? 'admin-side-link-active' : ''}`}>
                <Icon size={15} strokeWidth={1.7} />
                {label}
              </Link>
            </div>
          )
        })}
      </nav>

      {/* Footer: staff card + logout */}
      <div style={{ padding: 12, borderTop: '1px solid var(--admin-border)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px',
          background: 'var(--admin-bg)',
          borderRadius: 11,
          marginBottom: 6,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'linear-gradient(135deg, #C99B3E, #7A5A1F)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0,
          }}>
            {(staff.name || '?').split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--admin-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {staff.name}
            </p>
            <p style={{ margin: 0, fontSize: 9.5, color: 'var(--admin-ink-mute)', textTransform: 'uppercase', letterSpacing: '0.10em', fontWeight: 600 }}>
              {staff.role.replace('_', ' ')}
            </p>
          </div>
        </div>
        <button onClick={logout} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 14px', borderRadius: 11,
          background: 'transparent', border: 'none',
          color: '#B14242', fontSize: 12.5, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <LogOut size={13} /> ออกจากระบบ
        </button>
      </div>
    </aside>
  )
}
