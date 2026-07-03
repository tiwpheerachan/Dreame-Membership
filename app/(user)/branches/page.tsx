import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Store, MapPin, Navigation, Clock, Phone } from 'lucide-react'
import type { Branch } from '@/types'
import BranchGallery from '@/components/user/BranchGallery'
import BackButton from '@/components/user/BackButton'

export default async function BranchesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Public marketing content — bypass RLS via the service client so the list
  // renders even when RLS policies aren't applied on the production DB.
  const service = createServiceClient()
  const { data: branches, error } = await service
    .from('branches')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) console.error('[branches] query failed:', error)

  const list = (branches || []) as Branch[]
  const isEmpty = list.length === 0

  return (
    <div className="page-enter" style={{ paddingTop: 18, background: '#fff', minHeight: '100vh' }}>
      <header style={{ padding: '14px 20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <BackButton />
          <p className="kicker" style={{ margin: 0 }}>Our Stores</p>
        </div>
        <h1 className="display" style={{ margin: 0, fontSize: 30, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
          <span style={{ fontWeight: 800 }}>รวมสาขา</span>{' '}
          <span className="serif-i" style={{ fontWeight: 400 }}>ของเรา</span>
        </h1>
        {!isEmpty && (
          <p className="serif-i" style={{ fontSize: 12, color: 'var(--ink-mute)', margin: '8px 0 0' }}>
            {list.length} สาขาพร้อมให้บริการ · แตะเพื่อนำทางไปยังร้าน
          </p>
        )}
      </header>

      {isEmpty ? (
        <div style={{ padding: '0 16px' }}>
          <div className="card-product" style={{ overflow: 'hidden', padding: '60px 28px', textAlign: 'center' }}>
            <div style={{
              width: 72, height: 72, margin: '0 auto 18px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg,var(--gold-glow),var(--gold-pale))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--gold-deep)',
              boxShadow: '0 8px 24px rgba(160,120,43,0.15)',
            }}>
              <Store size={28} strokeWidth={1.4} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 800 }}>
              ยังไม่มี<span className="serif-i" style={{ fontWeight: 400 }}>ข้อมูลสาขา</span>
            </h3>
            <p className="serif-i" style={{ fontSize: 12.5, color: 'var(--ink-mute)', margin: 0, lineHeight: 1.7, maxWidth: 280, marginInline: 'auto' }}>
              กลับมาดูใหม่เร็ว ๆ นี้ — เรากำลังขยายสาขาเพิ่มเติม
            </p>
          </div>
        </div>
      ) : (
        <div style={{ padding: '0 16px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {list.map(b => <BranchCard key={b.id} branch={b} />)}
        </div>
      )}
    </div>
  )
}

function BranchCard({ branch }: { branch: Branch }) {
  // Lightbox photo set: cover first, then the gallery (deduped, non-empty).
  const galleryImages = [branch.image_url, ...(branch.gallery_urls || [])]
    .filter((u): u is string => !!u)
    .filter((u, i, arr) => arr.indexOf(u) === i)

  return (
    <article className="card" style={{ overflow: 'hidden', padding: 0 }}>
      {/* Photo with name tag — fixed 16/9 so every card's cover is identical */}
      <div style={{
        position: 'relative', aspectRatio: '16 / 9', background: '#000',
        borderTopLeftRadius: 'var(--r-lg)', borderTopRightRadius: 'var(--r-lg)', overflow: 'hidden',
      }}>
        {branch.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branch.image_url} alt={branch.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(135deg,#2A2620,#4A3A1E,#A0782B)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)',
          }}>
            <Store size={44} strokeWidth={1.2} />
          </div>
        )}

        {/* Top-right: branch name tag */}
        <span style={{
          position: 'absolute', top: 12, right: 12,
          maxWidth: 'calc(100% - 24px)',
          padding: '6px 13px', borderRadius: 'var(--r-pill)',
          background: 'rgba(20,18,15,0.55)',
          backdropFilter: 'blur(12px) saturate(160%)',
          WebkitBackdropFilter: 'blur(12px) saturate(160%)',
          border: '1px solid rgba(255,255,255,0.25)',
          color: '#fff', fontSize: 12.5, fontWeight: 800,
          display: 'inline-flex', alignItems: 'center', gap: 5,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          boxShadow: '0 2px 12px rgba(0,0,0,0.28)',
        }}>
          <MapPin size={12} strokeWidth={2.4} /> {branch.name}
        </span>

        {branch.badge_text && (
          <span style={{
            position: 'absolute', top: 12, left: 12,
            padding: '5px 11px', borderRadius: 'var(--r-pill)',
            background: 'linear-gradient(135deg,#FAF3DC,#EADBB1,#C9A063)',
            color: '#1a1815', fontSize: 10, fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase',
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
          }}>
            {branch.badge_text}
          </span>
        )}
      </div>

      {/* Details */}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{branch.name}</h3>
          {branch.address && (
            <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--ink-mute)', lineHeight: 1.6, display: 'flex', gap: 6 }}>
              <MapPin size={14} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 2, color: 'var(--gold-deep)' }} />
              <span>{branch.address}</span>
            </p>
          )}
        </div>

        {(branch.hours || branch.phone) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: 12, color: 'var(--ink-mute)' }}>
            {branch.hours && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Clock size={13} strokeWidth={1.8} /> {branch.hours}
              </span>
            )}
            {branch.phone && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Phone size={13} strokeWidth={1.8} /> {branch.phone}
              </span>
            )}
          </div>
        )}

        {/* Photo gallery — thumbnails open a full-screen viewer */}
        {galleryImages.length > 1 && (
          <BranchGallery images={galleryImages} name={branch.name} />
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          {branch.map_url && (
            <a href={branch.map_url} target="_blank" rel="noopener noreferrer" className="tap"
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '11px 14px', borderRadius: 'var(--r-pill)',
                background: 'linear-gradient(180deg, #2A2620 0%, #1A1815 100%)',
                color: 'var(--gold-soft)', fontSize: 13, fontWeight: 800, textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(20,18,15,0.25)',
              }}>
              <Navigation size={14} strokeWidth={2.2} /> นำทาง
            </a>
          )}
          {branch.phone && (
            <a href={`tel:${branch.phone.replace(/[^0-9+]/g, '')}`} className="tap"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '11px 16px', borderRadius: 'var(--r-pill)',
                background: 'var(--bg-soft)', border: '1px solid var(--hair)',
                color: 'var(--ink)', fontSize: 13, fontWeight: 700, textDecoration: 'none',
              }}>
              <Phone size={14} strokeWidth={2.2} /> โทร
            </a>
          )}
        </div>
      </div>
    </article>
  )
}
