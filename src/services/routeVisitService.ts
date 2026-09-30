import { createClient } from '@/lib/supabase/client'
import { progressKeys, addProgress, removeProgress } from '@/lib/route/progressRows'

// 이 루트에서 내가 방문 체크한 방문지 id 목록 (샵 id, 층마다 나뉜 곳은 "샵id@층" — lib/route/stopKey)
export async function getVisitedShopIds(routeId: string, userId: string): Promise<string[]> {
  return Array.from(await progressKeys(createClient(), routeId, userId))
}

/** 방문 체크 켜기/끄기 — shopId 는 방문지 id (층마다 나뉜 곳은 "샵id@층") */
export async function setShopVisited(routeId: string, shopId: string, userId: string, visited: boolean): Promise<boolean> {
  const supabase = createClient()
  return visited
    ? addProgress(supabase, routeId, userId, [shopId])
    : removeProgress(supabase, routeId, userId, [shopId])
}

// 이 루트를 이미 완주(완주 기록 보유)했는지
export async function isRouteCompleted(routeId: string, userId: string): Promise<boolean> {
  const supabase = createClient()
  const { data } = await supabase.from('route_completions').select('id').eq('route_id', routeId).eq('user_id', userId).maybeSingle()
  return !!data
}

// 완주 기록 남기기 — 이미 있으면 재기록하지 않음(배찌·완주수는 딱 한 번만 반영)
/* 완주 기록은 서버가 한다.
   브라우저는 route_completions 에 INSERT 권한이 없고, 완주 조건도 서버가
   route_progress 로 직접 대조한다. userId 는 서버가 세션에서 가져가므로 보내지 않는다.
   EXP 는 0 이다 — 보상은 GPS 세션이 검증한 완주에만 간다. */
export async function recordRouteCompletion(routeId: string, userId: string): Promise<{ firstTime: boolean; gained: number }> {
  void userId
  try {
    const res = await fetch('/api/route/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routeId }),
    })
    const json = await res.json().catch(() => null) as any
    if (!res.ok) { console.error('[루트 완주 기록 실패]', res.status, json?.error); return { firstTime: false, gained: 0 } }
    return { firstTime: !!json?.recorded, gained: Number(json?.gained) || 0 }
  } catch (e) {
    console.error('[루트 완주 기록 실패]', e)
    return { firstTime: false, gained: 0 }
  }
}

// 다시 도전 — 방문 체크와 이어하던 따라가기 세션을 서버가 초기화한다.
// 샵 방문 기록·완주 기록·완주 횟수·후기는 그대로 둔다. (/api/route/reset)
export async function resetRouteProgress(routeId: string, userId: string): Promise<boolean> {
  void userId
  try {
    const res = await fetch('/api/route/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ routeId }) })
    return res.ok
  } catch { return false }
}

export interface CompletedRoute {
  id: string
  title: string
  shareToken: string | null
  cover: string | null
  difficulty: number | null
  distance: number | null
  durationMin: number | null
  total: number
  regions: string[]
  stops: { lat: number; lng: number }[]
  /** 완주 횟수(하루 1번씩) · 마지막 완주일 */
  runCount: number
  lastRunDate: string | null
}

/* 완주 횟수 — route_completion_runs(하루 1번씩 1행). SQL: migrations/visit_counts.sql
   표가 아직 없으면 완주 기록이 있을 때 1번으로 본다. */
export async function getMyRouteRunStats(routeId: string, userId: string): Promise<{ count: number; lastDate: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.from('route_completion_runs')
    .select('run_date, created_at').eq('route_id', routeId).eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) return { count: (await isRouteCompleted(routeId, userId)) ? 1 : 0, lastDate: null }
  const rows = (data ?? []) as any[]
  const last = rows.map(r => r.run_date).filter(Boolean).sort().pop() ?? null
  return { count: rows.length, lastDate: last }
}

export async function getMyRouteRunCounts(userId: string): Promise<Record<string, { count: number; lastDate: string | null }>> {
  const supabase = createClient()
  const { data, error } = await supabase.from('route_completion_runs').select('route_id, run_date').eq('user_id', userId)
  if (error) return {}
  const out: Record<string, { count: number; lastDate: string | null }> = {}
  for (const r of (data ?? []) as any[]) {
    const o = (out[r.route_id] ??= { count: 0, lastDate: null })
    o.count++
    if (r.run_date && (!o.lastDate || r.run_date > o.lastDate)) o.lastDate = r.run_date
  }
  return out
}

// 완주한 루트 — 완주 기록(route_completions) + 예전 방식(방문=전체). "다시 도전"으로 체크를 지워도 목록에 남는다
export async function getCompletedRoutes(userId: string): Promise<CompletedRoute[]> {
  const supabase = createClient()
  const [{ data: prog }, { data: comps }, runs] = await Promise.all([
    supabase.from('route_progress').select('route_id, shop_id').eq('user_id', userId),
    supabase.from('route_completions').select('route_id').eq('user_id', userId),
    getMyRouteRunCounts(userId),
  ])
  const completedIds = new Set(((comps ?? []) as any[]).map(c => c.route_id))
  const routeIds = Array.from(new Set([...completedIds, ...((prog ?? []) as any[]).map((p) => p.route_id)]))
  if (routeIds.length === 0) return []
  const { data: routes } = await supabase
    .from('routes')
    .select('id, title, share_token, cover_image_url, official_difficulty, total_distance_m, total_duration_min, route_shops ( id, sort_order, shops ( region, addr, lat, lng ) )')
    .in('id', routeIds)
  return ((routes ?? []) as any[]).map((r) => {
    const total = r.route_shops?.length ?? 0
    const visited = ((prog ?? []) as any[]).filter((p) => p.route_id === r.id).length
    const regions = Array.from(new Set((r.route_shops ?? []).map((rs: any) => rs.shops?.region || (rs.shops?.addr ? String(rs.shops.addr).trim().split(/\s+/)[0] : null)).filter(Boolean))) as string[]
    const stops = [...(r.route_shops ?? [])].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((rs: any) => ({ lat: rs.shops?.lat, lng: rs.shops?.lng })).filter((s: any) => typeof s.lat === 'number' && typeof s.lng === 'number')
    const done = completedIds.has(r.id) || (total > 0 && visited >= total)
    const run = runs[r.id]
    return { id: r.id, title: r.title, shareToken: r.share_token, cover: r.cover_image_url, difficulty: r.official_difficulty, distance: r.total_distance_m, durationMin: r.total_duration_min ?? null, total, regions, stops, done, runCount: Math.max(run?.count ?? 0, done ? 1 : 0), lastRunDate: run?.lastDate ?? null }
  }).filter((r: any) => r.done).map(({ done, ...r }: any) => r)
}
