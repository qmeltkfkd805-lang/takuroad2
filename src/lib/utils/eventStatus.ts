export type EventStatusKind =
  | 'ends_today' | 'ending_soon' | 'starts_today'
  | 'ongoing' | 'upcoming' | 'ended' | 'unknown'

export interface EventStatusResult {
  kind: EventStatusKind
  label: string
  sub: string
}

const ENDING_SOON = 3

const day = (s: string) => { const d = new Date(s); d.setHours(0, 0, 0, 0); return d }
const diffDays = (from: Date, to: string) => Math.round((day(to).getTime() - new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()) / 86400000)
const md = (s: string) => { const d = new Date(s); return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}` }

export function getEventStatus(
  ev: { startDate: string | null; endDate: string | null },
  now: Date = new Date()
): EventStatusResult {
  if (!ev.startDate || !ev.endDate) return { kind: 'unknown', label: '', sub: '' }
  const dStart = diffDays(now, ev.startDate)
  const dEnd = diffDays(now, ev.endDate)

  if (dEnd < 0) return { kind: 'ended', label: '종료', sub: '' }
  if (dEnd === 0) return { kind: 'ends_today', label: '오늘 종료', sub: '' }
  if (dStart > 0) return { kind: 'upcoming', label: `D-${dStart}`, sub: `${md(ev.startDate)} 시작` }
  if (dStart === 0) return { kind: 'starts_today', label: '오늘 시작', sub: `~${md(ev.endDate)}` }
  if (dEnd <= ENDING_SOON) return { kind: 'ending_soon', label: `D-${dEnd} 마감`, sub: `~${md(ev.endDate)}` }
  return { kind: 'ongoing', label: '진행중', sub: `~${md(ev.endDate)}` }
}
