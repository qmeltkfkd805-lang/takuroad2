/* 매달 정기휴무 — 예) 대형마트 의무휴업 "매월 둘째·넷째 일요일".

   hours(jsonb)에 요일 키(mon~sun)·holiday·yearRound 와 함께 저장한다.
     monthlyOff: { weeks: [2, 4], days: ['sun'] }
   weeks = 그 달의 몇째 주(1~5), days = 요일. 둘을 곱한 조합이 모두 휴무다.
   "몇째 주"는 달력 줄이 아니라 "그 요일이 그 달에 몇 번째로 오는가"다.
   (예: 1일이 토요일인 달의 첫째 일요일 = 2일, 둘째 일요일 = 9일)
   스키마 변경 없음(jsonb). */

export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export interface MonthlyOff {
  weeks: number[]
  days: WeekdayKey[]
}

const JS_DAY: WeekdayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const ORDER: WeekdayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DAY_KO: Record<WeekdayKey, string> = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' }
export const WEEK_KO = ['첫째', '둘째', '셋째', '넷째', '다섯째']

/* hours 에서 정기휴무 설정을 꺼낸다. 비었거나 형식이 틀리면 null. */
export function getMonthlyOff(hours: unknown): MonthlyOff | null {
  const m = (hours as any)?.monthlyOff
  if (!m || !Array.isArray(m.weeks) || !Array.isArray(m.days)) return null
  const weeks = m.weeks.map(Number).filter((w: number) => w >= 1 && w <= 5)
  const days = m.days.filter((d: string) => (ORDER as string[]).includes(d)) as WeekdayKey[]
  if (!weeks.length || !days.length) return null
  return { weeks: [...new Set<number>(weeks)].sort((a, b) => a - b), days: ORDER.filter(d => days.includes(d)) }
}

/* 이 날짜가 정기휴무인가 */
export function isMonthlyOffDate(hours: unknown, date: Date): boolean {
  const m = getMonthlyOff(hours)
  if (!m) return false
  const day = JS_DAY[date.getDay()]
  if (!m.days.includes(day)) return false
  const nth = Math.ceil(date.getDate() / 7)
  return m.weeks.includes(nth)
}

/* 표시용 문구 — "매월 둘째·넷째 일요일 휴무" */
export function monthlyOffLabel(hours: unknown): string | null {
  const m = getMonthlyOff(hours)
  if (!m) return null
  const w = m.weeks.map(n => WEEK_KO[n - 1]).join('·')
  const d = m.days.map(x => DAY_KO[x] + '요일').join('·')
  return `매월 ${w} ${d} 휴무`
}
