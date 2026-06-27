'use client'
// 재고 상태 배지 — availability 하나만 받아 색·라벨을 캡슐화.
// "품절/적음/보통/많음"의 색 규칙이 한 곳에 모임. (Chip과 별개 역할: 상태 표시)
import { AVAILABILITY_LABEL, Availability } from '@/services/shopProductService'

const COLOR: Record<Availability, string> = {
  unknown: 'var(--muted)', not_sold: 'var(--muted)', sold_out: 'var(--red)',
  few: '#eab308', normal: 'var(--accent)', many: 'var(--green)',
}
const BG: Record<Availability, string> = {
  unknown: 'var(--surface2)', not_sold: 'var(--surface2)', sold_out: '#FFEAE8',
  few: '#FFF3D6', normal: '#FFEDE6', many: '#E1F7F2',
}

export function StockBadge({ availability }: { availability: Availability }) {
  return (
    <span style={{
      fontSize: 12, fontWeight: 800, flexShrink: 0,
      color: COLOR[availability], background: BG[availability],
      padding: '3px 9px', borderRadius: 999,
    }}>
      {AVAILABILITY_LABEL[availability]}
    </span>
  )
}
