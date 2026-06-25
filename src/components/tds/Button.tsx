'use client'
import { CSSProperties, ReactNode, useState } from 'react'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost'
type Size = 'md' | 'lg'

interface ButtonProps {
  children: ReactNode
  variant?: Variant
  size?: Size
  fullWidth?: boolean
  disabled?: boolean
  leftIcon?: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  style?: CSSProperties
}

const sizeStyle: Record<Size, CSSProperties> = {
  md: { padding: '15px 24px', fontSize: 15, borderRadius: 18 },
  lg: { padding: '18px 28px', fontSize: 16, borderRadius: 20 },
}

export function Button({
  children, variant = 'primary', size = 'md', fullWidth, disabled, leftIcon, onClick, type = 'button', style,
}: ButtonProps) {
  const [pressed, setPressed] = useState(false)
  const variants: Record<Variant, CSSProperties> = {
    primary: { background: 'var(--accent)', color: '#fff', border: 'none', boxShadow: pressed ? 'none' : '0 4px 14px rgba(255,139,102,.28)' },
    secondary: { background: 'var(--secondary)', color: '#7A5A00', border: 'none' },
    outline: { background: 'var(--surface)', color: 'var(--accent)', border: '1.5px solid var(--border)' },
    ghost: { background: 'transparent', color: 'var(--muted)', border: 'none' },
  }
  const base: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontWeight: 700, fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
    width: fullWidth ? '100%' : undefined,
    transform: pressed && !disabled ? 'scale(0.97)' : 'scale(1)',
    transition: 'transform .12s ease, box-shadow .12s ease',
    ...sizeStyle[size],
    ...(disabled ? { background: '#F1EFEA', color: '#B8B2A8', border: 'none', boxShadow: 'none' } : variants[variant]),
    ...style,
  }
  return (
    <button type={type} disabled={disabled} onClick={disabled ? undefined : onClick}
      onPointerDown={() => !disabled && setPressed(true)} onPointerUp={() => setPressed(false)} onPointerLeave={() => setPressed(false)}
      style={base}>
      {leftIcon}{children}
    </button>
  )
}
