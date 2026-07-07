'use client'
import { CSSProperties } from 'react'
import { Icon } from './Icon'
import { EventStatusBadge } from './EventStatusBadge'

export type EventType = 'popup' | 'collab_cafe' | 'exhibition'

export interface EventCardData {
  id: string
  title: string
  type: EventType
  workName?: string | null
  place?: string | null
  startDate: string | null
  endDate: string | null
  coverUrl?: string | null
}

const TYPE_META: Record<EventType, { icon: string; label: string; grad: string }> = {
  popup:       { icon: 'event',      label: '팝업',       grad: 'linear-gradient(135deg,#FFE3D6,#FFF0E4)' },
  collab_cafe: { icon: 'cafe',       label: '콜라보 카페', grad: 'linear-gradient(135deg,#E1F7F2,#EAF8F4)' },
  exhibition:  { icon: 'exhibition', label: '전시',       grad: 'linear-gradient(135deg,#F0ECFF,#FBF0FF)' },
}

const fmt = (s: string | null) => (s ? `${new Date(s).getMonth() + 1}.${String(new Date(s).getDate()).padStart(2, '0')}` : '')

interface EventCardProps {
  event: EventCardData
  now?: Date
  onClick?: (event: EventCardData) => void
  style?: CSSProperties
}

export function EventCard({ event, now, onClick, style }: EventCardProps) {
  const t = TYPE_META[event.type]
  const cover = event.coverUrl
  const dateRange = [fmt(event.startDate), fmt(event.endDate)].filter(Boolean).join(' ~ ')

  return (
    <div
      onClick={() => onClick?.(event)}
      style={{
        width: '100%',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,.04)',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      <div style={{ position: 'relative', height: 128, background: cover ? '#F7F7F8' : t.grad, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {cover ? (
          <img src={cover} alt={event.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Icon name={t.icon} size={46} style={{ opacity: 0.45 }} />
        )}
        <EventStatusBadge startDate={event.startDate} endDate={event.endDate} now={now} style={{ position: 'absolute', top: 10, left: 10 }} />
      </div>

      <div style={{ padding: '13px 14px 15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--muted)', marginBottom: 6 }}>
          <Icon name={t.icon} size={13} style={{ opacity: 0.85 }} />
          <span>{t.label}</span>
          {event.workName && (
            <>
              <span>·</span>
              <span style={{ color: '#5A43B5', fontWeight: 600 }}>{event.workName}</span>
            </>
          )}
        </div>

        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {event.title}
        </div>

        {(event.place || dateRange) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: 'var(--muted)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9B968D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21c-4.5-5.5-6.6-9.4-6.6-12.5a6.6 6.6 0 0 1 13.2 0c0 3.1-2.1 7-6.6 12.5z" /><circle cx="12" cy="8.5" r="2.3" /></svg>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {[event.place, dateRange].filter(Boolean).join(' · ')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
