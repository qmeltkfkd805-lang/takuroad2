/* 이벤트 import 스크립트용 — 지점만 다른 같은 이벤트를 하나로 묶기 위한 헬퍼 (events.series_key).
 *
 * 왜 필요한가: series_key가 비어 있으면 "AMNESIA WORLD Gratte (홍대점)"과 "(잠실점)"이
 * 이벤트 목록에 각각 한 장씩, 같은 포스터로 두 번 나온다.
 * 묶어두면 한 장으로 접히고 카드에 "2개 지점" 배지가 붙으며, 상세에서 서로 이동할 수 있다.
 *
 * 안전장치: 지점 꼬리표를 뗀 제목과 start_date·end_date가 "완전히" 같을 때만 묶는다.
 * 제목이 비슷하기만 한 건(회차가 다른 이벤트 등) 절대 묶지 않는다.
 *
 * 사용법 (이벤트를 insert 하기 직전에):
 *   import { resolveSeriesKey } from './lib/seriesKey.mjs'
 *   event.series_key = await resolveSeriesKey(db, {
 *     title: event.title, startDate: event.start_date, endDate: event.end_date,
 *   })
 */

/** "AMNESIA WORLD Gratte (홍대점)" → "AMNESIA WORLD Gratte" */
export function baseEventTitle(title) {
  return (title ?? '')
    .replace(/\s*[(（[]\s*[^)）\]]*점\s*[)）\]]\s*$/, '')
    .replace(/\s*[-–—]\s*\S*점\s*$/, '')
    .trim()
}

/** 새 묶음 키 — 제목(지점 꼬리표 제외) + 시작일. DB에서 눈으로 알아볼 수 있게. */
export function makeSeriesKey(title, startDate) {
  const base = baseEventTitle(title)
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `${base || 'event'}-${startDate}`.slice(0, 60)
}

/**
 * 이 이벤트에 넣을 series_key를 정한다.
 *   - 같은 제목·같은 기간의 이벤트가 이미 있고 키가 있으면 → 그 키 (기존 묶음에 합류)
 *   - 있는데 키가 없으면 → 새 키를 만들고 그 이벤트들에도 채워 넣은 뒤 그 키
 *   - 없으면 → null (단독 이벤트는 키를 넣지 않는다)
 *
 * excludeId를 주면 그 행은 후보에서 뺀다 (이미 insert 한 뒤에 부를 때).
 */
export async function resolveSeriesKey(db, { title, startDate, endDate, excludeId = null } = {}) {
  const base = baseEventTitle(title)
  if (base.length < 2 || !startDate || !endDate) return null

  const { data, error } = await db
    .from('events')
    .select('id, title, series_key')
    .ilike('title', `${base}%`)
    .eq('start_date', startDate)
    .eq('end_date', endDate)
    .limit(20)
  if (error) throw error

  // 앞부분만 같은 건 걸러내고, 꼬리표를 뗀 제목이 정확히 같은 것만 남긴다
  const siblings = (data ?? []).filter(
    (r) => r.id !== excludeId && baseEventTitle(r.title ?? '') === base,
  )
  if (siblings.length === 0) {
    console.log(`  ↳ 묶음 없음 (단독 이벤트): ${base}`)
    return null
  }

  const existing = siblings.find((r) => r.series_key)?.series_key
  if (existing) {
    console.log(`  ↳ 기존 묶음에 합류: ${existing} (${siblings.length}건)`)
    return existing
  }

  // 키가 아직 없는 묶음 — 새로 만들고 기존 형제들에게도 채워 넣는다
  const key = makeSeriesKey(title, startDate)
  const ids = siblings.map((r) => r.id)
  const upd = await db.from('events').update({ series_key: key }).in('id', ids)
  if (upd.error) throw upd.error
  console.log(`  ↳ 새 묶음 생성: ${key} (기존 ${ids.length}건에도 적용)`)
  return key
}
