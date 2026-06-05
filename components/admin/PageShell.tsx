// ============================================================
// PageShell — consistent app-style chrome for every admin page
//
//   • Slim breadcrumb (optional)
//   • Sticky header (title + subtitle + actions)
//   • Optional sticky filter strip directly below the header
//   • Scrollable content area (full available height)
//
// Use this for every admin page to keep the chrome consistent.
//
// Example:
//   <PageShell
//     title="สมาชิก"
//     subtitle="9 คน"
//     eyebrow="Customers"
//     actions={<button …>Export</button>}
//     filters={<FilterForm />}
//   >
//     <Table />
//   </PageShell>
// ============================================================

import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: ReactNode
  eyebrow?: string                  // small uppercase label above title
  breadcrumb?: ReactNode            // optional breadcrumb rendered above header
  actions?: ReactNode               // right-aligned actions in header
  filters?: ReactNode               // sticky strip below header
  children: ReactNode
  contentPadding?: string           // override default padding
  fullBleed?: boolean               // remove default padding entirely
}

export default function PageShell({
  title, subtitle, eyebrow, breadcrumb, actions, filters, children,
  contentPadding, fullBleed,
}: Props) {
  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--admin-bg)' }}>

      {breadcrumb && (
        <div className="border-b flex-shrink-0"
          style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
          <div className="px-6 lg:px-8 h-11 flex items-center gap-2 text-sm">
            {breadcrumb}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b flex-shrink-0"
        style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <div className="px-6 lg:px-8 py-5 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p style={{
                color: 'var(--admin-gold)', fontSize: 11,
                letterSpacing: '0.18em', textTransform: 'uppercase',
                fontWeight: 500, marginBottom: 4,
              }}>{eyebrow}</p>
            )}
            <h1 className="text-2xl font-bold leading-tight truncate"
              style={{ color: 'var(--admin-ink)' }}>
              {title}
            </h1>
            {subtitle != null && (
              <div className="text-sm mt-1" style={{ color: 'var(--admin-ink-mute)' }}>
                {subtitle}
              </div>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {actions}
            </div>
          )}
        </div>
      </header>

      {/* Filters strip */}
      {filters && (
        <div className="border-b flex-shrink-0"
          style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
          <div className="px-6 lg:px-8 py-3">
            {filters}
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div className={`flex-1 overflow-y-auto ${fullBleed ? '' : (contentPadding ?? 'px-6 lg:px-8 py-6')}`}>
        {children}
      </div>
    </div>
  )
}
