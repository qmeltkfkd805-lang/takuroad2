/* 루트 만들기 — 코스 순서 자동 정하기
   - 'floor' (층별 안내): 같은 건물 샵끼리 모으고, 건물 안에서는 낮은 층 → 높은 층 (B2 → B1 → 1F → 5F)
   - 'walk'  (도보 안내): 첫 번째 샵에서 출발해 가장 가까운 곳을 차례로 (직선거리 기준)
   - 'both'  (둘 다): 건물 단위로 도보 동선을 짜고, 각 건물 안에서는 층 순서
   도보 동선은 지금 1번 샵(또는 1번 샵이 있는 건물)에서 출발한다. 층·좌표를 모르는 샵은 원래 순서대로 뒤에 둔다. */

export type AutoOrderMode = 'floor' | 'walk' | 'both'

type S = { id: string; lat?: number | null; lng?: number | null; place_id?: string | null; floor?: string | null; floor_info?: string | null; place_name?: string | null; places?: { name?: string | null } | null }

/** "B1", "지하 2층", "5층", "3F", "1층 102호" → 층 번호(지하는 음수). 못 읽으면 null */
export function floorNumber(s: S): number | null {
  const raw = `${s.floor ?? ''} ${s.floor_info ?? ''}`.trim()
  if (!raw) return null
  const t = raw.toUpperCase().replace(/\s+/g, '')
  let m = t.match(/(?:B|지하)(\d+)/)
  if (m) return -Number(m[1])
  m = t.match(/(\d+)(?:F|층)/)
  if (m) return Number(m[1])
  m = t.match(/^(\d+)/)
  return m ? Number(m[1]) : null
}

/** 같은 건물 판단 — 장소(place_id)가 같거나, 좌표가 약 15m 안 */
export function buildingKey(s: S): string {
  if (s.place_id) return `p:${s.place_id}`
  if (typeof s.lat === 'number' && typeof s.lng === 'number') return `c:${s.lat.toFixed(4)},${s.lng.toFixed(4)}`
  return `x:${s.id}`
}

function dist(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000, r = Math.PI / 180
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}
const coordOf = (list: S[]) => {
  const pts = list.filter(s => typeof s.lat === 'number' && typeof s.lng === 'number') as { lat: number; lng: number }[]
  if (!pts.length) return null
  return { lat: pts.reduce((a, p) => a + p.lat, 0) / pts.length, lng: pts.reduce((a, p) => a + p.lng, 0) / pts.length }
}

/** 층 순서 — 원래 순서를 최대한 유지하는 안정 정렬(층 모르는 곳은 뒤로) */
function byFloor<T extends S>(list: T[]): T[] {
  return list.map((s, i) => ({ s, i, f: floorNumber(s) }))
    .sort((a, b) => (a.f === null ? 1 : 0) - (b.f === null ? 1 : 0) || (a.f ?? 0) - (b.f ?? 0) || a.i - b.i)
    .map(x => x.s)
}

/** 가까운 곳부터(최근접 이웃) — 첫 항목은 고정 */
function nearestChain<U>(items: U[], pos: (u: U) => { lat: number; lng: number } | null): U[] {
  if (items.length <= 2) return items.slice()
  const out: U[] = [items[0]]
  const rest = items.slice(1)
  const noPos = rest.filter(u => !pos(u))
  let pool = rest.filter(u => pos(u))
  let cur = pos(items[0])
  while (pool.length) {
    let bi = 0
    if (cur) { let bd = Infinity; pool.forEach((u, i) => { const d = dist(cur!, pos(u)!); if (d < bd - 0.5) { bd = d; bi = i } }) }
    const next = pool.splice(bi, 1)[0]
    out.push(next); cur = pos(next) ?? cur
  }
  return [...out, ...noPos]
}

/** 건물 단위로 묶기(처음 나온 순서 유지) */
function groupByBuilding<T extends S>(list: T[]): T[][] {
  const map = new Map<string, T[]>()
  list.forEach(s => { const k = buildingKey(s); if (!map.has(k)) map.set(k, []); map.get(k)!.push(s) })
  return Array.from(map.values())
}

export function autoOrder<T extends S>(list: T[], mode: AutoOrderMode): T[] {
  if (list.length <= 1) return list.slice()
  if (mode === 'walk') {
    const pos = (s: T) => (typeof s.lat === 'number' && typeof s.lng === 'number' ? { lat: s.lat, lng: s.lng } : null)
    return nearestChain(list, pos)
  }
  // 층별·둘 다: 건물로 묶는다. 출발 샵이 있는 건물이 첫 묶음
  const groups = groupByBuilding(list)
  const ordered = mode === 'both'
    ? nearestChain(groups, g => coordOf(g))
    : groups
  return ordered.flatMap(g => byFloor(g))
}

/* ── 층별 그룹 (루트 순서·코스 안내에서 "5층" 같은 묶음 제목과 층 지도 이미지에 쓴다) ── */
/** 같은 건물 + 같은 층이면 같은 키 → 층 지도 이미지도 이 키로 저장 */
export function floorGroupKey(s: S): string {
  const f = floorNumber(s)
  return `${buildingKey(s)}|${f === null ? 'x' : f}`
}
/** "B1" / "5층" / null(층 정보 없음) */
export function floorText(s: S): string | null {
  const f = floorNumber(s)
  return f === null ? null : f < 0 ? `B${-f}` : `${f}층`
}
/** 묶음 제목 — "AK플라자 수원점 · 5층" (장소 이름이 없으면 층만) */
export function floorGroupLabel(s: S): string {
  const f = floorText(s)
  const place = (s.place_name ?? s.places?.name ?? '').trim()
  if (place && f) return `${place} · ${f}`
  return f ?? (place ? `${place} · 층 정보 없음` : '층 정보 없음')
}
/** 이 목록에 층별로 묶어 보여줄 만한 게 있는지 — 층 정보가 있는 샵이 하나라도 있으면 */
export function hasFloorGroups(list: S[]): boolean {
  return list.some(s => floorNumber(s) !== null)
}
