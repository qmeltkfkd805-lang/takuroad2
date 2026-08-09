/* 루트 카드 공용 데이터 헬퍼 — 홈(/routes)과 목록(/routes/all)이 함께 사용.
   전부 실제 route_shops 기준이며 임의 좌표/경로를 만들지 않는다. */
import { shopRegion } from '@/lib/shop/quickCompleteness'
import { formatDistance } from '@/hooks/useCurrentLocation'

/** 루트 지도 표현 모드 — 화면 역할별로 마커·컨트롤 밀도를 다르게 한다.
 *  preview: 상호작용/컨트롤 없음, 출발·도착+대표 스팟만 (홈 미리보기)
 *  detail : 전체 루트·전체 스팟, 탭 시 전체화면 (루트 상세)
 *  run    : 현재 위치·다음 스팟 중심 전체화면 (실행 지도, RouteMap 사용) */
export type RouteMapVariant = 'preview' | 'detail' | 'run'

/** preview 모드에서 마커로 노출할 대표 스팟 인덱스(출발·도착 + 중간 최대 2곳). */
export function representativeStopIndices(n: number): number[] {
  if (n <= 4) return Array.from({ length: n }, (_, i) => i)   // 적으면 전부
  const set = new Set<number>([0, n - 1, Math.round((n - 1) / 3), Math.round(((n - 1) * 2) / 3)])
  return Array.from(set).sort((a, b) => a - b)
}

export const DIFF: Record<number, { l: string; c: string }> = {
  1: { l: '가볍게', c: '#22c55e' }, 2: { l: '반나절', c: '#eab308' }, 3: { l: '하루', c: '#ef4444' },
}

const sortedShops = (r: any): any[] =>
  (r.route_shops ?? []).slice().sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((rs: any) => rs.shops)

export const rtStops = (r: any): { lat: number; lng: number }[] =>
  sortedShops(r).filter((s: any) => s && typeof s.lat === 'number' && typeof s.lng === 'number').map((s: any) => ({ lat: s.lat, lng: s.lng }))

export const rtNames = (r: any): string[] => sortedShops(r).map((s: any) => s?.name).filter(Boolean)

/** 히어로 체인용 — 같은 건물(같은 place_id)로 연속된 샵은 장소 이름 하나로 묶는다 */
export const rtChain = (r: any): string[] => {
  const shops = sortedShops(r).filter(Boolean)
  const out: string[] = []
  let lastPlace: string | null = null
  for (const s of shops) {
    const pid = s.place_id ?? null
    if (pid && pid === lastPlace) continue      // 같은 건물 연속 → 건너뜀
    out.push(pid ? (s.places?.name || s.name) : s.name)
    lastPlace = pid
  }
  return out
}

/** 지도 핀용 — '실제로 같은 좌표에 겹치는' 연속 스팟만 하나의 핀으로 묶는다.
 *  좌표가 다르면(같은 건물로 등록됐어도) 핀을 각각 유지해 경로가 사라지지 않게 한다.
 *  각 그룹은 방문 순서 범위(from~to)를 갖는다. (실제 데이터만 사용, 임의 좌표 생성 없음) */
export interface StopGroup { lat: number; lng: number; from: number; to: number; count: number; name: string }
export const rtStopGroups = (r: any): StopGroup[] => {
  const shops = sortedShops(r).filter((s: any) => s && typeof s.lat === 'number' && typeof s.lng === 'number')
  const groups: StopGroup[] = []
  shops.forEach((s: any, i: number) => {
    const key = `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`   // ~1m: 완전히 겹치는 핀만 병합
    const order = i + 1
    const last = groups[groups.length - 1] as (StopGroup & { key?: string }) | undefined
    if (last && (last as any).key === key) { last.to = order; last.count++ }
    else groups.push({ ...({ key } as any), lat: s.lat, lng: s.lng, from: order, to: order, count: 1, name: s.places?.name || s.name })
  })
  return groups
}

export const rtTags = (r: any): string[] =>
  Array.from(new Set((r.route_shops ?? []).flatMap((rs: any) => (rs.shops?.shop_tags ?? []).map((st: any) => st.tags?.name).filter(Boolean))))

export const rtRegions = (r: any): string[] =>
  Array.from(new Set((r.route_shops ?? []).map((rs: any) => rs.shops ? shopRegion(rs.shops) : null).filter((x: any) => x && x !== '지역 미정')))

export const fmtDur = (min?: number | null): string | null =>
  !min ? null : min >= 60 ? `약 ${Math.round(min / 60)}시간` : `${min}분`

/** '수원 · 4곳 · 약 3시간 · 2.4km' — 있는 값만 이어붙임 */
export function metaLine(r: any): string {
  const parts: string[] = []
  const region = rtRegions(r)[0]
  if (region) parts.push(region)
  parts.push(`${r.route_shops?.length ?? 0}곳`)
  const d = fmtDur(r.total_duration_min); if (d) parts.push(d)
  if (r.total_distance_m) parts.push(formatDistance(r.total_distance_m))
  return parts.join(' · ')
}

/** 좁은 영역용 — 거리 제외 */
export function metaShort(r: any): string {
  const parts: string[] = []
  const region = rtRegions(r)[0]
  if (region) parts.push(region)
  parts.push(`${r.route_shops?.length ?? 0}곳`)
  const d = fmtDur(r.total_duration_min); if (d) parts.push(d)
  return parts.join(' · ')
}
