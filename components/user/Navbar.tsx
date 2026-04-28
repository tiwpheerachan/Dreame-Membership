'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Package, Sparkles, Ticket, UserRound, Megaphone } from 'lucide-react'

const NAV = [
  { href: '/home',       icon: Home,       label: 'หน้าหลัก' },
  { href: '/promotions', icon: Megaphone,  label: 'โปร' },
  { href: '/purchases',  icon: Package,    label: 'สินค้า' },
  { href: '/coupons',    icon: Ticket,     label: 'คูปอง' },
  { href: '/profile',    icon: UserRound,  label: 'โปรไฟล์' },
]

export default function Navbar() {
  const pathname = usePathname()
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      paddingBottom: 'env(safe-area-inset-bottom)',
      pointerEvents: 'none',
      zIndex: 50,
    }}>
      <div style={{
        maxWidth: 480, margin: '0 auto',
        padding: '0 14px 16px',
        pointerEvents: 'auto',
      }}>
        <div className="glass-dark" style={{
          display: 'flex',
          padding: 5,
          borderRadius: 'var(--r-pill)',
          boxShadow: '0 12px 40px rgba(10,9,7,0.25)',
        }}>
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/home' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className="tap-down"
                style={{
                  flex: 1,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  padding: '10px 4px',
                  borderRadius: 'var(--r-pill)',
                  textDecoration: 'none',
                  background: active ? 'var(--gold)' : 'transparent',
                  color: active ? '#0A0907' : 'rgba(255,255,255,0.55)',
                  transition: 'all 0.3s cubic-bezier(0.34,1.1,0.64,1)',
                }}
              >
                <Icon size={18} strokeWidth={active ? 2.4 : 1.7} />
                <span style={{
                  fontSize: 9, fontWeight: active ? 800 : 500,
                  letterSpacing: '0.02em',
                }}>
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
