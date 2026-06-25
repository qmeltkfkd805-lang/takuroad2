'use client'
import { CSSProperties, ReactNode } from 'react'

interface SectionHeaderProps {
  title: string
  icon?: ReactNode
  actionLabel?: string
  onAction?: () => void
  style?: CSSProperties
}

export function SectionHeader({ title, icon, actionLabel, onAction, style }: SectionHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        {icon != null && (
          <span style={{
            width: 30, height: 30, borderRadius: 10, background: 'var(--accent-l)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'var(--accent)',
          }}>{icon}</span>
        )}
        <span style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)' }}>{title}</span>
      </div>
      {actionLabel && (
        <button onClick={onAction} style={{
          border: 'none', background: 'transparent', cursor: 'pointer',
          fontSize: 13, fontWeight: 500, color: 'var(--muted)', fontFamily: 'inherit',
        }}>{actionLabel} ›</button>
      )}
    </div>
  )
}
