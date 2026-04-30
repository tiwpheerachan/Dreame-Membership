'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Package, Ticket, UserRound, Megaphone } from 'lucide-react'

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
        padding: '0 14px 14px',
        pointerEvents: 'auto',
      }}>
        <div className="glass-aluminum" style={{
          position: 'relative',
          display: 'flex',
          padding: 5,
          borderRadius: 'var(--r-pill)',
          overflow: 'hidden',
        }}>
          {/* Subtle gold-shimmer top edge — catches the light like a polished metal rim */}
          <div aria-hidden style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 1,
            background: 'linear-gradient(90deg, transparent 0%, rgba(234,219,177,0.85) 35%, rgba(160,120,43,0.95) 50%, rgba(234,219,177,0.85) 65%, transparent 100%)',
            pointerEvents: 'none',
          }} />

          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/home' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className="tap-down"
                style={{
                  position: 'relative',
                  flex: 1,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  padding: '10px 4px',
                  borderRadius: 'var(--r-pill)',
                  textDecoration: 'none',
                  // Gold gradient when active; silvery transparent when not
                  background: active
                    ? 'linear-gradient(180deg, #FAF3DC 0%, #EADBB1 35%, #C9A063 75%, #A0782B 100%)'
                    : 'transparent',
                  color: active ? '#1A1815' : 'rgba(40,38,32,0.55)',
                  // Active pill gets a 3D-coined effect: top inner highlight + soft outer glow
                  boxShadow: active
                    ? 'inset 0 1px 0 rgba(255,250,235,0.95), inset 0 -1px 0 rgba(120,80,20,0.35), 0 4px 14px rgba(160,120,43,0.35), 0 1px 2px rgba(120,80,20,0.20)'
                    : 'none',
                  transition: 'all 0.32s cubic-bezier(0.34,1.1,0.64,1)',
                }}
              >
                <Icon size={18} strokeWidth={active ? 2.4 : 1.7} />
                <span style={{
                  fontSize: 9.5,
                  fontWeight: active ? 800 : 600,
                  letterSpacing: active ? '0.04em' : '0.02em',
                  // Subtle text-shadow on active to mimic engraved metal lettering
                  textShadow: active ? '0 1px 0 rgba(255,250,235,0.6)' : 'none',
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
