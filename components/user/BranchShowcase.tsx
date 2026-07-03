import Link from 'next/link'
import { MapPin, Navigation, Clock, ChevronRight, Store } from 'lucide-react'
import type { Branch } from '@/types'

/**
 * Home-page carousel of store branches ("รวมสาขาของเรา").
 * Each card shows the branch photo, a name tag pinned to the top-right,
 * an optional highlight badge and a "นำทาง" button linking to Google Maps.
 */
export default function BranchShowcase({ branches }: { branches: Branch[] }) {
  if (!branches || branches.length === 0) return null

  return (
    <section style={{ padding: '24px 0 8px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 16px 14px 4px' }}>
        <h2 className="display" style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
          รวมสาขา<span className="gold-text">ของเรา</span>
        </h2>
        <Link href="/branches" style={{
          fontSize: 11, color: 'var(--ink)', textDecoration: 'none',
          fontWeight: 700, letterSpacing: '0.06em',
          display: 'flex', alignItems: 'center', gap: 2, textTransform: 'uppercase',
        }}>
          ดูทั้งหมด <ChevronRight size={13} />
        </Link>
      </div>

      <div style={{
        display: 'flex', gap: 12, overflowX: 'auto',
        paddingBottom: 4, paddingRight: 16,
        scrollSnapType: 'x mandatory',
      }}>
        {branches.map(b => <BranchMiniCard key={b.id} branch={b} />)}
      </div>
    </section>
  )
}

function BranchMiniCard({ branch }: { branch: Branch }) {
  const hasMap = !!branch.map_url
  const Wrapper = hasMap ? 'a' : 'div'

  return (
    <Wrapper
      {...(hasMap ? { href: branch.map_url as string, target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="tap"
      style={{
        flexShrink: 0, width: 232, scrollSnapAlign: 'start',
        position: 'relative', display: 'block',
        borderRadius: 'var(--r-lg)', overflow: 'hidden',
        aspectRatio: '4/5', background: '#000',
        textDecoration: 'none', color: 'inherit',
        boxShadow: '0 6px 20px rgba(20,18,15,0.12), 0 1px 3px rgba(20,18,15,0.06)',
      }}
      aria-label={`สาขา ${branch.name}`}
    >
      {/* Photo */}
      {branch.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={branch.image_url} alt={branch.name}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg,#2A2620,#4A3A1E,#A0782B)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)',
        }}>
          <Store size={40} strokeWidth={1.2} />
        </div>
      )}

      {/* Bottom gradient for text legibility */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0) 38%, rgba(0,0,0,0.28) 62%, rgba(0,0,0,0.82) 100%)',
      }} />

      {/* Top-right: branch name tag */}
      <span style={{
        position: 'absolute', top: 10, right: 10,
        maxWidth: 'calc(100% - 20px)',
        padding: '5px 11px', borderRadius: 'var(--r-pill)',
        background: 'rgba(20,18,15,0.55)',
        backdropFilter: 'blur(12px) saturate(160%)',
        WebkitBackdropFilter: 'blur(12px) saturate(160%)',
        border: '1px solid rgba(255,255,255,0.25)',
        color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: '0.01em',
        display: 'inline-flex', alignItems: 'center', gap: 4,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
      }}>
        <MapPin size={11} strokeWidth={2.4} /> {branch.name}
      </span>

      {/* Top-left: highlight badge */}
      {branch.badge_text && (
        <span style={{
          position: 'absolute', top: 10, left: 10,
          padding: '4px 9px', borderRadius: 'var(--r-pill)',
          background: 'linear-gradient(135deg,#FAF3DC,#EADBB1,#C9A063)',
          color: '#1a1815', fontSize: 9, fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}>
          {branch.badge_text}
        </span>
      )}

      {/* Bottom content */}
      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
        {branch.address && (
          <p style={{
            margin: '0 0 8px', fontSize: 11, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
          }}>
            {branch.address}
          </p>
        )}
        {branch.hours && (
          <p style={{ margin: '0 0 8px', fontSize: 10, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={10} /> {branch.hours}
          </p>
        )}
        {hasMap && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '7px 13px', borderRadius: 'var(--r-pill)',
            background: 'rgba(255,255,255,0.95)',
            color: '#1a1815', fontSize: 11.5, fontWeight: 800,
            boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          }}>
            <Navigation size={12} strokeWidth={2.4} /> นำทาง
          </span>
        )}
      </div>
    </Wrapper>
  )
}
