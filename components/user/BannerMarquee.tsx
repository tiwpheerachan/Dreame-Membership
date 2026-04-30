'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Promotion } from '@/types'

interface Props {
  banners: Promotion[]
  /** Aspect ratio (W/H). Default 12:5 — matches Dreame's standard wide
   *  brand banner format (1920×800). */
  aspect?: string
  /** Pixels per second. Higher = faster. */
  speed?: number
  /** Gap between items in px. Set to 0 for slideshow-style flush items. */
  gap?: number
  /** Width of the blurred edge strip in px. */
  edgeBlur?: number
  /** Show prev/next arrows when there are 2+ banners. */
  showArrows?: boolean
  /** Fraction of the container width each item should occupy.
   *  1.0 = exactly one item visible (slideshow). 0.92 leaves a peek of the
   *  neighbouring item, which looks more "marquee-y". */
  itemWidthRatio?: number
}

export default function BannerMarquee({
  banners,
  aspect = '12/5',
  speed = 60,
  gap = 8,
  edgeBlur = 28,
  showArrows = true,
  itemWidthRatio = 0.94,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(0)
  const pausedRef = useRef(false)
  const hoveredRef = useRef(false)

  // Measure the container so item width tracks the available space —
  // matches the look of PromoHero (full-width, 16/11 aspect).
  const [containerWidth, setContainerWidth] = useState(0)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setContainerWidth(el.offsetWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const itemWidth = Math.max(0, Math.round(containerWidth * itemWidthRatio))

  // Doubled list for seamless loop: translateX(-cycle) lands on identical content.
  const list = useMemo(() => [...banners, ...banners], [banners])

  // Auto-scroll loop. Skip if there's only one banner OR we haven't measured yet.
  useEffect(() => {
    if (banners.length < 2 || itemWidth === 0) return
    const cycle = banners.length * (itemWidth + gap)
    let last = performance.now()
    let raf = 0

    function tick(now: number) {
      const dt = now - last
      last = now
      const track = trackRef.current
      if (track && !pausedRef.current && !hoveredRef.current) {
        offsetRef.current += (speed * dt) / 1000
        if (offsetRef.current >= cycle) offsetRef.current -= cycle
        track.style.transform = `translate3d(-${offsetRef.current}px, 0, 0)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [banners.length, itemWidth, gap, speed])

  // Step exactly one banner. Auto-scroll pauses for the duration of the
  // CSS transition and resumes after.
  function nudge(direction: -1 | 1) {
    const track = trackRef.current
    if (!track || banners.length < 2 || itemWidth === 0) return
    const cycle = banners.length * (itemWidth + gap)
    pausedRef.current = true

    let target = offsetRef.current + direction * (itemWidth + gap)
    if (target < 0) {
      offsetRef.current += cycle
      target += cycle
      track.style.transition = 'none'
      track.style.transform = `translate3d(-${offsetRef.current}px, 0, 0)`
      void track.offsetWidth
    }

    track.style.transition = 'transform 0.45s cubic-bezier(0.32, 0.72, 0, 1)'
    track.style.transform = `translate3d(-${target}px, 0, 0)`
    offsetRef.current = target

    window.setTimeout(() => {
      const t = trackRef.current
      if (!t) return
      if (offsetRef.current >= cycle) {
        offsetRef.current -= cycle
        t.style.transition = 'none'
        t.style.transform = `translate3d(-${offsetRef.current}px, 0, 0)`
        void t.offsetWidth
      }
      t.style.transition = ''
      pausedRef.current = false
    }, 500)
  }

  if (banners.length === 0) return null

  // Single banner — render at full container width with natural aspect.
  // (No marquee when there's nothing to scroll between.)
  if (banners.length === 1) {
    return (
      <div ref={containerRef} style={{ width: '100%' }}>
        <BannerItem banner={banners[0]} aspect={aspect} fullWidth />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', overflow: 'hidden', width: '100%' }}
      onMouseEnter={() => { hoveredRef.current = true }}
      onMouseLeave={() => { hoveredRef.current = false }}
    >
      <div
        ref={trackRef}
        style={{
          display: 'flex',
          gap: `${gap}px`,
          width: 'max-content',
          willChange: 'transform',
          transform: 'translate3d(0, 0, 0)',
        }}
      >
        {list.map((b, i) => (
          <BannerItem
            key={`${b.id}-${i}`}
            banner={b}
            width={itemWidth}
            aspect={aspect}
          />
        ))}
      </div>

      {/* Transparent blurred edge strips — fall-off via mask-image so the
          banner appears to dissolve into a frosted edge instead of a hard cut. */}
      <EdgeBlur side="left"  width={edgeBlur} />
      <EdgeBlur side="right" width={edgeBlur} />

      {showArrows && (
        <>
          <ArrowButton side="left"  onClick={() => nudge(-1)} aria-label="Previous">
            <ChevronLeft size={16} strokeWidth={2.4} />
          </ArrowButton>
          <ArrowButton side="right" onClick={() => nudge(1)} aria-label="Next">
            <ChevronRight size={16} strokeWidth={2.4} />
          </ArrowButton>
        </>
      )}
    </div>
  )
}

function EdgeBlur({ side, width }: { side: 'left' | 'right'; width: number }) {
  const sideStyle =
    side === 'left'
      ? { left: 0,  WebkitMaskImage: 'linear-gradient(90deg, black 0%, transparent 100%)', maskImage: 'linear-gradient(90deg, black 0%, transparent 100%)' }
      : { right: 0, WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 100%)', maskImage: 'linear-gradient(90deg, transparent 0%, black 100%)' }
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute', top: 0, bottom: 0, width,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        pointerEvents: 'none',
        zIndex: 2,
        ...sideStyle,
      }}
    />
  )
}

function ArrowButton({
  side, onClick, children, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  side: 'left' | 'right'
  children: React.ReactNode
}) {
  const sideStyle = side === 'left' ? { left: 10 } : { right: 10 }
  return (
    <button
      onClick={onClick}
      {...rest}
      style={{
        position: 'absolute', top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 3,
        width: 34, height: 34, borderRadius: '50%',
        background: 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(14px) saturate(180%)',
        WebkitBackdropFilter: 'blur(14px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.6)',
        boxShadow: '0 4px 14px rgba(20,18,15,0.18), inset 0 1px 0 rgba(255,255,255,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        color: '#1A1815',
        padding: 0,
        ...sideStyle,
      }}
    >
      {children}
    </button>
  )
}

function BannerItem({
  banner, width, aspect, fullWidth = false,
}: {
  banner: Promotion
  width?: number
  aspect: string
  fullWidth?: boolean
}) {
  const isVideo = !!banner.video_url
  const Wrapper = banner.link_url ? 'a' : 'div'

  return (
    <Wrapper
      {...(banner.link_url ? { href: banner.link_url, target: '_blank', rel: 'noopener noreferrer' } : {})}
      style={{
        flexShrink: 0,
        width: fullWidth ? '100%' : width,
        aspectRatio: aspect,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'var(--r-lg)',
        background: '#000',
        boxShadow: '0 6px 20px rgba(20,18,15,0.10), 0 1px 3px rgba(20,18,15,0.06)',
        textDecoration: 'none', color: 'inherit',
        display: 'block',
      }}
      aria-label={banner.title || 'banner'}
    >
      {isVideo && banner.video_url ? (
        <video
          src={banner.video_url}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000' }}
        />
      ) : banner.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={banner.image_url}
          alt={banner.title || 'banner'}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000' }}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          background: 'linear-gradient(135deg,#1A1815,#3A2E18,#A0782B)',
        }} />
      )}
    </Wrapper>
  )
}
