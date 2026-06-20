import { createClient } from '@/lib/supabase/client'
import { logActivity } from './checkInService'

// 체크인 시 호출 — 이 샵이 포함된 루트들의 진행률 갱신
export async function recordRouteProgressOnCheckIn(userId: string, shopId: string): Promise<string[]> {
  const supabase = createClient()

  // 이 샵이 포함된 루트 찾기 (공유된 루트만, 본인이 만든 루트 포함)
  const { data: routeShops } = await supabase
    .from('route_shops')
    .select('route_id, routes!inner(id, title, is_shared, user_id)')
    .eq('shop_id', shopId)

  if (!routeShops) return []

  const completedRouteIds: string[] = []

  for (const rs of routeShops as any[]) {
    const route = rs.routes
    if (!route) continue

    // 이미 완료한 루트면 스킵
    const { data: existing } = await supabase
      .from('route_completions')
      .select('id')
      .eq('route_id', route.id)
      .eq('user_id', userId)
      .maybeSingle()
    if (existing) continue

    // 진행 기록 추가 (이미 있으면 무시)
    await supabase
      .from('route_progress')
      .insert({ route_id: route.id, user_id: userId, shop_id: shopId } as any)
      .select()
      .maybeSingle()

    // 전체 진행률 확인
    const { data: totalShops } = await supabase
      .from('route_shops')
      .select('shop_id')
      .eq('route_id', route.id)

    const { data: progress } = await supabase
      .from('route_progress')
      .select('shop_id')
      .eq('route_id', route.id)
      .eq('user_id', userId)

    const total = totalShops?.length ?? 0
    const visited = progress?.length ?? 0

    if (total > 0 && visited >= total) {
      const { error } = await supabase
        .from('route_completions')
        .insert({ route_id: route.id, user_id: userId } as any)

      if (!error) {
        completedRouteIds.push(route.id)
        await logActivity(userId, 'route_completed', `${route.title} 완주`, `/route/${route.id}`)
      }
    }
  }

  return completedRouteIds
}

// 특정 루트의 내 진행률
export async function getRouteProgress(routeId: string, userId: string) {
  const supabase = createClient()

  const { data: totalShops } = await supabase
    .from('route_shops')
    .select('shop_id')
    .eq('route_id', routeId)

  const { data: progress } = await supabase
    .from('route_progress')
    .select('shop_id')
    .eq('route_id', routeId)
    .eq('user_id', userId)

  const total = totalShops?.length ?? 0
  const visited = progress?.length ?? 0

  return {
    visited,
    total,
    percent: total > 0 ? Math.round((visited / total) * 100) : 0,
  }
}