'use client'
import { useEffect } from 'react'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  width?: number
  children: React.ReactNode
}

export default function Drawer({ open, onClose, title, subtitle, width = 560, children }: Props) {
  // Close on Escape; lock body scroll while open
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(14,14,14,0.35)',
          backdropFilter: 'blur(2px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.2s ease',
          zIndex: 80,
        }}
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: '100%', maxWidth: width,
          background: '#fff',
          borderLeft: '1px solid var(--hair)',
          boxShadow: open ? '-12px 0 32px rgba(14,14,14,0.10)' : 'none',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
          display: 'flex', flexDirection: 'column',
          zIndex: 90,
        }}
      >
        {(title || subtitle) && (
          <header style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--hair)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
            flexShrink: 0,
          }}>
            <div style={{ minWidth: 0 }}>
              {title && (
                <h2 style={{
                  margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{title}</h2>
              )}
              {subtitle && (
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ink-mute)' }}>{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 30, height: 30, borderRadius: 8,
                background: 'var(--bg-soft)', border: '1px solid var(--hair)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--ink-mute)', flexShrink: 0,
              }}
            >
              <X size={14} />
            </button>
          </header>
        )}
        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {children}
        </div>
      </aside>
    </>
  )
}
