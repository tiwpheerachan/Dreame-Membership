'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Clock, Package, Tag, Megaphone,
  History, LogOut, UserCog, BarChart3, Search, Heart, Activity,
  CalendarHeart, Bell, AlertTriangle,
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
  { href: '/admin/announcements',      icon: Bell,            label: 'ประกาศ' },
  { href: '/admin/campaigns',          icon: CalendarHeart,   label: 'แคมเปญ' },

  { href: '/admin/points/expiring',    icon: AlertTriangle,   label: 'แต้มจะหมดอายุ',     group: 'LOYALTY' },

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
      <div style={{ padding: 16, borderBottom: '1px solid var(--hair)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'var(--black)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--gold-soft)', fontWeight: 800, fontSize: 14, letterSpacing: '-0.02em',
          }}>D</div>
          <div>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' }}>
              Dreame Admin
            </p>
            <p style={{ margin: 0, fontSize: 10, color: 'var(--ink-mute)', fontWeight: 600, letterSpacing: '0.06em' }}>
              {staff.role.replace('_', ' ')}
            </p>
          </div>
        </div>
        {/* Search trigger */}
        <button onClick={openCmdK} style={{
          marginTop: 12, width: '100%',
          background: 'var(--bg-soft)', border: '1px solid var(--hair)',
          borderRadius: 'var(--r-md)', padding: '8px 10px',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, color: 'var(--ink-mute)', fontFamily: 'inherit',
          cursor: 'pointer',
        }}>
          <Search size={13} />
          <span>ค้นหา...</span>
          <kbd style={{
            marginLeft: 'auto', fontSize: 10, padding: '2px 6px',
            background: '#fff', border: '1px solid var(--hair)',
            borderRadius: 4, fontFamily: 'var(--font-mono)', color: 'var(--ink-mute)',
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

      {/* Footer: staff + logout */}
      <div style={{ padding: 12, borderTop: '1px solid var(--hair)' }}>
        <div style={{ padding: '8px 12px 4px' }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {staff.name}
          </p>
        </div>
        <button onClick={logout} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 14px', borderRadius: 'var(--r-md)',
          background: 'transparent', border: 'none',
          color: 'var(--red)', fontSize: 12.5, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <LogOut size={13} /> ออกจากระบบ
        </button>
      </div>
    </aside>
  )
}
