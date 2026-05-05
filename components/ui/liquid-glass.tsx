'use client'

import React from 'react'

interface GlassEffectProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  href?: string
  target?: string
  /**
   * Border-radius applied to every layer. Use a real CSS value rather than a
   * Tailwind class so the inner blur layers can match exactly.
   * @default '24px'
   */
  radius?: string | number
}

/**
 * Translucent, frosted "liquid glass" wrapper.
 *
 * Stacks four layers inside the same border-radius:
 *   1. backdrop-blur + SVG distortion (uses #glass-distortion — render
 *      <GlassFilter /> once at the top of the page or inside this wrapper)
 *   2. translucent white tint
 *   3. inner highlight ring (gives the "polished glass" rim)
 *   4. content
 */
export const GlassEffect: React.FC<GlassEffectProps> = ({
  children,
  className = '',
  style = {},
  href,
  target = '_self',
  radius = '24px',
}) => {
  const r = typeof radius === 'number' ? `${radius}px` : radius

  const wrapperStyle: React.CSSProperties = {
    boxShadow: '0 6px 6px rgba(0, 0, 0, 0.18), 0 0 20px rgba(0, 0, 0, 0.10)',
    transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 2.2)',
    borderRadius: r,
    ...style,
  }

  const content = (
    <div
      className={`relative flex overflow-hidden cursor-pointer transition-all duration-700 ${className}`}
      style={wrapperStyle}
    >
      {/* Layer 1: distorted backdrop-blur */}
      <div
        className="absolute inset-0 z-0 overflow-hidden"
        style={{
          borderRadius: r,
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          filter: 'url(#glass-distortion)',
          isolation: 'isolate',
        }}
      />
      {/* Layer 2: translucent tint */}
      <div
        className="absolute inset-0 z-10"
        style={{
          borderRadius: r,
          background: 'rgba(255, 255, 255, 0.25)',
        }}
      />
      {/* Layer 3: inner highlight rim */}
      <div
        className="absolute inset-0 z-20 overflow-hidden"
        style={{
          borderRadius: r,
          boxShadow:
            'inset 2px 2px 1px 0 rgba(255, 255, 255, 0.5), inset -1px -1px 1px 1px rgba(255, 255, 255, 0.5)',
        }}
      />
      {/* Layer 4: content */}
      <div className="relative z-30 w-full">{children}</div>
    </div>
  )

  return href ? (
    <a href={href} target={target} rel="noopener noreferrer" className="block">
      {content}
    </a>
  ) : (
    content
  )
}

/**
 * The SVG filter that powers the glass distortion. Mount once per page —
 * extra copies are harmless but wasteful.
 */
export const GlassFilter: React.FC = () => (
  <svg style={{ display: 'none' }} aria-hidden>
    <filter
      id="glass-distortion"
      x="0%"
      y="0%"
      width="100%"
      height="100%"
      filterUnits="objectBoundingBox"
    >
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.001 0.005"
        numOctaves="1"
        seed="17"
        result="turbulence"
      />
      <feComponentTransfer in="turbulence" result="mapped">
        <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
        <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
        <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
      </feComponentTransfer>
      <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
      <feSpecularLighting
        in="softMap"
        surfaceScale="5"
        specularConstant="1"
        specularExponent="100"
        lightingColor="white"
        result="specLight"
      >
        <fePointLight x="-200" y="-200" z="300" />
      </feSpecularLighting>
      <feComposite
        in="specLight"
        operator="arithmetic"
        k1="0"
        k2="1"
        k3="1"
        k4="0"
        result="litImage"
      />
      <feDisplacementMap
        in="SourceGraphic"
        in2="softMap"
        scale="200"
        xChannelSelector="R"
        yChannelSelector="G"
      />
    </filter>
  </svg>
)

export default GlassEffect
