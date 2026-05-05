'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Plus, ShieldCheck, Ticket, Gift, type LucideIcon } from 'lucide-react'

interface Action {
  key: string
  href: string
  Icon: LucideIcon
  label: string
}

const ACTIONS: Action[] = [
  { key: 'register', href: '/purchases/register', Icon: Plus,        label: 'ลงทะเบียน' },
  { key: 'warranty', href: '/purchases',          Icon: ShieldCheck, label: 'ประกัน' },
  { key: 'coupon',   href: '/coupons',            Icon: Ticket,      label: 'คูปอง' },
  { key: 'redeem',   href: '/points',             Icon: Gift,        label: 'แลกของ' },
]

export default function QuickActionsBar() {
  const router = useRouter()
  const [activeKey, setActiveKey] = useState<string>('register')

  // Prefetch every destination on mount so navigation is instant — without
  // this the click feels delayed because the route loads on demand.
  useEffect(() => {
    for (const a of ACTIONS) router.prefetch(a.href)
  }, [router])

  function handleClick(action: Action) {
    // Update the pill position AND navigate in the same tick. The slide
    // animation starts immediately; Next.js does the route transition
    // alongside it. No setTimeout — that's what made the click feel like
    // it needed two presses.
    setActiveKey(action.key)
    router.push(action.href)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      gap: 6, padding: 5,
      borderRadius: 999,
      background: 'rgba(255,255,255,0.55)',
      border: '1px solid rgba(14,14,14,0.07)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      boxShadow: '0 4px 14px rgba(14,14,14,0.06)',
      overflow: 'hidden',
    }}>
      {ACTIONS.map(action => {
        const active = activeKey === action.key
        const Icon = action.Icon
        return (
          <motion.button
            key={action.key}
            type="button"
            onClick={() => handleClick(action)}
            layout
            transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
            whileTap={{ scale: 0.95 }}
            style={{
              position: 'relative',
              flex: active ? '1 1 auto' : '0 0 38px',
              height: 38,
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              background: 'transparent',
              borderRadius: 999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
              minWidth: 38,
            }}
            aria-label={action.label}
            aria-pressed={active}
          >
            {/* Inactive pill background */}
            {!active && (
              <div aria-hidden style={{
                position: 'absolute', inset: 0,
                borderRadius: 999,
                background: '#fff',
                border: '1px solid rgba(14,14,14,0.08)',
              }} />
            )}

            {/* Active gold gradient pill — shared layout id makes it slide between buttons */}
            {active && (
              <motion.div
                aria-hidden
                layoutId="activeQuickAction"
                style={{
                  position: 'absolute', inset: 0,
                  borderRadius: 999,
                  background: 'linear-gradient(180deg, #FAF3DC 0%, #EADBB1 35%, #C9A063 75%, #A0782B 100%)',
                  boxShadow:
                    'inset 0 1px 0 rgba(255,250,235,0.95), inset 0 -1px 0 rgba(120,80,20,0.35), 0 4px 14px rgba(160,120,43,0.32)',
                }}
                transition={{ type: 'spring', bounce: 0.22, duration: 0.55 }}
              />
            )}

            {/* Icon + (label only when active) */}
            <span style={{
              position: 'relative', zIndex: 1,
              display: 'inline-flex', alignItems: 'center',
              gap: active ? 6 : 0,
              padding: active ? '0 14px' : 0,
              color: active ? '#1A1815' : 'rgba(14,14,14,0.72)',
              fontSize: 12,
              fontWeight: active ? 800 : 600,
              whiteSpace: 'nowrap',
              textShadow: active ? '0 1px 0 rgba(255,250,235,0.55)' : 'none',
            }}>
              <Icon size={15} strokeWidth={active ? 2.4 : 1.9} />
              {active && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ delay: 0.1, duration: 0.18 }}
                  style={{ overflow: 'hidden' }}
                >
                  {action.label}
                </motion.span>
              )}
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}
