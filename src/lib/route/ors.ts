/* OpenRouteService foot-walking 호출 어댑터.
   · 좌표는 [경도(lng), 위도(lat)] 순서로 보낸다(ORS 규격).
   · 연속 동일 좌표(같은 건물 내 여러 샵)는 라우팅 전 합친다(길이 0 구간 방지).
   · 경유지 50점 초과 시 50점 윈도우(경계 1점 겹침)로 분할 후 이어붙인다.
   · 결과 geometry 는 [[lng,lat], ...] 그대로 반환(프론트에서 카카오 LatLng 로 변환). */

import type { LatLng } from './pathHash'

const ORS_URL = 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson'
const MAX_WAYPOINTS = 50

export const ORS_PROVIDER = 'ors-foot-walking'
export const ORS_ATTRIBUTION = '© openrouteservice.org by HeiGIT | © OpenStreetMap contributors'

export interface OrsPath {
  status: 'ok' | 'partial' | 'failed'
  geometry: [number, number][]      // [lng, lat]
  distance_m: number | null
  duration_min: number | null
  failed_segments: number[]         // 실패한 청크 인덱스
  error?: string                    // 첫 실패 사유(디버깅용)
}

/** 연속 동일 좌표 합치기 (같은 건물 내 여러 샵) */
export function collapseConsecutive(points: LatLng[]): LatLng[] {
  const out: LatLng[] = []
  for (const s of points) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.lat - s.lat) < 1e-6 && Math.abs(last.lng - s.lng) < 1e-6) continue
    out.push(s)
  }
  return out
}

function chunkWaypoints(points: LatLng[], size: number): LatLng[][] {
  if (points.length <= size) return [points]
  const chunks: LatLng[][] = []
  for (let i = 0; i < points.length - 1; i += size - 1) chunks.push(points.slice(i, i + size))
  return chunks
}

async function callSegment(points: LatLng[], apiKey: string) {
  const res = await fetch(ORS_URL, {
    method: 'POST',
    headers: { Authorization: apiKey, 'Content-Type': 'application/json', Accept: 'application/geo+json' },
    body: JSON.stringify({ coordinates: points.map(p => [p.lng, p.lat]), instructions: false }),
    // 서버 간 호출 — 캐시 안 함
    cache: 'no-store',
  })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try { const j = await res.json(); msg = j?.error?.message || msg } catch { /* noop */ }
    return { ok: false as const, error: msg }
  }
  const gj = await res.json()
  const f = gj?.features?.[0]
  if (!f?.geometry?.coordinates?.length) return { ok: false as const, error: 'no route' }
  return {
    ok: true as const,
    coords: f.geometry.coordinates as [number, number][],
    distance: Math.round(f.properties?.summary?.distance ?? 0),
    duration: Math.round((f.properties?.summary?.duration ?? 0) / 60),
  }
}

/** 방문순서 좌표 → 실제 도보 경로. 입력 좌표는 이미 유효(lat/lng 존재) 가정. */
export async function fetchOrsPath(points: LatLng[], apiKey: string): Promise<OrsPath> {
  const routed = collapseConsecutive(points)
  if (routed.length < 2) return { status: 'failed', geometry: [], distance_m: null, duration_min: null, failed_segments: [] }

  const chunks = chunkWaypoints(routed, MAX_WAYPOINTS)
  let geometry: [number, number][] = []
  let distance = 0, duration = 0
  const failed: number[] = []
  let firstError: string | undefined

  for (let c = 0; c < chunks.length; c++) {
    const r = await callSegment(chunks[c], apiKey)
    if (!r.ok) { failed.push(c); if (!firstError) firstError = r.error; continue }
    geometry = geometry.concat(c === 0 ? r.coords : r.coords.slice(1))  // 조인점 중복 제거
    distance += r.distance
    duration += r.duration
  }

  const status: OrsPath['status'] = failed.length === 0 ? 'ok' : (geometry.length ? 'partial' : 'failed')
  return {
    status,
    geometry,
    distance_m: geometry.length ? distance : null,
    duration_min: geometry.length ? duration : null,
    failed_segments: failed,
    error: firstError,
  }
}
