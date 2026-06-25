'use client'
import { CSSProperties, ReactNode } from 'react'

type Tone = 'new' | 'hot' | 'popular' | 'recommend'

const tones: Record<Tone, { bg: string; fg: string }> = {
  new:       { bg: 'var(--accent)',    fg: '#fff' },
  hot:       { bg: 'var(--red)',       fg: '#fff' },
  popular:   { bg: 'var(--secondary)', fg: '#7A5A00' },
  recommend: { bg: 'var(--mint)',      fg: '#0C5446' },
}

interface BadgeProps {
  children: ReactNode
  tone?: Tone
  style?: CSSProperties
}

export function Badge({ children, tone = 'new', style }: BadgeProps) {
  const c = tones[tone]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', background: c.bg, color: c.fg,
      fontSize: 11, fontWeight: 700, lineHeight: 1.4, padding: '3px 8px', borderRadius: 7, fontFamily: 'inherit',
      ...style,
    }}>
      {children}
    </span>
  )
}
