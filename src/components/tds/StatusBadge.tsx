'use client'
import { CSSProperties } from 'react'
import { Shop } from '@/types/shop'
import { getShopStatus, ShopStatusKind } from '@/lib/utils/shopStatus'

const COLOR: Record<ShopStatusKind, string> = {
  open: '#14B8A0',
  closing_soon: '#D98A12',
  before: '#EF5A5A',
  closed: '#EF5A5A',
  dayoff: '#8A857C',
  temp_closed: '#3E8FC9',
  permanently_closed: '#6B6B6B',
  unknown: '#9B968D',
}

interface StatusBadgeProps {
  shop: Shop
  showDetail?: boolean
  now?: Date
  style?: CSSProperties
}

export function StatusBadge({ shop, showDetail = true, now, style }: StatusBadgeProps) {
  const s = getShopStatus(shop, now)
  if (s.kind === 'unknown') return null
  const color = COLOR[s.kind]
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, minWidth: 0, ...style }}>
      <span style={{ width: 7, height: 7, borderRadius: 9999, background: color, flexShrink: 0 }} />
      <span style={{ color, fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>{s.label}</span>
      {showDetail && s.detail && (
        <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
          · {s.detail}
        </span>
      )}
    </span>
  )
}
