'use client'
import { CSSProperties, ReactNode } from 'react'

type Tone = 'coral' | 'lavender' | 'mint' | 'blue' | 'yellow' | 'gray'

const tones: Record<Tone, { bg: string; fg: string }> = {
  coral:    { bg: '#FFEDE6', fg: '#A23E18' },
  lavender: { bg: '#F0ECFF', fg: '#5A43B5' },
  mint:     { bg: '#E1F7F2', fg: '#0E7A63' },
  blue:     { bg: '#E8F4FF', fg: '#1A5F95' },
  yellow:   { bg: '#FFF3D6', fg: '#835700' },
  gray:     { bg: '#F1EFEA', fg: '#5F5E5A' },
}

interface ChipProps {
  children: ReactNode
  tone?: Tone
  onClick?: () => void
  style?: CSSProperties
}

export function Chip({ children, tone = 'coral', onClick, style }: ChipProps) {
  const c = tones[tone]
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: c.bg,
        color: c.fg,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: 'inherit',
        padding: '4px 14px',
        borderRadius: 9999,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </span>
  )
}
