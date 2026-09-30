/* 루트 방문지(스톱) 키 — 같은 샵이 여러 층에 있으면 층마다 따로 방문지가 된다.
 *
 *   · route_shops.stop_floor : 이 방문지의 층 ("2층 136호(본점)", "3층" …). 한 층뿐인 샵은 '' (빈 값)
 *   · route_progress.stop_floor : 방문 체크도 같은 층 값으로 따로 남긴다
 *   · 화면·세션에서 쓰는 방문지 id = 샵 id  또는  "샵id@층"
 *     (층이 없는 방문지는 샵 id 그대로라 예전 루트·기록과 그대로 호환된다)
 *
 *   SQL: migrations/route_stop_floors.sql
 */

const SEP = '@'

/** 방문지 id — 층이 있으면 "샵id@층", 없으면 샵 id */
export function stopKey(shopId: string, stopFloor?: string | null): string {
  const f = (stopFloor ?? '').trim()
  return f ? `${shopId}${SEP}${f}` : shopId
}

/** 방문지 id → 샵 id + 층 */
export function parseStopKey(key: string): { shopId: string; stopFloor: string } {
  const i = key.indexOf(SEP)
  return i < 0 ? { shopId: key, stopFloor: '' } : { shopId: key.slice(0, i), stopFloor: key.slice(i + 1) }
}

/** 방문지 id → 샵 id (방문 기록·샵 상세 등 실제 샵이 필요한 곳) */
export function shopIdOf(key: string): string {
  return parseStopKey(key).shopId
}

/** route_progress / route_shops 행 → 방문지 id */
export function rowStopKey(row: { shop_id: string; stop_floor?: string | null }): string {
  return stopKey(row.shop_id, row.stop_floor)
}

/** 층 정보를 층별로 나누기 — "국제전자센터 2층 136호(본점) · 3층 · 9층(1·2호점)"
 *  → ["국제전자센터 2층 136호(본점)", "3층", "9층(1·2호점)"]
 *  괄호 안의 '·'(1·2호점)는 나누지 않는다. 서로 다른 층이 2개 이상일 때만 나눈다(아니면 []). */
export function splitFloorSegments(floorInfo: string | null | undefined): string[] {
  const text = (floorInfo ?? '').trim()
  if (!text) return []
  const floorOf = (s: string): string | null => {
    const b = s.match(/(?:B|지하\s*)(\d+)\s*층?/i)
    if (b) return `B${b[1]}`
    const m = s.match(/(\d+)\s*층/)
    return m ? m[1] : null
  }
  // 구분자(· , /)로 나누되 괄호 안은 그대로. 나눈 조각이 층이 없는 호수("135호(가챠점)")면 앞 조각에 다시 붙인다
  //  "국제전자센터 5층 · 3층 77·135호(가챠점) · 8층 45호" → ["국제전자센터 5층", "3층 77·135호(가챠점)", "8층 45호"]
  const segs: string[] = []
  let depth = 0, cur = '', sep = ''
  const flush = (nextSep: string) => {
    const piece = cur.trim()
    if (piece) {
      if (segs.length && floorOf(piece) === null) segs[segs.length - 1] += `${sep.trim() === '·' ? '·' : sep.trim()}${piece}`
      else segs.push(piece)
    }
    cur = ''; sep = nextSep
  }
  for (const ch of text) {
    if (ch === '(' || ch === '（') depth++
    else if ((ch === ')' || ch === '）') && depth > 0) depth--
    if (depth === 0 && (ch === '·' || ch === '•' || ch === ',' || ch === '/')) { flush(ch); continue }
    cur += ch
  }
  flush('')
  const withFloor = segs.filter(s => floorOf(s) !== null)
  if (withFloor.length < 2 || withFloor.length !== segs.length) return []
  const distinct = new Set(withFloor.map(floorOf))
  return distinct.size >= 2 ? withFloor : []
}

/** 불러온 루트의 route_shops 를 방문지 기준으로 바꾼다.
 *  shops.id  → 방문지 id (층이 있으면 "샵id@층")
 *  shops.shop_id → 실제 샵 id,  shops.floor_info → 이 방문지의 층
 *  층이 없는 방문지는 그대로라 예전 화면 코드가 전부 그대로 동작한다. */
export function withStopKeys<T extends { route_shops?: any[] | null }>(route: T): T {
  if (!route || !Array.isArray(route.route_shops)) return route
  const route_shops = route.route_shops.map((rs: any) => {
    const f = (rs?.stop_floor ?? '').trim()
    if (!rs?.shops) return rs
    const realId = rs.shops.shop_id ?? rs.shops.id
    if (!f) return { ...rs, shops: { ...rs.shops, shop_id: realId } }
    return {
      ...rs,
      shops: { ...rs.shops, id: stopKey(realId, f), shop_id: realId, stop_floor: f, floor_info: f, floor: null, unit: null },
    }
  })
  return { ...route, route_shops }
}
