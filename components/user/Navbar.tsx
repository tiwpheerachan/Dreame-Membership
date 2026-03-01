'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Package, Star, Tag, User } from 'lucide-react'

const navItems = [
  { href: '/home',      icon: Home,    label: 'หน้าหลัก' },
  { href: '/purchases', icon: Package, label: 'สินค้า' },
  { href: '/points',    icon: Star,    label: 'คะแนน' },
  { href: '/coupons',   icon: Tag,     label: 'คูปอง' },
  { href: '/profile',   icon: User,    label: 'โปรไฟล์' },
]

export default function Navbar() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-950/95 border-t border-gray-800 backdrop-blur-xl z-50 pb-safe">
      <div className="max-w-md mx-auto flex">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/home' && pathname.startsWith(href))
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${active ? 'text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}>
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">{label}</span>
              {active && <div className="absolute bottom-0 w-8 h-0.5 bg-amber-400 rounded-t" />}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
