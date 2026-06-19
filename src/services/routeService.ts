import { createClient } from '@/lib/supabase/client'
import { calcDistance } from '@/hooks/useCurrentLocation'

// 두 좌표 간 도보 시간 추정 (평균 4km/h)
function estimateWalkMinutes(meters: number): number {
  return Math.max(1, Math.round((meters / 1000) * 15))
}

interface RouteShopInput {
  shopId: string
  lat: number
  lng: number
}

// 루트 생성 (샵 순서 + 거리/시간 계산 포함)
export async function createRoute(
  userId: string,
  title: string,
  description: string,
  shops: RouteShopInput[]
): Promise<{ id: string; shareToken: string } | null> {
  const supabase = createClient()

  // 거리/시간 계산
  let totalDistance = 0
  let totalDuration = 0
  const routeShopsData = shops.map((shop, i) => {
    let distFromPrev: number | null = null
    let durFromPrev: number | null = null

    if (i > 0) {
      const prev = shops[i - 1]
      distFromPrev = Math.round(calcDistance(prev.lat, prev.lng, shop.lat, shop.lng))
      durFromPrev = estimateWalkMinutes(distFromPrev)
      totalDistance += distFromPrev
      totalDuration += durFromPrev
    }

    return {
      shop_id: shop.shopId,
      sort_order: i,
      distance_from_prev_m: distFromPrev,
      duration_from_prev_min: durFromPrev,
    }
  })

  // 루트 생성
  const { data: route, error } = await supabase
    .from('routes')
    .insert({
      user_id: userId,
      title,
      description: description || null,
      total_distance_m: totalDistance,
      total_duration_min: totalDuration,
    } as any)
    .select('id, share_token')
    .single()

  if (error || !route) return null

  // 샵 연결
  const { error: shopsError } = await supabase
    .from('route_shops')
    .insert(
      routeShopsData.map(rs => ({ ...rs, route_id: route.id })) as any
    )

  if (shopsError) return null

  return { id: route.id, shareToken: route.share_token }
}

// 내 루트 목록
export async function getMyRoutes(userId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('routes')
    .select(`
      id, title, description, cover_image_url,
      total_distance_m, total_duration_min,
      is_shared, share_token, created_at,
      route_shops ( id, shop_id, sort_order, shops ( name, slug ) )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return []
  return data ?? []
}

// 루트 상세 (공유 토큰으로 조회 — 로그인 불필요)
export async function getRouteByShareToken(token: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('routes')
    .select(`
      id, title, description, cover_image_url,
      total_distance_m, total_duration_min,
      is_shared, user_id, created_at,
      profiles ( nickname ),
      route_shops (
        id, sort_order, distance_from_prev_m, duration_from_prev_min,
        shops ( id, slug, name, addr, lat, lng,
          shop_images ( image_url, is_cover, sort_order ),
          shop_categories ( categories ( name, color, icon ) )
        )
      )
    `)
    .eq('share_token', token)
    .maybeSingle()

  if (error || !data) return null
  return data
}

// 루트 삭제
export async function deleteRoute(routeId: string, userId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('routes')
    .delete()
    .eq('id', routeId)
    .eq('user_id', userId)
  return !error
}

// 루트 공유 설정 토글
export async function toggleRouteShare(routeId: string, userId: string, isShared: boolean): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('routes')
    .update({ is_shared: isShared } as any)
    .eq('id', routeId)
    .eq('user_id', userId)
  return !error
}
