'use client'
import { CSSProperties, ReactNode } from 'react'
import { Taku, TakuPose } from './Taku'
import { Button } from './Button'

interface EmptyStateAction {
  label: string
  onClick: () => void
}

interface EmptyStateProps {
  title: string
  description?: ReactNode
  pose?: TakuPose
  takuSize?: number
  action?: EmptyStateAction
  secondaryAction?: EmptyStateAction
  style?: CSSProperties
}

export function EmptyState({
  title,
  description,
  pose = 'sit',
  takuSize = 104,
  action,
  secondaryAction,
  style,
}: EmptyStateProps) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', ...style }}>
      <Taku pose={pose} size={takuSize} style={{ marginBottom: 16 }} />
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: description ? 6 : 0 }}>{title}</div>
      {description && (
        <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.5, maxWidth: 280 }}>{description}</div>
      )}
      {(action || secondaryAction) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          {action && <Button variant="primary" onClick={action.onClick}>{action.label}</Button>}
          {secondaryAction && <Button variant="outline" onClick={secondaryAction.onClick}>{secondaryAction.label}</Button>}
        </div>
      )}
    </div>
  )
}
