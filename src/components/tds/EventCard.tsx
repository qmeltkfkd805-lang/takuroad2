'use client'
import { CSSProperties } from 'react'
import { Icon } from './Icon'
import { EventStatusBadge } from './EventStatusBadge'

export type EventType = 'popup' | 'collab_cafe' | 'exhibition' | 'official_event'

export interface EventCardData {
  id: string
  title: string
  type: EventType
  workName?: string | null
  place?: string | null
  startDate: string | null
  endDate: string | null
  coverUrl?: string | null
  /** 최애/관심 — 작품 카드와 같은 표시 */
  affinity?: 'favorite' | 'interest' | null
}

const TYPE_META: Record<EventType, { icon: string; label: string; grad: string }> = {
  popup:       { icon: 'event',      label: '팝업',       grad: 'linear-gradient(135deg,#FFE3D6,#FFF0E4)' },
  collab_cafe: { icon: 'cafe',       label: '콜라보 카페', grad: 'linear-gradient(135deg,#E1F7F2,#EAF8F4)' },
  exhibition:  { icon: 'exhibition', label: '전시',       grad: 'linear-gradient(135deg,#F0ECFF,#FBF0FF)' },
  official_event: { icon: 'calendar', label: '행사', grad: 'linear-gradient(135deg,#FFF3D6,#FFF9E8)' },
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
      <div style={{ position: 'relative', aspectRatio: '4 / 5', background: cover ? '#F7F7F8' : t.grad, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {cover ? (
          <img src={cover} alt={event.title} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
        ) : (
          <Icon name={t.icon} size={46} style={{ opacity: 0.45 }} />
        )}
        <EventStatusBadge startDate={event.startDate} endDate={event.endDate} now={now} style={{ position: 'absolute', top: 10, left: 10 }} />
        {/* 최애·관심은 왼쪽 아래 — 왼쪽 위는 상태 배지 자리다 (작품 카드와 같은 규칙) */}
        {event.affinity && (
          <span style={{ position: 'absolute', bottom: 10, left: 10, width: 32, height: 32, borderRadius: 9999, background: 'rgba(255,255,255,.95)', boxShadow: '0 1px 3px rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {event.affinity === 'favorite' ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="#FF6B6B" stroke="#FF6B6B" strokeWidth="2" strokeLinejoin="round"><path d="M12 20C5 15 3.5 10.5 5.5 7.8 7.1 5.9 10.2 6.1 12 8.4 13.8 6.1 16.9 5.9 18.5 7.8 20.5 10.5 19 15 12 20Z" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#FFD166" stroke="#E9B72E" strokeWidth="1.5" strokeLinejoin="round"><path d="M12 4.5 14.2 9l5 .7-3.6 3.5.9 5-4.5-2.4L7.4 18l.9-5L4.7 9.7l5-.7z" /></svg>
            )}
          </span>
        )}
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

        <div title={event.title} style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {event.title}
        </div>

        {/* 장소와 기간은 성격이 달라서 한 줄에 묶지 않는다 */}
        {(event.place || dateRange) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--muted)' }}>
            {event.place && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9B968D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 21c-4.5-5.5-6.6-9.4-6.6-12.5a6.6 6.6 0 0 1 13.2 0c0 3.1-2.1 7-6.6 12.5z" /><circle cx="12" cy="8.5" r="2.3" /></svg>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.place}</span>
              </div>
            )}
            {dateRange && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9B968D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3.5v3M16 3.5v3" /></svg>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dateRange}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
