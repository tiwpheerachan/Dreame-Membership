'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, User, Package, Tag, LayoutDashboard, Megaphone,
  Clock, UserCog, BarChart3, Bell, Heart, History, AlertTriangle,
  Activity, CalendarHeart, Users,
} from 'lucide-react'

interface Result {
  type: 'page' | 'member' | 'purchase' | 'coupon'
  href: string
  title: string
  meta?: string
  icon: typeof Search
}

const PAGES: Result[] = [
  { type: 'page', href: '/admin',                 title: 'Dashboard',         icon: LayoutDashboard },
  { type: 'page', href: '/admin/members',         title: 'สมาชิก',             icon: Users },
  { type: 'page', href: '/admin/segments',        title: 'Segmentation',      icon: BarChart3 },
  { type: 'page', href: '/admin/purchases',       title: 'สินค้าทั้งหมด',       icon: Package },
  { type: 'page', href: '/admin/pending',         title: 'รอตรวจสอบ',          icon: Clock },
  { type: 'page', href: '/admin/import',          title: 'นำเข้า CSV',         icon: Activity },
  { type: 'page', href: '/admin/coupons',         title: 'คูปอง',              icon: Tag },
  { type: 'page', href: '/admin/promotions',      title: 'โปรโมชั่น',           icon: Megaphone },
  { type: 'page', href: '/admin/announcements',   title: 'ประกาศ',             icon: Bell },
  { type: 'page', href: '/admin/campaigns',       title: 'แคมเปญ',             icon: CalendarHeart },
  { type: 'page', href: '/admin/points/expiring', title: 'แต้มจะหมดอายุ',       icon: AlertTriangle },
  { type: 'page', href: '/admin/staff',           title: 'พนักงาน',            icon: UserCog },
  { type: 'page', href: '/admin/audit',           title: 'Audit log',         icon: History },
  { type: 'page', href: '/admin/health',          title: 'System health',     icon: Heart },
]

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // open via ⌘K, Ctrl+K, or custom event
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    function onCustom() { setOpen(true) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('cmdk-open', onCustom)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('cmdk-open', onCustom)
    }
  }, [])

  // focus on open
  useEffect(() => {
    if (open) {
      setQ('')
      setResults([])
      setHighlight(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // search debounce
  useEffect(() => {
    if (!open) return
    const term = q.trim().toLowerCase()
    if (!term) {
      setResults(PAGES)
      return
    }
    // page filter (instant)
    const pageHits = PAGES.filter(p => p.title.toLowerCase().includes(term))

    // remote search debounced
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(term)}`)
        const data = await res.json()
        const memberHits: Result[] = (data.members || []).slice(0, 5).map((m: { id: string; full_name?: string; phone?: string; email?: string; member_id?: string }) => ({
          type: 'member' as const,
          href: `/admin/members/${m.id}`,
          title: m.full_name || m.email || m.phone || m.member_id || 'สมาชิก',
          meta: m.member_id,
          icon: User,
        }))
        const purchaseHits: Result[] = (data.purchases || []).slice(0, 5).map((p: { id: string; order_sn: string; model_name?: string; user_id: string }) => ({
          type: 'purchase' as const,
          href: `/admin/members/${p.user_id}`,
          title: p.model_name || p.order_sn,
          meta: p.order_sn,
          icon: Package,
        }))
        const couponHits: Result[] = (data.coupons || []).slice(0, 5).map((c: { id: string; code: string; title?: string }) => ({
          type: 'coupon' as const,
          href: `/admin/coupons`,
          title: c.title || c.code,
          meta: c.code,
          icon: Tag,
        }))
        setResults([...pageHits, ...memberHits, ...purchaseHits, ...couponHits])
      } catch {
        setResults(pageHits)
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => clearTimeout(t)
  }, [q, open])

  function go(r: Result) {
    setOpen(false)
    router.push(r.href)
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)) }
    if (e.key === 'Enter' && results[highlight]) { e.preventDefault(); go(results[highlight]) }
  }

  if (!open) return null

  // group results
  const grouped = {
    'หน้า':       results.filter(r => r.type === 'page'),
    'สมาชิก':     results.filter(r => r.type === 'member'),
    'สินค้า':     results.filter(r => r.type === 'purchase'),
    'คูปอง':      results.filter(r => r.type === 'coupon'),
  }

  return (
    <div className="cmdk-backdrop" onClick={() => setOpen(false)}>
      <div className="cmdk-panel" onClick={e => e.stopPropagation()}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{
            position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--ink-faint)', pointerEvents: 'none',
          }} />
          <input
            ref={inputRef}
            className="cmdk-input"
            style={{ paddingLeft: 44 }}
            placeholder="ค้นหา member · order_sn · coupon code · หน้า..."
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onInputKey}
          />
          {loading && (
            <div className="spinner" style={{
              position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)',
              width: 14, height: 14, border: '2px solid var(--ink-ghost)',
              borderTopColor: 'var(--ink)', borderRadius: '50%',
            }} />
          )}
        </div>

        <div style={{ maxHeight: 460, overflowY: 'auto' }}>
          {Object.entries(grouped).map(([label, list]) => (
            list.length > 0 ? (
              <div key={label} className="cmdk-section">
                <p className="cmdk-label">{label}</p>
                {list.map((r, i) => {
                  const flatIdx = results.indexOf(r)
                  const Icon = r.icon
                  return (
                    <a key={`${r.type}-${i}-${r.href}`} className="cmdk-row"
                      onClick={() => go(r)}
                      onMouseEnter={() => setHighlight(flatIdx)}
                      style={{
                        background: highlight === flatIdx ? 'var(--bg-soft)' : 'transparent',
                      }}>
                      <div className="cmdk-row-icon"><Icon size={14} /></div>
                      <span style={{ flex: 1 }}>{r.title}</span>
                      {r.meta && <span className="cmdk-row-meta">{r.meta}</span>}
                    </a>
                  )
                })}
              </div>
            ) : null
          ))}

          {results.length === 0 && q && !loading && (
            <p style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>
              ไม่พบผลลัพธ์
            </p>
          )}
        </div>

        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid var(--hair)',
          display: 'flex', justifyContent: 'space-between',
          fontSize: 10, color: 'var(--ink-faint)',
        }}>
          <span>↑↓ เลื่อน · ↵ เปิด · esc ปิด</span>
          <kbd style={{ fontFamily: 'var(--font-mono)' }}>⌘K</kbd>
        </div>
      </div>
    </div>
  )
}
