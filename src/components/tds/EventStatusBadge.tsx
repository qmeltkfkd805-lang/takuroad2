'use client'
import { CSSProperties } from 'react'
import { getEventStatus, EventStatusKind } from '@/lib/utils/eventStatus'

const STYLE: Record<EventStatusKind, { solid: boolean; bg: string; fg: string }> = {
  ends_today:   { solid: true,  bg: '#EF5A5A', fg: '#fff' },
  ending_soon:  { solid: true,  bg: '#FF7A45', fg: '#fff' },
  starts_today: { solid: true,  bg: '#14B8A0', fg: '#fff' },
  ongoing:      { solid: false, bg: 'rgba(255,255,255,.95)', fg: '#14B8A0' },
  upcoming:     { solid: false, bg: 'rgba(255,255,255,.95)', fg: '#2E7DB8' },
  ended:        { solid: false, bg: 'rgba(255,255,255,.95)', fg: '#8A857C' },
  unknown:      { solid: false, bg: '', fg: '' },
}

interface EventStatusBadgeProps {
  startDate: string | null
  endDate: string | null
  now?: Date
  style?: CSSProperties
}

export function EventStatusBadge({ startDate, endDate, now, style }: EventStatusBadgeProps) {
  const s = getEventStatus({ startDate, endDate }, now)
  if (s.kind === 'unknown') return null
  const st = STYLE[s.kind]

  if (st.solid) {
    return (
      <span style={{ background: st.bg, color: st.fg, fontSize: 12, fontWeight: 800, padding: '4px 11px', borderRadius: 9999, boxShadow: `0 2px 6px ${st.bg}59`, ...style }}>
        {s.label}
      </span>
    )
  }
  return (
    <span style={{ background: st.bg, color: st.fg, fontSize: 12, fontWeight: 700, padding: '4px 11px', borderRadius: 9999, display: 'inline-flex', alignItems: 'center', gap: 5, ...style }}>
      <span style={{ width: 6, height: 6, borderRadius: 9999, background: st.fg }} />
      {s.label}
    </span>
  )
}
