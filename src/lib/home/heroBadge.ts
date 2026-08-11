// 이벤트 "시작일 강조" 문구. 단순 D-3 (시작/종료 헷갈림) 금지.
//  · 오늘 시작 / 내일 시작 / N일 뒤 시작(2~14) / M.D OPEN(그 외·먼 미래)
// 날짜는 YYYY-MM-DD 문자열로 비교해 타임존 밀림을 피한다.

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** start - today 를 "달력상 며칠" 로. 둘 다 YYYY-MM-DD. */
export function daysUntil(startDate: string, today: string): number {
  // 정오 UTC로 고정해 DST/타임존 영향 제거
  const s = new Date(`${startDate}T12:00:00Z`).getTime()
  const t = new Date(`${today}T12:00:00Z`).getTime()
  return Math.round((s - t) / 86400000)
}

/** M.D (예: 8.12) — 앞자리 0 제거 */
export function shortDate(startDate: string): string {
  const [, m, d] = startDate.split('-')
  return `${parseInt(m, 10)}.${parseInt(d, 10)}`
}

/**
 * 시작 배지 문구. startDate 없으면 null.
 * today 미지정 시 오늘 날짜 사용.
 */
export function startLabel(startDate: string | null, today?: string): string | null {
  if (!startDate) return null
  const t = today ?? toYmd(new Date())
  const days = daysUntil(startDate, t)
  if (days < 0) return null            // 이미 시작 — 자동추천에선 안 들어옴
  if (days === 0) return '오늘 시작'
  if (days === 1) return '내일 시작'
  if (days <= 14) return `${days}일 뒤 시작`
  return `${shortDate(startDate)} OPEN`
}

/** 보조 메타: "8.12 시작 · 장소" (장소 없으면 "8.12 시작") */
export function startMeta(startDate: string | null, place: string | null): string | null {
  const parts: string[] = []
  if (startDate) parts.push(`${shortDate(startDate)} 시작`)
  if (place && place.trim()) parts.push(place.trim())
  return parts.length ? parts.join(' · ') : null
}
