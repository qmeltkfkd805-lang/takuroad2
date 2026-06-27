'use client'
import { CSSProperties, ReactNode, useState } from 'react'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'action' | 'dashed'
type Size = 'md' | 'lg'

interface ButtonProps {
  children: ReactNode
  variant?: Variant
  size?: Size
  fullWidth?: boolean
  disabled?: boolean
  active?: boolean
  activeColor?: string
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
  children, variant = 'primary', size = 'md', fullWidth, disabled, active, activeColor, leftIcon, onClick, type = 'button', style,
}: ButtonProps) {
  const [pressed, setPressed] = useState(false)
  const variants: Record<Variant, CSSProperties> = {
    primary: { background: 'var(--accent)', color: '#fff', border: 'none', boxShadow: pressed ? 'none' : '0 4px 14px rgba(255,139,102,.28)' },
    secondary: { background: 'var(--secondary)', color: '#7A5A00', border: 'none' },
    outline: { background: 'var(--surface)', color: 'var(--accent)', border: '1.5px solid var(--border)' },
    ghost: { background: 'transparent', color: 'var(--muted)', border: 'none' },
    action: { background: 'var(--surface)', color: 'var(--text)', border: '1.5px solid var(--border)' },
    dashed: { background: 'var(--surface)', color: 'var(--accent)', border: '1.5px dashed var(--accent)' },
  }
  // active(토글 선택) 상태 — activeColor로 테두리·글자·배경을 한번에 (shorthand border 사용해 충돌 방지)
  const ac = activeColor ?? 'var(--accent)'
  const activeStyle: CSSProperties = active
    ? { border: `1.5px solid ${ac}`, color: ac, background: `${ac}15` }
    : {}
  const base: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontWeight: 700, fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
    width: fullWidth ? '100%' : undefined,
    transform: pressed && !disabled ? 'scale(0.97)' : 'scale(1)',
    transition: 'transform .12s ease, box-shadow .12s ease',
    ...sizeStyle[size],
    ...(disabled ? { background: '#F1EFEA', color: '#B8B2A8', border: 'none', boxShadow: 'none' } : variants[variant]),
    ...activeStyle,
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
