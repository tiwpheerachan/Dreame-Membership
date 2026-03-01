'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Clock, Tag, LogOut, History } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/admin',             icon: LayoutDashboard, label: 'Dashboard',      exact: true },
  { href: '/admin/members',     icon: Users,           label: 'สมาชิก' },
  { href: '/admin/pending',     icon: Clock,           label: 'รอตรวจสอบ' },
  { href: '/admin/coupons',     icon: Tag,             label: 'คูปอง' },
  { href: '/admin/my-activity', icon: History,         label: 'ประวัติของฉัน' },
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

  return (
    <aside className="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col min-h-screen">
      {/* Logo */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center font-black text-gray-900">D</div>
          <div>
            <p className="text-white text-sm font-bold leading-tight">Dreame Admin</p>
            <p className="text-gray-500 text-xs">{staff.role}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ href, icon: Icon, label, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href) && !(exact && pathname !== href)
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${active ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Staff info */}
      <div className="p-3 border-t border-gray-800">
        <div className="px-3 py-2 mb-1">
          <p className="text-white text-sm font-medium truncate">{staff.name}</p>
        </div>
        <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-red-400 text-sm rounded-lg hover:bg-red-900/10 transition-colors">
          <LogOut size={14} /> ออกจากระบบ
        </button>
      </div>
    </aside>
  )
}