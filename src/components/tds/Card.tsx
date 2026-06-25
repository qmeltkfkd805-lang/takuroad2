'use client'
import { CSSProperties, ReactNode, useState } from 'react'

interface CardProps {
  children: ReactNode
  onClick?: () => void
  padding?: number | string
  style?: CSSProperties
}

export function Card({ children, onClick, padding = '18px 20px', style }: CardProps) {
  const [pressed, setPressed] = useState(false)
  const clickable = !!onClick
  const base: CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding,
    boxShadow: '0 4px 14px rgba(0,0,0,.05)', cursor: clickable ? 'pointer' : 'default',
    transform: clickable && pressed ? 'scale(0.985)' : 'scale(1)', transition: 'transform .12s ease',
    ...style,
  }
  return (
    <div onClick={onClick}
      onPointerDown={() => clickable && setPressed(true)} onPointerUp={() => setPressed(false)} onPointerLeave={() => setPressed(false)}
      style={base}>
      {children}
    </div>
  )
}
