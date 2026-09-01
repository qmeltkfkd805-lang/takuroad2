'use client'

import { useRouter } from 'next/navigation'
import { EventStatusBadge } from '@/components/tds/EventStatusBadge'
import { Icon } from '@/components/tds'
import { WORK_EVENT_ICON, WORK_EVENT_LABEL, type ShopWorkEvent } from '@/services/eventService'

/* 샵 상세의 "진행중인 이벤트" — 이벤트 홈(EventHomePage PosterCard)과 같은 포스터 카드로 보여준다.
   포스터 3:4 + 상태 배지 + 작품명 + 제목 + 기간. 누르면 이벤트 상세로. */

const md = (s: string | null) => (s ? `${new Date(s).getMonth() + 1}.${String(new Date(s).getDate()).padStart(2, '0')}` : '')
const periodText = (s: string | null, e: string | null) => [md(s), md(e)].filter(Boolean).join(' ~ ')

export default function ShopWorkEventCards({ events }: { events: ShopWorkEvent[] }) {
  const router = useRouter()
  if (events.length === 0) return null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
      {events.map(ev => {
        const period = periodText(ev.startDate, ev.endDate)
        return (
          <button
            key={ev.id}
            onClick={() => router.push(`/event/${ev.id}`)}
            style={{
              display: 'flex', flexDirection: 'column', textAlign: 'left', padding: 0,
              border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden',
              background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <span style={{ position: 'relative', display: 'block', width: '100%', aspectRatio: '3 / 4', background: 'var(--surface2)' }}>
              {ev.coverUrl
                ? <img src={ev.coverUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={WORK_EVENT_ICON[ev.type] ?? 'event'} size={40} style={{ opacity: .4 }} />
                  </span>}
              <span style={{ position: 'absolute', top: 8, left: 8, zIndex: 2 }}>
                <EventStatusBadge startDate={ev.startDate} endDate={ev.endDate} />
              </span>
            </span>

            <span style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 11px 12px', minWidth: 0 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#5A43B5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ev.workName ?? WORK_EVENT_LABEL[ev.type] ?? ''}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {ev.title ?? '(제목 없음)'}
              </span>
              {period && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted)' }}>
                  <CalIcon />{period}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

const CalIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9B968D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
  </svg>
)
