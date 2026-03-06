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

const NAV_CSS = `
  .nav-bar { position:fixed; bottom:0; left:0; right:0; background:#fff; border-top:1px solid #f3f4f6; z-index:50; padding-bottom:env(safe-area-inset-bottom); box-shadow:0 -4px 24px rgba(0,0,0,0.06); font-family:'Prompt',system-ui,sans-serif; }
  .nav-inner { max-width:480px; margin:0 auto; display:flex; }
  .nav-item { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; padding:10px 4px 8px; text-decoration:none; position:relative; transition:all 0.15s; }
  .nav-item-active { color:#f59e0b; }
  .nav-item-inactive { color:#9ca3af; }
  .nav-item-inactive:hover { color:#6b7280; }
  .nav-dot { position:absolute; top:6px; width:4px; height:4px; border-radius:50%; background:#f59e0b; }
  .nav-label { font-size:10px; font-weight:600; letter-spacing:0.02em; }
  .nav-icon-wrap-active { background:#fffbeb; border-radius:12px; padding:5px 10px; }
  .nav-icon-wrap { padding:5px 10px; }
`

export default function Navbar() {
  const pathname = usePathname()
  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: NAV_CSS }} />
      <nav className="nav-bar">
        <div className="nav-inner">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/home' && pathname.startsWith(href))
            return (
              <Link key={href} href={href} className={`nav-item ${active ? 'nav-item-active' : 'nav-item-inactive'}`}>
                <div className={active ? 'nav-icon-wrap-active' : 'nav-icon-wrap'}>
                  <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                </div>
                <span className="nav-label">{label}</span>
                {active && <div className="nav-dot" />}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}