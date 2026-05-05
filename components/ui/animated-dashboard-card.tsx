'use client'

import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { StarButton } from '@/components/ui/star-button'

export interface MembershipDashboardCardProps {
  // Data
  availablePoints: number
  lifetimePoints: number
  tierLabel: string                 // "Silver" / "Gold" / "Platinum"
  nextTierLabel?: string | null     // null when already at the top tier
  progressPct: number               // 0–100 (toward next tier)
  pointsNeeded: number              // pts remaining to next tier
  toPoints: number                  // threshold of next tier (e.g. 80)
  fromPoints?: number               // threshold of current tier (e.g. 0); used for the "from" label

  // Theming
  pointsColor?: string              // ring + accent for "available points" half (default Dreame blue)
  tierColor?: string                // ring + accent for "tier progress" half (default Dreame green)

  // Dots configuration
  outerDotsCount?: number
  innerDotsCount?: number

  // Animation controls
  enableAnimations?: boolean

  // CTA
  detailsHref?: string
  detailsLabel?: string
  onMoreDetails?: () => void
}

const defaultProps = {
  pointsColor: '#5A8CEF',
  tierColor: '#4B7A63',
  outerDotsCount: 48,
  innerDotsCount: 36,
  enableAnimations: true,
  detailsLabel: 'ดูรายละเอียด',
}

// (cx, cy) of each dot on a ring
function generateDots(count: number, radius: number, centerX: number, centerY: number) {
  const dots = []
  // Start from top (-π/2) so the "filled" arc grows clockwise from 12 o'clock
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2
    const x = Math.round((centerX + radius * Math.cos(angle)) * 1000) / 1000
    const y = Math.round((centerY + radius * Math.sin(angle)) * 1000) / 1000
    dots.push({ x, y, angle, delay: i * 0.02 })
  }
  return dots
}

export function MembershipDashboardCard(props: MembershipDashboardCardProps) {
  const p = { ...defaultProps, ...props }
  const {
    availablePoints, lifetimePoints,
    tierLabel, nextTierLabel,
    progressPct, pointsNeeded, toPoints,
    pointsColor, tierColor,
    outerDotsCount, innerDotsCount,
    enableAnimations,
    detailsHref, detailsLabel, onMoreDetails,
  } = p

  const shouldReduceMotion = useReducedMotion()
  const shouldAnimate = enableAnimations && !shouldReduceMotion

  const outerDots = generateDots(outerDotsCount, 185, 224, 200)
  const innerDots = generateDots(innerDotsCount, 155, 224, 200)

  // How many dots in each ring should be "lit" to show progress
  const progress01 = Math.max(0, Math.min(1, progressPct / 100))
  const litOuter = Math.round(outerDotsCount * progress01)
  const litInner = Math.round(innerDotsCount * progress01)

  const containerVariants: Variants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
      opacity: 1, y: 0, scale: 1,
      transition: {
        type: 'spring', stiffness: 300, damping: 30,
        staggerChildren: 0.04, delayChildren: 0.08,
      },
    },
  }

  const dotVariants: Variants = {
    hidden: { opacity: 0, scale: 0 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: 'easeOut' } },
  }

  return (
    <motion.div
      className="w-full"
      initial={shouldAnimate ? 'hidden' : 'visible'}
      animate="visible"
      variants={shouldAnimate ? containerVariants : {}}
    >
      <motion.div
        className="rounded-2xl overflow-hidden shadow-[0_8px_24px_rgba(14,14,14,0.06)]"
        style={{
          background: '#fff',
          border: '1px solid rgba(14,14,14,0.08)',
        }}
      >
        {/* ── Dot-ring visualization ── */}
        <div className="relative px-4 pt-6 pb-3 overflow-hidden">
          <div className="relative w-full mx-auto" style={{ aspectRatio: '1 / 1', maxWidth: 360 }}>
            <svg className="w-full h-full" viewBox="0 0 448 400">
              {/* Outer ring — represents the journey to the next tier */}
              {outerDots.map((dot, index) => {
                const lit = index < litOuter
                return (
                  <motion.circle
                    key={`outer-${index}`}
                    cx={dot.x}
                    cy={dot.y}
                    r={lit ? 8 : 6}
                    fill={lit ? pointsColor : pointsColor}
                    style={{ opacity: lit ? 1 : 0.18 }}
                    variants={shouldAnimate ? dotVariants : {}}
                    initial="hidden"
                    animate="visible"
                  />
                )
              })}

              {/* Inner ring — same progress, different color (tier ladder) */}
              {innerDots.map((dot, index) => {
                const lit = index < litInner
                return (
                  <motion.circle
                    key={`inner-${index}`}
                    cx={dot.x}
                    cy={dot.y}
                    r={lit ? 8 : 6}
                    fill={tierColor}
                    style={{ opacity: lit ? 1 : 0.16 }}
                    variants={shouldAnimate ? dotVariants : {}}
                    initial="hidden"
                    animate="visible"
                  />
                )
              })}
            </svg>

            {/* Center label — TOTAL POINTS */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center" style={{ zIndex: 20, transform: 'translateY(-6%)' }}>
                <motion.div
                  className="font-semibold tracking-[0.18em] uppercase"
                  style={{ fontSize: 11, color: 'var(--ink-mute)' }}
                  initial={shouldAnimate ? { opacity: 0, y: -10, scale: 0.95 } : {}}
                  animate={shouldAnimate ? { opacity: 1, y: 0, scale: 1 } : {}}
                  transition={{ delay: 0.25, type: 'spring', stiffness: 400, damping: 25 }}
                >
                  Available Points
                </motion.div>
                <motion.div
                  className="font-extrabold leading-none tnum"
                  style={{ fontSize: 48, color: 'var(--ink)', marginTop: 6 }}
                  initial={shouldAnimate ? { opacity: 0, y: 18, scale: 0.85, filter: 'blur(4px)' } : {}}
                  animate={shouldAnimate ? { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' } : {}}
                  transition={{ delay: 0.45, type: 'spring', stiffness: 300, damping: 28 }}
                >
                  {availablePoints.toLocaleString()}
                </motion.div>
                <motion.div
                  className="tnum"
                  style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 6 }}
                  initial={shouldAnimate ? { opacity: 0 } : {}}
                  animate={shouldAnimate ? { opacity: 1 } : {}}
                  transition={{ delay: 0.7 }}
                >
                  Lifetime · {lifetimePoints.toLocaleString()} pts
                </motion.div>
              </div>
            </div>

            {/* Soft fade — bottom half is mostly numbers, hide the ring's lower half */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(to bottom, transparent 0%, transparent 55%, rgba(255,255,255,0.85) 78%, #fff 92%)',
                zIndex: 5,
              }}
            />
          </div>

          {/* ── Bottom strip — tier transition + percent ── */}
          <div className="relative px-2 pt-1" style={{ zIndex: 10 }}>
            <div className="flex items-start justify-between gap-3">
              {/* Current tier */}
              <div className="flex flex-col items-start gap-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <motion.div
                    className="rounded-full"
                    style={{ width: 3, height: 16, backgroundColor: pointsColor }}
                    initial={shouldAnimate ? { opacity: 0, scaleY: 0 } : {}}
                    animate={shouldAnimate ? { opacity: 1, scaleY: 1 } : {}}
                    transition={{ delay: 0.5, type: 'spring' }}
                  />
                  <motion.div
                    className="font-medium uppercase tracking-wider"
                    style={{ fontSize: 10.5, color: 'var(--ink-mute)' }}
                    initial={shouldAnimate ? { opacity: 0, y: 8 } : {}}
                    animate={shouldAnimate ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.55 }}
                  >
                    Current
                  </motion.div>
                </div>
                <motion.div
                  className="font-extrabold"
                  style={{ fontSize: 18, color: 'var(--ink)' }}
                  initial={shouldAnimate ? { opacity: 0, y: -8 } : {}}
                  animate={shouldAnimate ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.6 }}
                >
                  {tierLabel}
                </motion.div>
              </div>

              {/* Progress percent in the middle */}
              <div className="flex flex-col items-center gap-1">
                <motion.div
                  className="font-extrabold tnum leading-none"
                  style={{ fontSize: 28, color: '#FF8A3D' }}
                  initial={shouldAnimate ? { opacity: 0, scale: 0.8 } : {}}
                  animate={shouldAnimate ? { opacity: 1, scale: 1 } : {}}
                  transition={{ delay: 0.55, type: 'spring', stiffness: 320, damping: 22 }}
                >
                  {Math.round(progressPct)}%
                </motion.div>
                <motion.div
                  className="font-medium uppercase tracking-wider"
                  style={{ fontSize: 9.5, color: 'var(--ink-mute)' }}
                  initial={shouldAnimate ? { opacity: 0 } : {}}
                  animate={shouldAnimate ? { opacity: 1 } : {}}
                  transition={{ delay: 0.7 }}
                >
                  Progress
                </motion.div>
              </div>

              {/* Next tier */}
              <div className="flex flex-col items-end gap-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <motion.div
                    className="font-medium uppercase tracking-wider"
                    style={{ fontSize: 10.5, color: 'var(--ink-mute)' }}
                    initial={shouldAnimate ? { opacity: 0, y: 8 } : {}}
                    animate={shouldAnimate ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.65 }}
                  >
                    {nextTierLabel ? 'Next' : 'Top'}
                  </motion.div>
                  <motion.div
                    className="rounded-full"
                    style={{ width: 3, height: 16, backgroundColor: tierColor }}
                    initial={shouldAnimate ? { opacity: 0, scaleY: 0 } : {}}
                    animate={shouldAnimate ? { opacity: 1, scaleY: 1 } : {}}
                    transition={{ delay: 0.7, type: 'spring' }}
                  />
                </div>
                <motion.div
                  className="font-extrabold"
                  style={{ fontSize: 18, color: nextTierLabel ? 'var(--ink)' : '#FF8A3D' }}
                  initial={shouldAnimate ? { opacity: 0, y: -8 } : {}}
                  animate={shouldAnimate ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.75 }}
                >
                  {nextTierLabel || 'Maxed'}
                </motion.div>
              </div>
            </div>

            {/* Points-needed star button (only when there's a next tier) */}
            {nextTierLabel && (
              <motion.div
                className="flex justify-center mt-3 mb-3"
                initial={shouldAnimate ? { opacity: 0, y: 10 } : {}}
                animate={shouldAnimate ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.85 }}
              >
                <StarButton
                  type="button"
                  tabIndex={-1}
                  duration={3}
                  borderWidth={1.5}
                  // Light-mode look: white starry surface + warm amber streak.
                  // The streak needs to stay punchy enough to be visible on white.
                  lightColor="#FF2056"
                  backgroundColor="#FFFFFF"
                  className="h-9 px-5 text-[12.5px] cursor-default"
                >
                  <span>อีก</span>
                  <span className="tnum font-extrabold">{pointsNeeded.toLocaleString()}</span>
                  <span>pts ถึง {toPoints.toLocaleString()} pts</span>
                </StarButton>
              </motion.div>
            )}

            {/* CTA */}
            {(detailsHref || onMoreDetails) && (
              <motion.div
                initial={shouldAnimate ? { opacity: 0, y: 16 } : {}}
                animate={shouldAnimate ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 1 }}
                whileHover={shouldAnimate ? { scale: 1.02 } : {}}
                whileTap={shouldAnimate ? { scale: 0.98 } : {}}
                className="mb-3"
              >
                {detailsHref ? (
                  <a
                    href={detailsHref}
                    className="block w-full text-center rounded-xl font-medium px-4 py-2.5"
                    style={{
                      border: '1px solid rgba(14,14,14,0.10)',
                      color: 'var(--ink)',
                      fontSize: 13,
                      textDecoration: 'none',
                      background: '#fff',
                    }}
                  >
                    {detailsLabel}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={onMoreDetails}
                    className="w-full rounded-xl font-medium px-4 py-2.5"
                    style={{
                      border: '1px solid rgba(14,14,14,0.10)',
                      color: 'var(--ink)',
                      fontSize: 13,
                      background: '#fff',
                    }}
                  >
                    {detailsLabel}
                  </button>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default MembershipDashboardCard
