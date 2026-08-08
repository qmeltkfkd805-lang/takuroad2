/* 루트 지도 기하 유틸 — 순수 함수. 데이터 좌표는 수정하지 않고 렌더링 계산만 담당.
   geometry 는 ORS 규격 [경도(lng), 위도(lat)] 배열. */

export interface LL { lat: number; lng: number }
export type LngLat = [number, number]   // [lng, lat]

const R = 6371000
const rad = (d: number) => (d * Math.PI) / 180

export function haversine(a: LL, b: LL): number {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** 진행 방향의 화면 회전각(도, 북=0 시계방향). 위를 향한 아이콘을 이 각도로 rotate 하면 진행방향을 가리킴. */
export function screenBearing(a: LL, b: LL): number {
  const midLat = rad((a.lat + b.lat) / 2)
  const dLng = (b.lng - a.lng) * Math.cos(midLat)
  const dLat = b.lat - a.lat
  return (Math.atan2(dLng, dLat) * 180) / Math.PI
}

/** 경로를 따라 일정 거리 간격으로 방향 화살표를 배치. */
export function arrowMarkers(geometry: LngLat[], everyMeters = 130, max = 16): { lat: number; lng: number; angle: number }[] {
  if (!geometry || geometry.length < 2) return []
  const pts: LL[] = geometry.map(([lng, lat]) => ({ lat, lng }))
  const out: { lat: number; lng: number; angle: number }[] = []
  let acc = 0
  for (let i = 1; i < pts.length; i++) {
    const seg = haversine(pts[i - 1], pts[i])
    acc += seg
    if (acc >= everyMeters) {
      acc = 0
      const mid = { lat: (pts[i - 1].lat + pts[i].lat) / 2, lng: (pts[i - 1].lng + pts[i].lng) / 2 }
      out.push({ lat: mid.lat, lng: mid.lng, angle: screenBearing(pts[i - 1], pts[i]) })
      if (out.length >= max) break
    }
  }
  return out
}

function midpoint(a: LL, b: LL): LL { return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 } }
/** 균일 간격(stepM)으로 리샘플 — 판별 정확도를 위해(ORS는 직선구간을 긴 선분 하나로 줄 수 있음) */
function densify(geom: LngLat[], stepM: number): LngLat[] {
  if (geom.length < 2) return geom.slice()
  const out: LngLat[] = [geom[0]]
  for (let i = 1; i < geom.length; i++) {
    const a: LL = { lat: geom[i - 1][1], lng: geom[i - 1][0] }
    const b: LL = { lat: geom[i][1], lng: geom[i][0] }
    const steps = Math.max(1, Math.floor(haversine(a, b) / stepM))
    for (let s = 1; s <= steps; s++) {
      const t = s / steps
      out.push([geom[i - 1][0] + (geom[i][0] - geom[i - 1][0]) * t, geom[i - 1][1] + (geom[i][1] - geom[i - 1][1]) * t])
    }
  }
  return out
}
function angleDiff(a: number, b: number): number { let d = Math.abs(a - b) % 360; if (d > 180) d = 360 - d; return d }
function pathLen(pts: LL[]): number { let s = 0; for (let i = 1; i < pts.length; i++) s += haversine(pts[i - 1], pts[i]); return s }

export interface RouteRun { type: 'normal' | 'return'; pts: LngLat[]; startIndex: number }

/** 되돌아가는 구간 판별.
 *  "루트 순서상 과거 경로와 일정 거리(D) 이내에서 반대 방향(≈180°)으로 진행하는 선분"만 return 으로 표시.
 *  ORS 좌표/순서는 변경하지 않고, 연속 구간(run)으로 분할해 돌려준다. */
export function splitReturnRuns(
  geometry: LngLat[],
  opts: { distanceM?: number; antiDeg?: number; gap?: number; minReturnM?: number } = {},
): { runs: RouteRun[]; hasReturn: boolean; turnPoints: LL[] } {
  const D = opts.distanceM ?? 22
  const ANTI = opts.antiDeg ?? 35
  const GAP = opts.gap ?? 4
  const MINRET = opts.minReturnM ?? 22
  if (!geometry || geometry.length < 4) return { runs: geometry?.length ? [{ type: 'normal', pts: geometry, startIndex: 0 }] : [], hasReturn: false, turnPoints: [] }
  const geo = densify(geometry, 8)
  const n = geo.length

  const toLL = ([lng, lat]: LngLat): LL => ({ lat, lng })
  const segMid: LL[] = [], segBrg: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const a = toLL(geo[i]), b = toLL(geo[i + 1])
    segMid.push(midpoint(a, b)); segBrg.push(screenBearing(a, b))
  }

  // 공간 격자(약 D 간격)로 이전 선분만 조회 → 역방향 근접 판별
  const lat0 = geo[0][1]
  const dLat = D / 111320
  const dLng = D / (111320 * Math.cos(rad(lat0)) || 1)
  const grid = new Map<string, number[]>()
  const key = (p: LL) => `${Math.floor(p.lat / dLat)}|${Math.floor(p.lng / dLng)}`
  const isReturn: boolean[] = new Array(n - 1).fill(false)

  for (let i = 0; i < n - 1; i++) {
    const ci = Math.floor(segMid[i].lat / dLat), cj = Math.floor(segMid[i].lng / dLng)
    let hit = false
    for (let di = -1; di <= 1 && !hit; di++) {
      for (let dj = -1; dj <= 1 && !hit; dj++) {
        const arr = grid.get(`${ci + di}|${cj + dj}`)
        if (!arr) continue
        for (const j of arr) {
          if (i - j <= GAP) continue
          if (haversine(segMid[i], segMid[j]) <= D && angleDiff(segBrg[i], segBrg[j]) >= 180 - ANTI) { hit = true; break }
        }
      }
    }
    isReturn[i] = hit
    const k = `${ci}|${cj}`
    const list = grid.get(k); if (list) list.push(i); else grid.set(k, [i])
  }

  // 세그먼트 → 연속 run 으로 그룹화 (경계점 공유해 선이 이어지게)
  let runs: RouteRun[] = []
  let start = 0, cur = isReturn[0]
  for (let i = 1; i < n - 1; i++) {
    if (isReturn[i] !== cur) { runs.push({ type: cur ? 'return' : 'normal', pts: geo.slice(start, i + 1), startIndex: start }); start = i; cur = isReturn[i] }
  }
  runs.push({ type: cur ? 'return' : 'normal', pts: geo.slice(start, n), startIndex: start })

  // 너무 짧은 복귀 run 은 노이즈로 보고 일반으로 되돌린 뒤, 같은 타입 인접 run 병합
  runs.forEach(r => { if (r.type === 'return' && pathLen(r.pts.map(toLL)) < MINRET) r.type = 'normal' })
  const merged: RouteRun[] = []
  for (const r of runs) {
    const last = merged[merged.length - 1]
    if (last && last.type === r.type) last.pts = last.pts.concat(r.pts.slice(1))
    else merged.push({ type: r.type, pts: r.pts.slice(), startIndex: r.startIndex })
  }

  const turnPoints = merged.filter(r => r.type === 'return').map(r => toLL(r.pts[0]))
  return { runs: merged, hasReturn: turnPoints.length > 0, turnPoints }
}

/** 선분을 진행방향 기준 왼쪽으로 meters 만큼 평행이동(복귀선을 살짝 옆으로 빼서 왕복이 보이게).
 *  좌표 자체가 아니라 렌더용 사본만 이동. */
export function offsetPath(path: LL[], meters: number): LL[] {
  if (path.length < 2) return path.slice()
  const out: LL[] = []
  const mPerLat = 111320
  for (let i = 0; i < path.length; i++) {
    const a = path[Math.max(0, i - 1)]
    const b = path[Math.min(path.length - 1, i + 1)]
    const midLat = rad((a.lat + b.lat) / 2)
    const dx = (b.lng - a.lng) * Math.cos(midLat)
    const dy = b.lat - a.lat
    const len = Math.hypot(dx, dy) || 1
    // 왼쪽 법선 (-dy, dx) 정규화
    const nx = -dy / len, ny = dx / len
    const dLat = (meters / mPerLat) * ny
    const dLng = (meters / (mPerLat * Math.cos(rad(path[i].lat)))) * nx
    out.push({ lat: path[i].lat + dLat, lng: path[i].lng + dLng })
  }
  return out
}
