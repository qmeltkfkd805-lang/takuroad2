'use client'
import { CSSProperties, ReactNode } from 'react'

type Tone = 'coral' | 'mint' | 'yellow' | 'lavender' | 'blue' | 'gray'

const toneBg: Record<Tone, string> = {
  coral:    '#FFEDE6',
  mint:     '#E1F7F2',
  yellow:   '#FFF3D6',
  lavender: '#F0ECFF',
  blue:     '#E8F4FF',
  gray:     '#F1EFEA',
}

interface SectionHeaderProps {
  title: string
  icon?: ReactNode
  tone?: Tone
  actionLabel?: string
  onAction?: () => void
  plainIcon?: boolean
  style?: CSSProperties
}

export function SectionHeader({ title, icon, tone = 'coral', actionLabel, onAction, plainIcon, style }: SectionHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        {icon != null && (
          plainIcon ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
          ) : (
            <span style={{ width: 34, height: 34, borderRadius: 11, background: toneBg[tone], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {icon}
            </span>
          )
        )}
        <span style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)' }}>{title}</span>
      </div>
      {actionLabel && (
        <button onClick={onAction} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--muted)', fontFamily: 'inherit' }}>
          {actionLabel} ›
        </button>
      )}
    </div>
  )
}
