import { createClient } from '@/lib/supabase/client'
import { calcDistance } from '@/hooks/useCurrentLocation'

// ??醫뚰몴 媛??꾨낫 ?쒓컙 異붿젙 (?됯퇏 4km/h)
function estimateWalkMinutes(meters: number): number {
  return Math.max(1, Math.round((meters / 1000) * 15))
}

interface RouteShopInput {
  shopId: string
  lat: number
  lng: number
}

// 猷⑦듃 ?앹꽦 (???쒖꽌 + 嫄곕━/?쒓컙 怨꾩궛 ?ы븿)
export async function createRoute(
  userId: string,
  title: string,
  description: string,
  shops: RouteShopInput[],
  difficulty: number = 1
): Promise<{ id: string; shareToken: string } | null> {
  const supabase = createClient()

  // 嫄곕━/?쒓컙 怨꾩궛
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

  // 猷⑦듃 ?앹꽦
  const { data: route, error } = await supabase
    .from('routes')
    .insert({
      user_id: userId,
      title,
      description: description || null,
      official_difficulty: difficulty,
      total_distance_m: totalDistance,
      total_duration_min: totalDuration,
    } as any)
    .select('id, share_token')
    .single()

  if (error || !route) return null

  // ???곌껐
  const { error: shopsError } = await supabase
    .from('route_shops')
    .insert(
      routeShopsData.map(rs => ({ ...rs, route_id: route.id })) as any
    )

  if (shopsError) return null

  return { id: route.id, shareToken: route.share_token }
}

// ??猷⑦듃 紐⑸줉
export async function getMyRoutes(userId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('routes')
    .select(`
      id, title, description, cover_image_url,
      total_distance_m, total_duration_min,
      is_shared, is_official, share_token, created_at,
      route_shops ( id, shop_id, sort_order, shops ( name, slug ) )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return []
  return data ?? []
}

// 猷⑦듃 ?곸꽭 (怨듭쑀 ?좏겙?쇰줈 議고쉶 ??濡쒓렇??遺덊븘??
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

// 猷⑦듃 ??젣
export async function deleteRoute(routeId: string, userId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('routes')
    .delete()
    .eq('id', routeId)
    .eq('user_id', userId)
  return !error
}

// 猷⑦듃 怨듭쑀 ?ㅼ젙 ?좉?
export async function toggleRouteShare(routeId: string, userId: string, isShared: boolean): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('routes')
    .update({ is_shared: isShared } as any)
    .eq('id', routeId)
    .eq('user_id', userId)
  return !error
}

// 怨듦컻??猷⑦듃 ?꾩껜 紐⑸줉 (醫뗭븘?붿닚, 吏???쒓렇 ?꾪꽣 媛??
export async function getPublicRoutes(filters?: { region?: string; tag?: string; search?: string }) {
  const supabase = createClient()

  let query = supabase
    .from('routes')
    .select(`
      id, title, description, likes, is_official, official_difficulty, created_at, share_token,
      total_distance_m, total_duration_min, primary_tag_id, cover_image_url, themes,
      primary_tag:tags!primary_tag_id ( name ),
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

// ?꾪꽣?????꾩껜 吏??紐⑸줉
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

// ?꾪꽣?????꾩껜 ?묓뭹(?쒓렇) 紐⑸줉
export async function getAllSeriesTags() {
  const supabase = createClient()
  const { data } = await supabase
    .from('tags')
    .select('name')
    .order('name')
  return (data ?? []).map((d: any) => d.name)
}

// ?묓뭹 ?좏깮????id源뚯? ?④퍡. (getAllSeriesTags???대쫫留?以섏꽌 ?쒕낫??遺議?
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

export async function getMyRouteProgress(userId: string) {
  const supabase = createClient()
  const { data: prog } = await supabase.from('route_progress').select('route_id, shop_id').eq('user_id', userId)
  if (!prog || prog.length === 0) return []
  const routeIds = Array.from(new Set(prog.map((p: any) => p.route_id)))
  const { data: routes } = await supabase.from('routes').select('id, title, share_token, route_shops(id)').in('id', routeIds)
  return (routes ?? []).map((r: any) => {
    const total = r.route_shops?.length ?? 0
    const visited = prog.filter((p: any) => p.route_id === r.id).length
    return { id: r.id, title: r.title, shareToken: r.share_token, total, visited, pct: total ? Math.round((visited / total) * 100) : 0 }
  }).filter((r: any) => r.visited > 0 && r.visited < r.total)
}

export async function uploadRouteCover(file: File, userId: string, routeKey: string): Promise<string | null> {
  const supabase = createClient()
  const ext = file.name.split('.').pop()
  const path = `routes/${userId}/${routeKey}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('shop-images').upload(path, file)
  if (error) { console.error('[route cover upload]', error); return null }
  const { data } = supabase.storage.from('shop-images').getPublicUrl(path)
  return data.publicUrl
}

export async function updateRouteMeta(routeId: string, meta: { cover_image_url?: string | null; season?: string | null; themes?: string[]; target_audience?: string | null; primary_tag_id?: string | null }): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('routes').update(meta as any).eq('id', routeId)
  if (error) { console.error('[route meta]', error); return false }
  return true
}

export async function getRouteMeta(routeId: string) {
  const supabase = createClient()
  const { data } = await supabase.from('routes').select('cover_image_url, season, themes, target_audience, primary_tag_id').eq('id', routeId).maybeSingle()
  return {
    cover: (data as any)?.cover_image_url ?? null,
    season: (data as any)?.season ?? null,
    themes: ((data as any)?.themes ?? []) as string[],
    target: (data as any)?.target_audience ?? null,
  }
}




// 루트 저장 토글 (저장돼있으면 해제, 아니면 저장) → 저장상태 반환
export async function toggleRouteSave(routeId: string, userId: string): Promise<boolean> {
  const supabase = createClient()
  const { data: existing } = await supabase
    .from('route_saves')
    .select('id')
    .eq('route_id', routeId)
    .eq('user_id', userId)
    .maybeSingle()
  if (existing) {
    await supabase.from('route_saves').delete().eq('id', (existing as any).id)
    return false
  } else {
    await supabase.from('route_saves').insert({ route_id: routeId, user_id: userId } as any)
    return true
  }
}

// 내가 저장한 루트 id 목록 (저장 여부 체크용)
export async function getMySavedRouteIds(userId: string): Promise<string[]> {
  const supabase = createClient()
  const { data } = await supabase.from('route_saves').select('route_id').eq('user_id', userId)
  return (data ?? []).map((r: any) => r.route_id)
}

// 마이페이지 - 저장한 루트 전체
export async function getSavedRoutes(userId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('route_saves')
    .select(`
      route_id, created_at,
      routes (
        id, title, description, cover_image_url, likes,
        total_distance_m, total_duration_min, official_difficulty,
        is_shared, share_token,
        route_shops ( id )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data ?? []).map((r: any) => r.routes).filter(Boolean)
}
