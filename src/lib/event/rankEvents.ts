import { getEventStatus, EventStatusKind, EventStatusResult } from '@/lib/utils/eventStatus'

// 이벤트 홈이 정렬·분류에 필요로 하는 최소한의 모양.
// 실제 카드 데이터(제목·샵·커버…)는 이 위에 얹혀 다녀도 상관없다.
export interface RankableEvent {
  id: string
  tagId: string | null
  startDate: string | null
  endDate: string | null
}

export interface RankedEvent<T extends RankableEvent> {
  event: T
  status: EventStatusResult
  score: number
  isFavorite: boolean
}

export interface EventHomeSections<T extends RankableEvent> {
  endsToday: RankedEvent<T>[]   // ⏰ 오늘 종료 — 지금 아니면 없는 것
  ongoing: RankedEvent<T>[]     // 🔥 진행 중  — 언젠가 가면 되는 것
  upcoming: RankedEvent<T>[]    // 📅 곧 시작  — 캘린더에 적을 것
}

/**
 * 노출 우선순위 (사용자 확정)
 *   오늘 종료 > 종료 임박 > 진행중 = 오늘 시작 > 곧 시작
 *   여기에 "내 최애 작품"이면 +50 → "오늘 종료 + 최애"가 항상 최상단
 */
const KIND_SCORE: Record<EventStatusKind, number> = {
  ends_today: 180,
  ending_soon: 140,
  starts_today: 100,
  ongoing: 100,
  upcoming: 20,
  ended: -1000,
  unknown: 0,
}

const FAVORITE_BONUS = 50

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** 오늘부터 며칠 뒤인지 (과거면 음수) */
export function daysUntil(dateStr: string, now: Date = new Date()): number {
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - startOfDay(now).getTime()) / 86400000)
}

function scoreOf(
  status: EventStatusResult,
  ev: RankableEvent,
  isFavorite: boolean,
  now: Date,
): number {
  let score = KIND_SCORE[status.kind]

  // 곧 시작하는 것들끼리는 시작일이 가까운 쪽이 위로 (최대 +19)
  if (status.kind === 'upcoming' && ev.startDate) {
    score += Math.max(0, 20 - daysUntil(ev.startDate, now))
  }
  // 진행 중인 것들끼리는 끝나는 날이 가까운 쪽이 위로 (최대 +9)
  if (status.kind === 'ongoing' && ev.endDate) {
    score += Math.max(0, 10 - daysUntil(ev.endDate, now))
  }
  if (isFavorite) score += FAVORITE_BONUS

  return score
}

/** 후보 → 점수 → 정렬. 종료된 이벤트는 빠진다. */
export function rankEvents<T extends RankableEvent>(
  events: T[],
  opts: { favoriteTagIds?: Set<string>; now?: Date } = {},
): RankedEvent<T>[] {
  const now = opts.now ?? new Date()
  const favorites = opts.favoriteTagIds ?? new Set<string>()

  return events
    .map(event => {
      const status = getEventStatus(event, now)
      const isFavorite = !!event.tagId && favorites.has(event.tagId)
      return { event, status, isFavorite, score: scoreOf(status, event, isFavorite, now) }
    })
    .filter(r => r.status.kind !== 'ended')
    .sort((a, b) => b.score - a.score)
}

/** 정렬된 결과를 이벤트 홈의 세 섹션으로 나눈다. 순서는 섹션 안에서도 유지된다. */
export function toEventHomeSections<T extends RankableEvent>(
  ranked: RankedEvent<T>[],
): EventHomeSections<T> {
  const sections: EventHomeSections<T> = { endsToday: [], ongoing: [], upcoming: [] }

  for (const r of ranked) {
    if (r.status.kind === 'ends_today') sections.endsToday.push(r)
    else if (r.status.kind === 'upcoming') sections.upcoming.push(r)
    else sections.ongoing.push(r)   // ongoing · ending_soon · starts_today
  }
  return sections
}

/** 히어로용 — "이번 주 가장 핫한 이벤트" 한 건. 없으면 null. */
export function pickHeroEvent<T extends RankableEvent>(ranked: RankedEvent<T>[]): RankedEvent<T> | null {
  return ranked[0] ?? null
}
