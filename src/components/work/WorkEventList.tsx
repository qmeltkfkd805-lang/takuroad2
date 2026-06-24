'use client'

import { WorkEvent } from '@/services/eventService'

// Event type별 표시 (아이콘 + 기본 문구). 새 type 생기면 여기 추가.
const EVENT_DISPLAY: Record<string, { icon: string; fallback: string }> = {
  goods_added: { icon: '🛍️', fallback: '새 굿즈가 등록되었어요' },
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

export default function WorkEventList({ events }: { events: WorkEvent[] }) {
  if (events.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {events.map(ev => {
        const display = EVENT_DISPLAY[ev.type] ?? { icon: '✨', fallback: '새로운 소식' }
        return (
          <div key={ev.id} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '12px 14px', borderRadius: 'var(--r-sm)',
            border: '1px solid var(--border)', background: 'var(--surface)',
          }}>
            <span style={{ fontSize: '20px', flexShrink: 0 }}>{display.icon}</span>
            <span style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
              {ev.title ?? display.fallback}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--muted)', flexShrink: 0 }}>
              {timeAgo(ev.createdAt)}
            </span>
          </div>
        )
      })}
    </div>
  )
}