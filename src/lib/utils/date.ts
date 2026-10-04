import { BusinessHours, DayHours } from '@/types/database'
import { WEEKDAYS, WEEKDAY_LABEL } from '@/lib/constants/categories'
import { isMonthlyOffDate } from './monthlyOff'
import { holidayName } from './krHolidays'

const DAY_INDEX: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}

const toMin = (t: string) => { const [h, m] = (t || '00:00').split(':').map(Number); return (h || 0) * 60 + (m || 0) }

/** 종료 시각 표시용: 자정 넘김(00:00)을 보기 좋게 24:00으로. */
function displayClose(open: string, close: string) {
  if (close === '24:00') return '24:00'
  if (close === '00:00' && toMin(close) <= toMin(open)) return '24:00'
  return close
}

/**
 * 오늘 영업 상태 반환
 */
export function getTodayStatus(hours: BusinessHours | null): {
  isOpen: boolean
  label: string
  todayHours: string | null
} {
  if (!hours) return { isOpen: false, label: '영업시간 정보 없음', todayHours: null }

  const today = new Date()
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const todayKey = dayNames[today.getDay()] as keyof BusinessHours

  // 공휴일(빨간날)이면 매장이 정해 둔 공휴일 규칙(휴무 / 다른 시간)을 먼저 따른다
  const hol = holidayName(today)
  const rule = hol ? getHolidayRule(hours) : null
  if (rule === 'closed' && !isMonthlyOffDate(hours, today)) {
    return { isOpen: false, label: '오늘 공휴일 휴무', todayHours: null }
  }
  const todayData = rule && rule !== 'closed' ? rule : hours[todayKey]

  // 키 자체가 없으면 정보 없음
  if (todayData === undefined) {
    return { isOpen: false, label: '영업시간 정보 없음', todayHours: null }
  }

  // null이면 휴무
  if (todayData === null) {
    return { isOpen: false, label: '오늘 휴무', todayHours: null }
  }

  // 매달 정기휴무(예: 둘째·넷째 일요일)에 걸리는 날
  if (isMonthlyOffDate(hours, today)) {
    return { isOpen: false, label: '오늘 정기휴무', todayHours: null }
  }

  const { open, close } = todayData
  const now = today.getHours() * 60 + today.getMinutes()
  const openMin = toMin(open)
  // 종료가 시작보다 같거나 이르면 자정을 넘긴 것으로 본다.
  // (예: 09:00~24:00을 오전 12시=00:00로 저장했거나, 18:00~02:00 심야영업)
  const overnight = toMin(close) <= openMin
  const closeMin = overnight ? toMin(close) + 1440 : toMin(close)
  const nowAdj = overnight && now < openMin ? now + 1440 : now

  // 휴게시간 (있는 매장만)
  const hasBreak = !!(todayData.breakStart && todayData.breakEnd)
  const breakStartMin = hasBreak ? toMin(todayData.breakStart!) : null
  const breakEndMin = hasBreak ? toMin(todayData.breakEnd!) : null
  const inBreak = hasBreak && nowAdj >= breakStartMin! && nowAdj < breakEndMin!

  const isOpen = nowAdj >= openMin && nowAdj < closeMin && !inBreak
  const todayHours = formatDayHours(todayData)

  // 라스트 오더가 지났으면 문은 열려 있어도 주문은 끝났다
  let loMin = todayData.lastOrder ? toMin(todayData.lastOrder) : null
  if (loMin !== null && loMin < openMin) loMin += 1440
  const pastLastOrder = isOpen && loMin !== null && nowAdj >= loMin

  return {
    isOpen,
    label: inBreak ? '휴게시간' : pastLastOrder ? '주문 마감' : isOpen ? '영업중' : '영업 종료',
    todayHours,
  }
}

/* ── 공휴일(빨간날) 영업시간 ─────────────────────────────
   hours.holiday = 'closed'                → 공휴일 휴무
   hours.holiday = { open, close, break? } → 공휴일엔 이 시간에 연다
   없으면 공휴일도 평소 요일 시간대로. 공휴일 날짜는 krHolidays.ts. */
export type HolidayRule = 'closed' | DayHours

export function getHolidayRule(hours: unknown): HolidayRule | null {
  const h = (hours as any)?.holiday
  if (h === 'closed') return 'closed'
  if (h && typeof h === 'object' && h.open && h.close) {
    const dh: DayHours = { open: h.open, close: h.close }
    if (h.breakStart && h.breakEnd) { dh.breakStart = h.breakStart; dh.breakEnd = h.breakEnd }
    if (h.lastOrder) dh.lastOrder = h.lastOrder
    return dh
  }
  return null
}

/** 하루 영업시간 → "10:30 ~ 22:00" (휴게 있으면 "10:30 ~ 15:00, 16:00 ~ 22:00") */
export function formatDayHours(dh: DayHours): string {
  const base = dh.breakStart && dh.breakEnd
    ? `${dh.open} ~ ${dh.breakStart}, ${dh.breakEnd} ~ ${displayClose(dh.open, dh.close)}`
    : `${dh.open} ~ ${displayClose(dh.open, dh.close)}`
  return dh.lastOrder ? `${base} (라스트 오더 ${dh.lastOrder})` : base
}

/** 그 날짜의 영업시간 — 정기휴무 > 공휴일 규칙 > 요일 시간. null = 휴무, undefined = 정보 없음 */
export function hoursForDate(hours: BusinessHours | null, date: Date): DayHours | null | undefined {
  if (!hours) return undefined
  if (isMonthlyOffDate(hours, date)) return null
  if (holidayName(date)) {
    const rule = getHolidayRule(hours)
    if (rule === 'closed') return null
    if (rule) return rule
  }
  return hours[DAY_KEYS[date.getDay()]]
}
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

/** 요약 문구 — "공휴일 휴무" / "공휴일 10:30 ~ 22:00". 규칙이 없으면 null */
export function holidayRuleLabel(hours: unknown): string | null {
  const rule = getHolidayRule(hours)
  if (!rule) return null
  return rule === 'closed' ? '공휴일 휴무' : `공휴일 ${formatDayHours(rule)}`
}

/** 앞으로 n일 안의 공휴일과 그날 영업시간 — 공휴일 규칙이 있는 매장만.
    예) [{ label: '10/3(토)', name: '개천절', hours: '10:30 ~ 22:00', closed: false }] */
export function upcomingHolidays(hours: BusinessHours | null, now: Date = new Date(), days = 7) {
  if (!hours || !getHolidayRule(hours)) return []
  const out: { key: string; label: string; name: string; hours: string; closed: boolean }[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    const name = holidayName(d)
    if (!name) continue
    const dh = hoursForDate(hours, d)
    out.push({
      key: `${d.getMonth() + 1}-${d.getDate()}`,
      label: `${d.getMonth() + 1}/${d.getDate()}(${'일월화수목금토'[d.getDay()]})`,
      name,
      hours: dh ? formatDayHours(dh) : dh === null ? '휴무' : '정보 없음',
      closed: dh === null,
    })
  }
  return out
}

/**
 * 영업시간 전체 포맷
 * { mon: {open:'10:00', close:'20:00'}, wed: null } → 표시용 배열
 */
export function formatBusinessHours(hours: BusinessHours | null) {
  if (!hours) return []

  return WEEKDAYS.map(day => {
    const data = hours[day]
    return {
      day,
      label: WEEKDAY_LABEL[day],
      hours: data === undefined
        ? '정보 없음'
        : data === null
          ? '휴무'
          : formatDayHours(data),
      isOpen: data !== null && data !== undefined,
    }
  })
}

/**
 * 팝업 상태 계산
 */
export function getPopupStatus(startDate: string | null, endDate: string | null): {
  status: 'upcoming' | 'ongoing' | 'ended' | null
  label: string
  emoji: string
} {
  if (!startDate && !endDate) return { status: null, label: '', emoji: '' }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = startDate ? new Date(startDate) : null
  const end = endDate ? new Date(endDate) : null

  if (start && today < start) return { status: 'upcoming', label: '예정', emoji: '🟡' }
  if (end && today > end)     return { status: 'ended',    label: '종료', emoji: '⚫' }
  return { status: 'ongoing', label: '진행중', emoji: '🟢' }
}
