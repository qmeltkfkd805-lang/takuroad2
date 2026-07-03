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
      profiles!routes_user_id_fkey ( nickname ),
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

  if (error) {
    console.error('getRouteByShareToken error:', JSON.stringify(error))
    return null
  }
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

// 공개된 루트 전체 목록 (좋아요순, 지역/태그 필터 가능)
export async function getPublicRoutes(filters?: { region?: string; tag?: string; search?: string }) {
  const supabase = createClient()

  let query = supabase
    .from('routes')
    .select(`
      id, title, description, likes, is_official, official_difficulty, created_at, share_token,
      total_distance_m, total_duration_min,
      profiles!routes_user_id_fkey ( nickname ),
      route_shops (
        id, sort_order,
        shops ( id, name, region, shop_tags ( tags ( name ) ) )
      )
    `)
    .eq('is_shared', true)
    .order('likes', { ascending: false })

  const { data, error } = await query
  if (error) {
    console.error('getPublicRoutes error:', JSON.stringify(error))
    return []
  }

  let routes = data ?? []

  if (filters?.region) {
    routes = routes.filter((r: any) =>
      r.route_shops?.some((rs: any) => rs.shops?.region === filters.region)
    )
  }

  if (filters?.tag) {
    routes = routes.filter((r: any) =>
      r.route_shops?.some((rs: any) =>
        rs.shops?.shop_tags?.some((st: any) => st.tags?.name === filters.tag)
      )
    )
  }

  if (filters?.search) {
    const keyword = filters.search.toLowerCase()
    routes = routes.filter((r: any) => {
      const titleMatch = r.title?.toLowerCase().includes(keyword)
      const descMatch = r.description?.toLowerCase().includes(keyword)
      const authorMatch = r.profiles?.nickname?.toLowerCase().includes(keyword)
      const tagMatch = r.route_shops?.some((rs: any) =>
        rs.shops?.shop_tags?.some((st: any) => st.tags?.name?.toLowerCase().includes(keyword))
      )
      const shopNameMatch = r.route_shops?.some((rs: any) =>
        rs.shops?.name?.toLowerCase().includes(keyword)
      )
      return titleMatch || descMatch || authorMatch || tagMatch || shopNameMatch
    })
  }

  return routes
}

// 필터용 — 전체 지역 목록
export async function getAllRegions() {
  const supabase = createClient()
  const { data } = await supabase
    .from('shops')
    .select('region')
    .eq('status', 'active')
    .not('region', 'is', null)

  const regions = new Set((data ?? []).map((d: any) => d.region))
  return Array.from(regions).sort()
}

// 필터용 — 전체 작품(태그) 목록
export async function getAllSeriesTags() {
  const supabase = createClient()
  const { data } = await supabase
    .from('tags')
    .select('name')
    .order('name')
  return (data ?? []).map((d: any) => d.name)
}

// 작품 선택용 — id까지 함께. (getAllSeriesTags는 이름만 줘서 제보엔 부족)
export async function getAllTagsForSelect(): Promise<{ id: string; name: string; slug: string }[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('tags')
    .select('id, name, slug')
    .order('name')
  return (data ?? []) as any
}
export async function getRouteForEdit(routeId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('routes')
    .select(`id, title, description, official_difficulty,
      route_shops ( sort_order, shops ( id, name, lat, lng, addr, region ) )`)
    .eq('id', routeId)
    .maybeSingle()
  if (error || !data) { console.error('[route edit load]', error); return null }
  return data as any
}

export async function updateRoute(routeId: string, title: string, description: string, difficulty: number, shops: RouteShopInput[]): Promise<boolean> {
  const supabase = createClient()
  let totalDistance = 0, totalDuration = 0
  const rows = shops.map((shop, i) => {
    let d: number | null = null, dur: number | null = null
    if (i > 0) {
      const prev = shops[i - 1]
      d = Math.round(calcDistance(prev.lat, prev.lng, shop.lat, shop.lng))
      dur = estimateWalkMinutes(d)
      totalDistance += d; totalDuration += dur
    }
    return { route_id: routeId, shop_id: shop.shopId, sort_order: i, distance_from_prev_m: d, duration_from_prev_min: dur }
  })
  const { error: upErr } = await supabase.from('routes').update({
    title, description: description || null, official_difficulty: difficulty,
    total_distance_m: totalDistance, total_duration_min: totalDuration,
  } as any).eq('id', routeId)
  if (upErr) { console.error('[route update]', upErr); return false }
  await supabase.from('route_shops').delete().eq('route_id', routeId)
  const { error: insErr } = await supabase.from('route_shops').insert(rows as any)
  if (insErr) { console.error('[route shops update]', insErr); return false }
  return true
}

export async function getRouteStats(routeId: string) {
  const supabase = createClient()
  const { data } = await supabase.from('routes').select('likes, share_token, cover_image_url').eq('id', routeId).maybeSingle()
  const { count } = await supabase.from('route_completions').select('id', { count: 'exact', head: true }).eq('route_id', routeId)
  return {
    likes: (data as any)?.likes ?? 0,
    shareToken: (data as any)?.share_token ?? null,
    cover: (data as any)?.cover_image_url ?? null,
    completions: count ?? 0,
  }
}
