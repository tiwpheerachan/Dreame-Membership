'use client'
import { useEffect, useState, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Tap-to-view photo gallery for a branch on the /branches page.
 * Renders a horizontal strip of thumbnails; tapping one opens a full-screen
 * lightbox that can be swiped/paged through all the branch's photos.
 */
export default function BranchGallery({ images, name }: { images: string[]; name: string }) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)

  const close = useCallback(() => setOpen(false), [])
  const next = useCallback(() => setIndex(i => (i + 1) % images.length), [images.length])
  const prev = useCallback(() => setIndex(i => (i - 1 + images.length) % images.length), [images.length])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, close, next, prev])

  if (!images || images.length < 2) return null

  function openAt(i: number) { setIndex(i); setOpen(true) }

  return (
    <>
      {/* Thumbnail strip */}
      <div style={{
        display: 'flex', gap: 8, overflowX: 'auto',
        paddingBottom: 2, scrollSnapType: 'x mandatory',
      }}>
        {images.map((src, i) => (
          <button key={src + i} onClick={() => openAt(i)} className="tap"
            style={{
              flexShrink: 0, width: 76, height: 76,
              borderRadius: 'var(--r-md)', overflow: 'hidden',
              border: '1px solid var(--hair)', padding: 0, cursor: 'pointer',
              background: '#000', scrollSnapAlign: 'start',
            }}
            aria-label={`ดูรูปสาขา ${name} รูปที่ ${i + 1}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`${name} ${i + 1}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {open && (
        <div
          onClick={close}
          className="lightbox-fade"
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(10,9,8,0.94)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
          role="dialog" aria-modal="true" aria-label={`รูปภาพสาขา ${name}`}
        >
          {/* Close */}
          <button onClick={close} aria-label="ปิด"
            style={{
              position: 'absolute', top: 'calc(env(safe-area-inset-top) + 14px)', right: 14,
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.2)',
              backdropFilter: 'blur(10px)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            }}>
            <X size={18} />
          </button>

          {/* Image — key on index so the pop animation replays on each change */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={index}
            src={images[index]} alt={`${name} ${index + 1}`}
            onClick={e => e.stopPropagation()}
            className="lightbox-pop"
            style={{ maxWidth: '100%', maxHeight: '82vh', objectFit: 'contain', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
          />

          {/* Prev / Next */}
          {images.length > 1 && (
            <>
              <NavArrow side="left"  onClick={(e) => { e.stopPropagation(); prev() }} />
              <NavArrow side="right" onClick={(e) => { e.stopPropagation(); next() }} />
            </>
          )}

          {/* Counter */}
          <span style={{
            position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom) + 18px)', left: '50%',
            transform: 'translateX(-50%)',
            padding: '5px 13px', borderRadius: 'var(--r-pill)',
            background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.2)',
            backdropFilter: 'blur(10px)',
            color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
          }}>
            {index + 1} / {images.length}
          </span>
        </div>
      )}
    </>
  )
}

function NavArrow({ side, onClick }: { side: 'left' | 'right'; onClick: (e: React.MouseEvent) => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button onClick={onClick} aria-label={side === 'left' ? 'ก่อนหน้า' : 'ถัดไป'}
      style={{
        position: 'absolute', top: '50%', transform: 'translateY(-50%)',
        [side]: 12,
        width: 44, height: 44, borderRadius: '50%',
        background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.2)',
        backdropFilter: 'blur(10px)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
      }}>
      <Icon size={22} />
    </button>
  )
}
