/* 여러 지점에서 하는 같은 이벤트 묶기 (events.series_key)
 *
 * 목록에 같은 포스터가 지점 수만큼 뜨는 걸 막는다. DB는 그대로 두고 화면에서만 접는다.
 *
 * ⭐ 정렬이 끝난 뒤에 부르는 게 핵심이다.
 *    rankEvents로 정렬한 다음 접으면, 각 그룹의 "맨 앞"이 곧 가장 임박한(=가장 보여줄 만한) 지점이 된다.
 *    지역 필터가 걸려 있으면 그 지역 지점만 남아 있으므로, 대표도 자연히 그 지역 지점이 된다.
 *    그래서 대표 카드의 날짜·상태 배지·장소는 전부 "그 지점의 것"이고 거짓말이 없다.
 */

export interface SeriesItem {
  id: string
  seriesKey?: string | null
}

export type Collapsed<T> = T & { branchCount: number }

/** 같은 series_key끼리 접어 대표 1개만 남긴다. 키가 없으면 그대로 1개짜리 그룹. */
export function collapseEventSeries<T extends SeriesItem>(items: T[]): Collapsed<T>[] {
  const out: Collapsed<T>[] = []
  const indexByKey = new Map<string, number>()

  for (const it of items) {
    const key = (it.seriesKey ?? '').trim()
    if (!key) { out.push({ ...it, branchCount: 1 }); continue }
    const at = indexByKey.get(key)
    if (at === undefined) {
      indexByKey.set(key, out.length)
      out.push({ ...it, branchCount: 1 })
    } else {
      out[at].branchCount += 1
    }
  }
  return out
}

/** 접었을 때 몇 장이 되는지 (탭 옆 개수용) */
export function countCollapsed<T extends SeriesItem>(items: T[]): number {
  const keys = new Set<string>()
  let singles = 0
  for (const it of items) {
    const key = (it.seriesKey ?? '').trim()
    if (key) keys.add(key)
    else singles++
  }
  return keys.size + singles
}
