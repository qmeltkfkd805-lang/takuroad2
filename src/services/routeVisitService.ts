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

export interface CompletedRoute {
  id: string
  title: string
  shareToken: string | null
  cover: string | null
  difficulty: number | null
  distance: number | null
  total: number
}

// 방문=전체(완주)인 루트
export async function getCompletedRoutes(userId: string): Promise<CompletedRoute[]> {
  const supabase = createClient()
  const { data: prog } = await supabase.from('route_progress').select('route_id, shop_id').eq('user_id', userId)
  if (!prog || prog.length === 0) return []
  const routeIds = Array.from(new Set((prog as any[]).map((p) => p.route_id)))
  const { data: routes } = await supabase
    .from('routes')
    .select('id, title, share_token, cover_image_url, official_difficulty, total_distance_m, route_shops ( id )')
    .in('id', routeIds)
  return ((routes ?? []) as any[]).map((r) => {
    const total = r.route_shops?.length ?? 0
    const visited = (prog as any[]).filter((p) => p.route_id === r.id).length
    return { id: r.id, title: r.title, shareToken: r.share_token, cover: r.cover_image_url, difficulty: r.official_difficulty, distance: r.total_distance_m, total, visited }
  }).filter((r: any) => r.total > 0 && r.visited >= r.total).map(({ visited, ...r }: any) => r)
}
