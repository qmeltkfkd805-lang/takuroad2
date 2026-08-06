'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { EventHomeItem } from '@/services/eventHomeService'
import { monthCells, eventOnDay, ymd, WEEKDAY_KO, EV_TYPE_NAME } from '@/lib/event/calendar'
import { CATEGORY_NAME_MAP } from '@/lib/constants/categories'

/**
 * 이벤트 홈 우측 상단 미니 캘린더.
 * 이번 달에서 이벤트가 있는 날에 종류별 색깔 점을 찍고, 클릭하면 전체 캘린더로 이동한다.
 */
const PINK = '#f0568f'   // 일요일
const TEAL = '#22bcc9'   // 토요일
const JUA = "'Jua', system-ui, sans-serif"
function typeColor(type: string): string { return CATEGORY_NAME_MAP[EV_TYPE_NAME[type] ?? '']?.color ?? 'var(--accent)' }

export default function EventCalendarWidget({ items }: { items: EventHomeItem[] }) {
  const router = useRouter()
  const now = new Date()
  const year = now.getFullYear()
  const month0 = now.getMonth()
  const todayStr = ymd(now)

  const cells = useMemo(() => monthCells(year, month0), [year, month0])

  // 날짜별 이벤트 종류 목록 (색 점용) + 이번 달 고유 이벤트 수
  const { typesByDay, monthCount } = useMemo(() => {
    const map = new Map<string, string[]>()
    const ids = new Set<string>()
    for (const c of cells) {
      if (!c) continue
      const types: string[] = []
      for (const i of items) {
        if (eventOnDay(i.startDate, i.endDate, c)) {
          ids.add(i.id)
          if (!types.includes(i.type)) types.push(i.type)
        }
      }
      if (types.length) map.set(c, types)
    }
    return { typesByDay: map, monthCount: ids.size }
  }, [cells, items])

  const goFull = () => router.push('/events/calendar')

  return (
    <div
      onClick={goFull}
      role="button"
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18,
        overflow: 'hidden', cursor: 'pointer', marginBottom: 16,
        boxShadow: '0 2px 10px rgba(0,0,0,.03)',
      }}
    >
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jua&display=swap" />

      {/* 헤더 — 파스텔 그라데이션 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px 11px',
        background: 'linear-gradient(135deg, rgba(240,86,143,.12), rgba(34,188,201,.10))',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontFamily: JUA, fontSize: 18, lineHeight: 1, color: 'var(--text)' }}>{month0 + 1}월</span>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--muted)' }}>이벤트 캘린더</span>
          {monthCount > 0 && (
            <span style={{
              fontSize: 10.5, fontWeight: 800, color: '#fff', background: 'var(--accent)',
              borderRadius: 9999, padding: '1px 7px', lineHeight: 1.5,
            }}>{monthCount}</span>
          )}
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 1 }}>
          전체보기
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
        </span>
      </div>

      {/* 달력 */}
      <div style={{ padding: '10px 12px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
          {WEEKDAY_KO.map((w, i) => (
            <div key={w} style={{ textAlign: 'center', fontFamily: JUA, fontSize: 11, padding: '2px 0 4px', color: i === 0 ? PINK : i === 6 ? TEAL : 'var(--muted)' }}>{w}</div>
          ))}
          {cells.map((c, i) => {
            if (!c) return <div key={`e${i}`} />
            const day = Number(c.slice(8, 10))
            const isToday = c === todayStr
            const types = typesByDay.get(c) ?? []
            const dow = i % 7
            return (
              <div key={c} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '2px 0' }}>
                <span style={{
                  width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: JUA, fontSize: 12.5, borderRadius: 9999,
                  background: isToday ? 'var(--accent)' : 'transparent',
                  boxShadow: isToday ? '0 2px 8px rgba(240,86,143,.4)' : 'none',
                  color: isToday ? '#fff' : dow === 0 ? PINK : dow === 6 ? TEAL : 'var(--text)',
                }}>{day}</span>
                <span style={{ display: 'flex', gap: 2, height: 4, alignItems: 'center' }}>
                  {types.slice(0, 3).map((t, idx) => (
                    <span key={idx} style={{ width: 4, height: 4, borderRadius: 9999, background: typeColor(t) }} />
                  ))}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
