'use client'
import { CSSProperties } from 'react'

interface IconProps {
  name: string
  size?: number
  alt?: string
  style?: CSSProperties
}

export function Icon({ name, size = 24, alt = '', style }: IconProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/icons/${name}.png`}
      width={size}
      height={size}
      alt={alt}
      style={{ display: 'block', objectFit: 'contain', ...style }}
    />
  )
}
