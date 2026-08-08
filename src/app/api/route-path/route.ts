import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { waypointHash, type LatLng } from '@/lib/route/pathHash'
import { fetchOrsPath, ORS_PROVIDER, ORS_ATTRIBUTION } from '@/lib/route/ors'

export const runtime = 'nodejs'

/* 루트의 실제 도보 경로(ORS) 제공.
   1) 좌표+순서 해시가 저장분과 같으면 저장분 그대로 반환(ORS 미호출)
   2) 다르면 ORS 호출 → Service Role 로 upsert → 반환
   실패 시 geometry 없이 status만 반환(프론트는 직선 대신 핀만 표시). */
export async function GET(request: NextRequest) {
  const routeId = request.nextUrl.searchParams.get('routeId')
  if (!routeId) return NextResponse.json({ status: 'failed', error: 'routeId 필요' }, { status: 400 })

  try {
  const supabase = await createServerClient()

  // 방문순서대로 스팟 좌표 조회 (RLS 적용 — 비공개 루트는 소유자만)
  const { data: route, error } = await supabase
    .from('routes')
    .select('id, route_shops ( sort_order, shops ( lat, lng ) )')
    .eq('id', routeId)
    .maybeSingle()

  if (error || !route) return NextResponse.json({ status: 'failed', error: '루트를 찾을 수 없어요' }, { status: 404 })

  const stops = ((route as any).route_shops ?? [])
    .slice()
    .sort((a: any, b: any) => a.sort_order - b.sort_order)
  const allCoords: (LatLng | null)[] = stops.map((rs: any) =>
    rs.shops && typeof rs.shops.lat === 'number' && typeof rs.shops.lng === 'number'
      ? { lat: rs.shops.lat, lng: rs.shops.lng } : null)
  const valid = allCoords.filter(Boolean) as LatLng[]
  const missing = allCoords.length - valid.length

  const base = { provider: ORS_PROVIDER, attribution: ORS_ATTRIBUTION, missing_stops: missing }

  if (valid.length < 2) {
    return NextResponse.json({ ...base, status: 'insufficient', geometry: [], distance_m: null, duration_min: null })
  }

  const hash = waypointHash(valid, ORS_PROVIDER)

  // 저장분 확인
  const { data: cached } = await supabase
    .from('route_paths')
    .select('waypoint_hash, geometry, distance_m, duration_min, attribution')
    .eq('route_id', routeId)
    .maybeSingle()

  if (cached && (cached as any).waypoint_hash === hash) {
    const c = cached as any
    return NextResponse.json({
      ...base, status: 'ok', cached: true,
      geometry: c.geometry, distance_m: c.distance_m, duration_min: c.duration_min,
      attribution: c.attribution ?? ORS_ATTRIBUTION, failed_segments: [],
    })
  }

  // ORS 호출
  const apiKey = process.env.ORS_API_KEY
  if (!apiKey) {
    console.error('[route-path] ORS_API_KEY 미설정 — .env.local 확인 후 서버 재시작 필요')
    return NextResponse.json({ ...base, status: 'failed', error: 'ORS_API_KEY 미설정', geometry: [] }, { status: 500 })
  }

  const path = await fetchOrsPath(valid, apiKey)
  if (path.status !== 'ok') console.error('[route-path] ORS 실패:', routeId, path.status, path.error)

  // 성공/부분성공만 저장 (Service Role, RLS 우회). 저장 실패해도 경로 표시는 유지.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (path.status !== 'failed' && path.geometry.length && url && serviceKey) {
    try {
      const admin = createServiceClient(url, serviceKey)
      const { error: saveErr } = await admin.from('route_paths').upsert({
        route_id: routeId,
        provider: ORS_PROVIDER,
        waypoint_hash: hash,
        geometry: path.geometry,
        distance_m: path.distance_m,
        duration_min: path.duration_min,
        attribution: ORS_ATTRIBUTION,
        calculated_at: new Date().toISOString(),
      } as any, { onConflict: 'route_id' })
      if (saveErr) console.error('[route-path] 저장 실패:', saveErr.message)
    } catch (e) {
      console.error('[route-path] 저장 예외:', (e as Error)?.message)
    }
  } else if (path.status !== 'failed' && path.geometry.length && !serviceKey) {
    console.warn('[route-path] SUPABASE_SERVICE_ROLE_KEY 없음 — 이번 경로는 저장 없이 표시만')
  }

  return NextResponse.json({
    ...base,
    status: path.status,
    cached: false,
    geometry: path.geometry,
    distance_m: path.distance_m,
    duration_min: path.duration_min,
    failed_segments: path.failed_segments,
    error: path.error,
  })
  } catch (e) {
    console.error('[route-path] 예외:', (e as Error)?.message)
    return NextResponse.json({ status: 'failed', error: (e as Error)?.message || '서버 오류' }, { status: 500 })
  }
}
