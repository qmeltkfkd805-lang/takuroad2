'use client'
import { CSSProperties } from 'react'

export type TakuPose =
  | 'default' | 'hi' | 'checkin' | 'map' | 'shopping' | 'gacha'
  | 'camera' | 'cafe' | 'walk' | 'run' | 'sit' | 'side' | 'back'
  | 'pay' | 'ui' | 'settings'

interface TakuProps {
  pose?: TakuPose
  size?: number
  alt?: string
  style?: CSSProperties
  className?: string
}

export function Taku({ pose = 'default', size = 120, alt = '', style, className }: TakuProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/taku/taku-${pose}.png`}
      alt={alt}
      aria-hidden={alt ? undefined : 'true'}
      className={className}
      style={{ height: size, width: 'auto', objectFit: 'contain', userSelect: 'none', pointerEvents: 'none', ...style }}
    />
  )
}
