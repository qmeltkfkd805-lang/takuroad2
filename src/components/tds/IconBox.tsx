'use client'
import { CSSProperties } from 'react'
import { Icon } from './Icon'

type Tone = 'coral' | 'mint' | 'yellow' | 'lavender' | 'blue' | 'gray'

const toneBg: Record<Tone, string> = {
  coral:    '#FFEDE6',
  mint:     '#E1F7F2',
  yellow:   '#FFF3D6',
  lavender: '#F0ECFF',
  blue:     '#E8F4FF',
  gray:     '#F1EFEA',
}

interface IconBoxProps {
  name: string
  tone?: Tone
  size?: number
  iconSize?: number
  style?: CSSProperties
}

export function IconBox({ name, tone = 'coral', size = 34, iconSize, style }: IconBoxProps) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.32),
        background: toneBg[tone],
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...style,
      }}
    >
      <Icon name={name} size={iconSize ?? Math.round(size * 0.56)} />
    </span>
  )
}
