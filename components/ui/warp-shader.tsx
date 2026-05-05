'use client'
import { Warp } from '@paper-design/shaders-react'

export type WarpShaderColors = [string, string, string, string]

interface WarpShaderProps {
  colors?: WarpShaderColors
  speed?: number
  swirl?: number
  swirlIterations?: number
  proportion?: number
  softness?: number
  distortion?: number
  shapeScale?: number
  scale?: number
  rotation?: number
  shape?: 'checks' | 'stripes' | 'edge'
  className?: string
  style?: React.CSSProperties
}

export default function WarpShader({
  colors = [
    'hsl(200, 100%, 20%)',
    'hsl(160, 100%, 75%)',
    'hsl(180, 90%, 30%)',
    'hsl(170, 100%, 80%)',
  ],
  speed = 1,
  swirl = 0.8,
  swirlIterations = 10,
  proportion = 0.45,
  softness = 1,
  distortion = 0.25,
  shapeScale = 0.1,
  scale = 1,
  rotation = 0,
  shape = 'checks',
  className,
  style,
}: WarpShaderProps) {
  return (
    <Warp
      className={className}
      style={{ height: '100%', width: '100%', ...style }}
      proportion={proportion}
      softness={softness}
      distortion={distortion}
      swirl={swirl}
      swirlIterations={swirlIterations}
      shape={shape}
      shapeScale={shapeScale}
      scale={scale}
      rotation={rotation}
      speed={speed}
      colors={colors}
    />
  )
}
