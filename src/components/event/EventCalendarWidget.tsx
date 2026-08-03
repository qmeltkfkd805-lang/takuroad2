'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { EventHomeItem } from '@/services/eventHomeService'
import { monthCells, eventOnDay, ymd, WEEKDAY_KO } from '@/lib/event/calendar'

/**
 * 이벤트 홈 우측 상단 미니 캘린더.
 * 이번 달에서 이벤트가 있는 날에 점을 찍고, 클릭하면 전체 캘린더로 이동한다.
 */
export default function EventCalendarWidget({ items }: { items: EventHomeItem[] }) {
  const router = useRouter()
  const now = new Date()
  const year = now.getFullYear()
  const month0 = now.getMonth()
  const todayStr = ymd(now)

  const cells = useMemo(() => monthCells(year, month0), [year, month0])
  const daysWithEvent = useMemo(() => {
    const set = new Set<string>()
    for (const c of cells) {
      if (c && items.some(i => eventOnDay(i.startDate, i.endDate, c))) set.add(c)
    }
    return set
  }, [cells, items])

  const goFull = () => router.push('/events/calendar')

  return (
    <div
      onClick={goFull}
      role="button"
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
        padding: '14px 14px 16px', cursor: 'pointer', marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--text)' }}>
          {year}.{String(month0 + 1).padStart(2, '0')} 이벤트 캘린더
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          전체보기
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {WEEKDAY_KO.map((w, i) => (
          <div key={w} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 800, padding: '2px 0', color: i === 0 ? '#e05a5a' : i === 6 ? '#3b82f6' : 'var(--muted)' }}>{w}</div>
        ))}
        {cells.map((c, i) => {
          if (!c) return <div key={`e${i}`} />
          const day = Number(c.slice(8, 10))
          const isToday = c === todayStr
          const hasEvent = daysWithEvent.has(c)
          const dow = i % 7
          return (
            <div key={c} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, padding: '3px 0' }}>
              <span style={{
                width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11.5, fontWeight: isToday ? 900 : 600, borderRadius: 9999,
                background: isToday ? 'var(--accent)' : 'transparent',
                color: isToday ? '#fff' : dow === 0 ? '#e05a5a' : dow === 6 ? '#3b82f6' : 'var(--text)',
              }}>{day}</span>
              <span style={{ width: 4, height: 4, borderRadius: 9999, background: hasEvent && !isToday ? 'var(--accent)' : 'transparent' }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
