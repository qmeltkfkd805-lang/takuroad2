// 이벤트 캘린더 공용 유틸 — 문자열 날짜('YYYY-MM-DD')는 사전순=시간순이라 그대로 비교한다.

export function pad2(n: number): string { return String(n).padStart(2, '0') }

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** 이벤트가 해당 날짜(day, 'YYYY-MM-DD')에 진행 중인지. endDate 없으면 하루짜리로 본다. */
export function eventOnDay(start: string | null, end: string | null, day: string): boolean {
  if (!start) return false
  const e = end ?? start
  return day >= start.slice(0, 10) && day <= e.slice(0, 10)
}

/** 해당 월(month0: 0~11)의 달력 셀. 앞뒤 빈칸은 null. 항상 7의 배수. */
export function monthCells(year: number, month0: number): (string | null)[] {
  const startWeekday = new Date(year, month0, 1).getDay() // 0=일
  const daysInMonth = new Date(year, month0 + 1, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${year}-${pad2(month0 + 1)}-${pad2(d)}`)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

// 이벤트 type → 카테고리 이름 (색상 매핑용)
export const EV_TYPE_NAME: Record<string, string> = {
  popup: '팝업스토어', collab_cafe: '콜라보카페', exhibition: '전시', official_event: '행사',
}

/** 오늘(today) 기준 이벤트 상태 — 상세 패널 배지용. day는 'YYYY-MM-DD'. */
export interface EvStatus { label: string; color: string }
export function eventStatus(start: string | null, end: string | null, today: string): EvStatus {
  if (!start) return { label: '', color: 'var(--muted)' }
  const s = start.slice(0, 10)
  const e = (end ?? start).slice(0, 10)
  const tomorrow = addDays(today, 1)
  if (e < today) return { label: '종료', color: '#9ca3af' }
  if (s > today) return s === tomorrow ? { label: '내일 시작', color: '#f59e0b' } : { label: '예정', color: '#2563eb' }
  if (s === today) return { label: '오늘 시작', color: '#2563eb' }
  if (e === today) return { label: '오늘 종료', color: '#ef4444' }
  if (e === tomorrow) return { label: '내일 종료', color: '#f59e0b' }
  return { label: '진행 중', color: '#16a34a' }
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return ymd(new Date(y, m - 1, d + n))
}
