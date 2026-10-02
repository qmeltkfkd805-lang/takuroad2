'use client'
/* 펼친 영업시간표 아래에 붙는 공휴일 줄 — PC 샵 상세와 모바일 ShopHeader 가 같이 쓴다.
   · "공휴일  10:30 ~ 22:00" (매장이 정해 둔 공휴일 규칙)
   · 앞으로 7일 안의 빨간날: "10/3(토) 개천절  10:30 ~ 22:00"
   공휴일 규칙이 없는 매장은 아무것도 그리지 않는다. */
import { BusinessHours } from '@/types/database'
import { getHolidayRule, formatDayHours, upcomingHolidays } from '@/lib/utils/date'

export default function HolidayHoursRows({ hours, labelWidth = 22 }: { hours: BusinessHours | null; labelWidth?: number }) {
  const rule = getHolidayRule(hours)
  if (!rule) return null
  const upcoming = upcomingHolidays(hours)
  const red = '#C0392B'
  return (
    <>
      <div style={{ display: 'flex', gap: 14, fontSize: 13 }}>
        <span style={{ minWidth: labelWidth, flexShrink: 0, color: red, fontWeight: 700 }}>공휴일</span>
        <span style={{ color: rule === 'closed' ? red : 'var(--text)', fontWeight: 600 }}>{rule === 'closed' ? '휴무' : formatDayHours(rule)}</span>
      </div>
      {upcoming.length > 0 && (
        <div style={{ marginTop: 4, paddingTop: 6, borderTop: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {upcoming.map(h => (
            <div key={h.key} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 13 }}>
              <span style={{ color: red, fontWeight: 700 }}>{h.label} {h.name}</span>
              <span style={{ color: h.closed ? red : 'var(--text)', fontWeight: 600 }}>{h.hours}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
