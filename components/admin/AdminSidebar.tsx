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

const NAV: Array<{ href: string; icon: typeof Users; label: string; group?: string }> = [
  { href: '/admin',                    icon: LayoutDashboard, label: 'Dashboard' },

  { href: '/admin/members',            icon: Users,           label: 'สมาชิก',          group: 'CUSTOMERS' },
  { href: '/admin/segments',           icon: BarChart3,       label: 'Segmentation' },

  { href: '/admin/purchases',          icon: Package,         label: 'สินค้าทั้งหมด',     group: 'OPERATIONS' },
  { href: '/admin/pending',            icon: Clock,           label: 'รอตรวจสอบ' },
  { href: '/admin/import',             icon: Activity,        label: 'นำเข้า CSV' },

  { href: '/admin/coupons',            icon: Tag,             label: 'คูปอง',           group: 'MARKETING' },
  { href: '/admin/promotions',         icon: Megaphone,       label: 'โปรโมชั่น' },
  { href: '/admin/branches',           icon: Store,           label: 'สาขา' },
  { href: '/admin/announcements',      icon: Bell,            label: 'ประกาศ' },
  { href: '/admin/campaigns',          icon: CalendarHeart,   label: 'แคมเปญ' },
  { href: '/admin/insights/tier-up',   icon: TrendingUp,      label: 'Tier-up forecast' },

  { href: '/admin/rewards',            icon: Gift,            label: 'ของรางวัล',        group: 'LOYALTY' },
  { href: '/admin/redemptions',        icon: Truck,           label: 'การจัดส่ง' },
  { href: '/admin/privileges',         icon: Sparkles,        label: 'สิทธิพิเศษ (น้ำยาฟรี)' },
  { href: '/admin/points/expiring',    icon: AlertTriangle,   label: 'แต้มจะหมดอายุ' },

  { href: '/admin/staff',              icon: UserCog,         label: 'พนักงาน',         group: 'SETTINGS' },
  { href: '/admin/audit',              icon: History,         label: 'Audit log' },
  { href: '/admin/health',             icon: Heart,           label: 'System health' },
  { href: '/admin/my-activity',        icon: History,         label: 'ประวัติของฉัน' },
]

interface Staff { name: string; role: string }

export default function AdminSidebar({ staff }: { staff: Staff }) {
  const pathname = usePathname()
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
        {NAV.map(({ href, icon: Icon, label, group }, i) => {
          const exact = href === '/admin'
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <div key={href}>
              {group && (
                <p style={{
                  margin: i === 0 ? '0 0 4px' : '14px 0 4px',
                  padding: '0 14px',
                  fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em',
                  color: 'var(--ink-faint)', textTransform: 'uppercase',
                }}>
                  {group}
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
