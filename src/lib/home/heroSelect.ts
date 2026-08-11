// 히어로 자동추천 순수 로직 (supabase 의존 없음 — 단위 테스트 가능)
import { daysUntil } from './heroBadge'

export interface AutoEventCand {
  eventId: string
  tagId: string | null
  /** YYYY-MM-DD, 호출부에서 오늘 이후(시작예정)만 넘긴다 */
  startDate: string
  saveCount: number
  visitCount: number
  /** ISO */
  createdAt: string
}

/** 시작일까지 창(window) 등급: 0~7일=0(최우선), 8~14일=1, 그 외=2 */
export function windowTier(startDate: string, today: string): number {
  const d = daysUntil(startDate, today)
  if (d >= 0 && d <= 7) return 0
  if (d >= 8 && d <= 14) return 1
  return 2
}

export interface RankOpts {
  favTagIds: Set<string>
  isLoggedIn: boolean
  today: string
}

/**
 * 시작 예정 이벤트 랭킹 (지역 미사용).
 * 정렬: 최애 관련 → 시작창(0~7 우선) → 저장·관심 수 → 최신 등록.
 * 비로그인은 최애 파티션이 무력화되어 인기순→최신이 된다.
 */
export function rankAutoEvents(cands: AutoEventCand[], opts: RankOpts): AutoEventCand[] {
  const favRank = (c: AutoEventCand) =>
    opts.isLoggedIn && c.tagId && opts.favTagIds.has(c.tagId) ? 0 : 1
  const pop = (c: AutoEventCand) => c.saveCount + c.visitCount

  return [...cands].sort((a, b) => {
    const fr = favRank(a) - favRank(b)
    if (fr !== 0) return fr
    const wt = windowTier(a.startDate, opts.today) - windowTier(b.startDate, opts.today)
    if (wt !== 0) return wt
    const pd = pop(b) - pop(a)
    if (pd !== 0) return pd
    // 최신 등록
    return (b.createdAt || '').localeCompare(a.createdAt || '')
  })
}

/** 이 후보가 최애 관련인지 (origin 결정용) */
export function isFavoriteCand(c: AutoEventCand, opts: RankOpts): boolean {
  return opts.isLoggedIn && !!c.tagId && opts.favTagIds.has(c.tagId)
}

/**
 * 수동 슬롯을 먼저, 남는 자리를 자동으로 채워 최대 max개.
 * key 중복은 제거(수동 우선). 자동 후보는 이미 수동 event id를 제외한 상태로 넘어온다.
 */
export function mergeToMax<T>(manual: T[], auto: T[], keyOf: (x: T) => string, max = 5): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of [...manual, ...auto]) {
    if (out.length >= max) break
    const k = keyOf(item)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(item)
  }
  return out
}
