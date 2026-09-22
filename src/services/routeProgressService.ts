import { createClient } from '@/lib/supabase/client'
import { recordRouteCompletion } from './routeVisitService'
import { geekAreaFromAddr } from '@/lib/utils/geekArea'

/* ============================================================
   루트 진행률 / 완주

   ⭐ 완주 Activity는 activity_logs에 직접 쓰지 않는다.
      반드시 activityService(recordRouteCompleteActivity)를 거친다.
      (옛 logActivity('route_completed', title) 방식 대체)
   ============================================================ */

/**
 * 이 루트의 "대표 덕질지역"을 구한다.
 *
 * 루트는 샵이 여럿이라 지역이 흩어질 수 있다.
 * 가장 많은 샵이 속한 지역을 대표로 삼아, 그날 그 지역 Story에 완주가 합류하게 한다.
 * (루트만 따로 떨어지면 "홍대에서 3곳 돌고 루트 완주" 라는 하나의 이야기가 끊긴다)
 */
async function resolveRouteArea(supabase: any, routeId: string): Promise<string | null> {
  const { data: rows } = await supabase
    .from('route_shops')
    .select('shops ( addr, region )')
    .eq('route_id', routeId)

  const count = new Map<string, number>()
  for (const r of (rows ?? []) as any[]) {
    const shop = r.shops
    if (!shop) continue
    // DB region이 비어 있어도 주소에서 덕질지역을 뽑는다 ("마포구"가 아니라 "홍대")
    const area = shop.region?.trim() || geekAreaFromAddr(shop.addr)
    if (!area) continue
    count.set(area, (count.get(area) ?? 0) + 1)
  }

  if (count.size === 0) return null
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

// 방문 기록 시 호출 — 이 샵이 포함된 루트들의 진행률 갱신
export async function recordRouteProgressOnCheckIn(userId: string, shopId: string): Promise<string[]> {
  const supabase = createClient()

  const { data: routeShops } = await supabase
    .from('route_shops')
    .select('route_id, routes!inner(id, title, is_shared, user_id, share_token)')
    .eq('shop_id', shopId)

  if (!routeShops) return []

  const completedRouteIds: string[] = []

  for (const rs of routeShops as any[]) {
    const route = rs.routes
    if (!route) continue

    const { data: existing } = await supabase
      .from('route_completions')
      .select('id')
      .eq('route_id', route.id)
      .eq('user_id', userId)
      .maybeSingle()
    if (existing) continue

    await supabase
      .from('route_progress')
      .insert({ route_id: route.id, user_id: userId, shop_id: shopId } as any)
      .select()
      .maybeSingle()

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
      // 완주 행·활동 기록·스냅샷은 전부 서버가 만든다.
      // 브라우저는 route_completions 에 쓸 수 없고, 완주 조건도 서버가 다시 대조한다.
      const { firstTime } = await recordRouteCompletion(route.id, userId)
      if (firstTime) completedRouteIds.push(route.id)
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
