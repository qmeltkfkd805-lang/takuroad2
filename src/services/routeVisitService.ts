import { createClient } from '@/lib/supabase/client'

// 이 루트에서 내가 방문 체크한 샵 id 목록
export async function getVisitedShopIds(routeId: string, userId: string): Promise<string[]> {
  const supabase = createClient()
  const { data } = await supabase.from('route_progress').select('shop_id').eq('route_id', routeId).eq('user_id', userId)
  return ((data ?? []) as any[]).map((r) => r.shop_id)
}

export async function setShopVisited(routeId: string, shopId: string, userId: string, visited: boolean): Promise<boolean> {
  const supabase = createClient()
  if (visited) {
    const { data: ex } = await supabase.from('route_progress').select('shop_id').eq('route_id', routeId).eq('shop_id', shopId).eq('user_id', userId).maybeSingle()
    if (ex) return true
    const { error } = await supabase.from('route_progress').insert({ route_id: routeId, shop_id: shopId, user_id: userId } as any)
    return !error
  }
  const { error } = await supabase.from('route_progress').delete().eq('route_id', routeId).eq('shop_id', shopId).eq('user_id', userId)
  return !error
}

// 이 루트를 이미 완주(완주 기록 보유)했는지
export async function isRouteCompleted(routeId: string, userId: string): Promise<boolean> {
  const supabase = createClient()
  const { data } = await supabase.from('route_completions').select('id').eq('route_id', routeId).eq('user_id', userId).maybeSingle()
  return !!data
}

// 완주 기록 남기기 — 이미 있으면 재기록하지 않음(배찌·완주수는 딱 한 번만 반영)
export async function recordRouteCompletion(routeId: string, userId: string): Promise<{ firstTime: boolean }> {
  const supabase = createClient()
  const { data: ex } = await supabase.from('route_completions').select('id').eq('route_id', routeId).eq('user_id', userId).maybeSingle()
  if (ex) return { firstTime: false }
  const { error } = await supabase.from('route_completions').insert({ route_id: routeId, user_id: userId } as any)
  return { firstTime: !error }
}

// 방문 체크 초기화(재도전) — 완주 기록(route_completions)은 그대로 두고 진행(route_progress)만 삭제
export async function resetRouteProgress(routeId: string, userId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('route_progress').delete().eq('route_id', routeId).eq('user_id', userId)
  return !error
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
}

// 방문=전체(완주)인 루트
export async function getCompletedRoutes(userId: string): Promise<CompletedRoute[]> {
  const supabase = createClient()
  const { data: prog } = await supabase.from('route_progress').select('route_id, shop_id').eq('user_id', userId)
  if (!prog || prog.length === 0) return []
  const routeIds = Array.from(new Set((prog as any[]).map((p) => p.route_id)))
  const { data: routes } = await supabase
    .from('routes')
    .select('id, title, share_token, cover_image_url, official_difficulty, total_distance_m, total_duration_min, route_shops ( id, sort_order, shops ( region, addr, lat, lng ) )')
    .in('id', routeIds)
  return ((routes ?? []) as any[]).map((r) => {
    const total = r.route_shops?.length ?? 0
    const visited = (prog as any[]).filter((p) => p.route_id === r.id).length
    const regions = Array.from(new Set((r.route_shops ?? []).map((rs: any) => rs.shops?.region || (rs.shops?.addr ? String(rs.shops.addr).trim().split(/\s+/)[0] : null)).filter(Boolean))) as string[]
    const stops = [...(r.route_shops ?? [])].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((rs: any) => ({ lat: rs.shops?.lat, lng: rs.shops?.lng })).filter((s: any) => typeof s.lat === 'number' && typeof s.lng === 'number')
    return { id: r.id, title: r.title, shareToken: r.share_token, cover: r.cover_image_url, difficulty: r.official_difficulty, distance: r.total_distance_m, durationMin: r.total_duration_min ?? null, total, visited, regions, stops }
  }).filter((r: any) => r.total > 0 && r.visited >= r.total).map(({ visited, ...r }: any) => r)
}
