import { BusinessHours } from '@/types/database'
import { WEEKDAYS, WEEKDAY_LABEL } from '@/lib/constants/categories'

type Day = (typeof WEEKDAYS)[number]

export interface HoursRow {
  day: Day
  label: string
  open: string | null
  close: string | null
}

/** 요일별 목록 — 이벤트 정보 탭에서 그대로 뿌린다 */
export function hoursRows(h: BusinessHours | null): HoursRow[] {
  if (!h) return []
  return WEEKDAYS.map(d => {
    const v = h[d]
    return { day: d, label: WEEKDAY_LABEL[d], open: v?.open ?? null, close: v?.close ?? null }
  })
}

/** 공휴일 휴무 여부 (샵과 같은 방식 — hours JSON 안에 얹혀 있다) */
export function isHolidayClosed(h: BusinessHours | null): boolean {
  return (h as any)?.holiday === 'closed'
}

/** 하루라도 시간이 입력됐는지 */
export function hasAnyHours(h: BusinessHours | null): boolean {
  return !!h && WEEKDAYS.some(d => !!h[d])
}

/**
 * 한 줄 요약.
 *   매일 같으면        → "매일 10:00 ~ 22:00"
 *   연속 요일끼리 묶음 → "월~금 10:00 ~ 20:00, 토 11:00 ~ 21:00"
 *   전부 휴무/미입력   → null
 */
export function summarizeHours(h: BusinessHours | null): string | null {
  if (!h) return null

  const openDays = WEEKDAYS.filter(d => !!h[d])
  if (openDays.length === 0) return null

  const key = (d: Day) => `${h[d]!.open}~${h[d]!.close}`

  if (openDays.length === 7 && new Set(WEEKDAYS.map(key)).size === 1) {
    const v = h.mon!
    return `매일 ${v.open} ~ ${v.close}`
  }

  // 연속된 요일 중 시간이 같은 것끼리 묶는다
  const groups: { days: Day[]; time: string }[] = []
  for (const d of WEEKDAYS) {
    if (!h[d]) continue
    const t = key(d)
    const last = groups[groups.length - 1]
    const prevDay = WEEKDAYS[WEEKDAYS.indexOf(d) - 1]
    const contiguous = last && last.time === t && last.days[last.days.length - 1] === prevDay
    if (contiguous) last.days.push(d)
    else groups.push({ days: [d], time: t })
  }

  return groups
    .map(g => {
      const span = g.days.length >= 3
        ? `${WEEKDAY_LABEL[g.days[0]]}~${WEEKDAY_LABEL[g.days[g.days.length - 1]]}`
        : g.days.map(d => WEEKDAY_LABEL[d]).join('·')
      const [o, c] = g.time.split('~')
      return `${span} ${o} ~ ${c}`
    })
    .join(', ')
}

/** summarizeHours를 그룹(평일/주말 등)별로 한 줄씩 끊어 돌려준다 — 타일에서 여러 줄로 보여줄 때 */
export function summarizeHoursLines(h: BusinessHours | null): string[] {
  const s = summarizeHours(h)
  return s ? s.split(', ') : []
}

/** 휴무 요일 안내 — "휴무: 월·화" / 공휴일 휴무 포함. 없으면 null */
export function closedDaysLabel(h: BusinessHours | null): string | null {
  if (!h) return null
  const closed = WEEKDAYS.filter(d => !h[d]).map(d => WEEKDAY_LABEL[d])
  const parts: string[] = []
  if (closed.length > 0 && closed.length < 7) parts.push(`휴무 ${closed.join('·')}`)
  if (isHolidayClosed(h)) parts.push('공휴일 휴무')
  return parts.length ? parts.join(' · ') : null
}
