import { createClient } from '@/lib/supabase/client'
import { prepareImage } from '@/lib/storage/compressImage'
import { recordActivity } from '@/services/activityService'
import { calcDistance } from '@/hooks/useCurrentLocation'
import { withStopKeys } from '@/lib/route/stopKey'
import { fetchAllRows } from '@/lib/supabase/fetchAll'

// ??醫뚰몴 媛??꾨낫 ?쒓컙 異붿젙 (?됯퇏 4km/h)
function estimateWalkMinutes(meters: number): number {
  return Math.max(1, Math.round((meters / 1000) * 15))
}

interface RouteShopInput {
  shopId: string
  lat: number
  lng: number
  moveTip?: string | null   // 이 스팟 → 다음 스팟 이동 팁
  /** 같은 샵이 여러 층에 있어 층마다 따로 담았을 때 이 방문지의 층 (없으면 빈 값) */
  stopFloor?: string | null
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
      move_tip: i < shops.length - 1 ? (shop.moveTip?.trim() || null) : null,
      stop_floor: shop.stopFloor?.trim() || '',   // 여러 행을 한 번에 넣을 땐 모든 행의 칸이 같아야 한다
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

  // 성장 Activity — 내가 만든 덕질 코스. 스냅샷·EXP 는 서버가 정한다
  await recordActivity('route_created', route.id, userId)

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
      route_shops ( id, shop_id, sort_order, shops ( name, slug, region, addr, lat, lng ) )
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
        *,
        shops ( id, slug, name, addr, lat, lng, place_id, floor, unit, floor_info, hours, status,
          places ( name, access_note ),
          shop_images ( image_url, is_cover, sort_order ),
          cats
        )
      )
    `)
    .eq('share_token', token)
    .maybeSingle()

  if (error) {
    console.error('getRouteByShareToken error:', JSON.stringify(error))
    return null
  }
  return data ? withStopKeys(data as any) : data   // 층마다 나뉜 방문지는 shops.id = "샵id@층"
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

// 관리자: 남의 루트도 삭제/공개설정 (서버 API가 admin 확인 후 Service Role로 처리)
export async function adminDeleteRoute(routeId: string): Promise<boolean> {
  const res = await fetch('/api/admin/route-action', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ routeId, action: 'delete' }),
  })
  return res.ok
}
// 관리자: 작성자 넘기기 (출처 주인이 가입했을 때)
export async function adminFindUsers(query: string): Promise<{ id: string; nickname: string | null; avatar_url?: string | null }[]> {
  try {
    const res = await fetch('/api/admin/route-action', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'findUser', query }),
    })
    if (!res.ok) return []
    return (await res.json()).users ?? []
  } catch { return [] }
}
export async function adminTransferRoute(routeId: string, targetUserId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/route-action', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routeId, action: 'transferOwner', targetUserId }),
    })
    const j = await res.json().catch(() => ({}))
    return res.ok ? { ok: true } : { ok: false, error: j.error }
  } catch { return { ok: false, error: '네트워크 오류' } }
}
export async function adminSetRouteShared(routeId: string, shared: boolean): Promise<boolean> {
  const res = await fetch('/api/admin/route-action', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ routeId, action: 'setShared', shared }),
  })
  return res.ok
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
/** 공유된 루트 전부 — DB에서 직접 (서버 /api/routes/public 과, 그게 안 될 때 브라우저가 쓴다) */
export async function loadPublicRoutes(): Promise<any[]> {
  const supabase = createClient()

  const query = supabase
    .from('routes')
    .select(`
      id, title, description, tips, likes, is_official, official_difficulty, created_at, share_token,
      total_distance_m, total_duration_min, primary_tag_id, cover_image_url, themes,
      primary_tag:tags!primary_tag_id ( name ),
      route_tips(count),
      profiles!routes_user_id_fkey ( nickname ),
      route_shops (
        id, sort_order,
        shops ( id, name, region, addr, lat, lng, place_id, places ( name ), shop_tags ( tags ( name ) ) )
      )
    `)
    .eq('is_shared', true)
    .order('likes', { ascending: false })

  const { data, error } = await query
  if (error) {
    console.error('getPublicRoutes error:', JSON.stringify(error))
    return []
  }
  return data ?? []
}

/* ⚡ 공개 루트 목록 — 브라우저에선 서버(/api/routes/public)가 60초마다 만들어 두는 목록을 받는다.
   (예전엔 루트 화면을 열 때마다 사람마다 공개 루트 전부를 DB에서 새로 읽었다 — DB 사용 시간 2위)
   받아 오지 못하면 예전처럼 DB에서 직접. 서버(홈·작품 화면)에선 DB 직접. 거르기는 여기서 한다. */
async function fetchPublicRoutes(): Promise<any[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/routes/public')
      if (res.ok) {
        const j = await res.json()
        if (Array.isArray(j?.items)) return j.items
      }
    } catch { /* 아래에서 직접 읽기 */ }
  }
  return loadPublicRoutes()
}

export async function getPublicRoutes(filters?: { region?: string; tag?: string; search?: string }) {
  let routes = await fetchPublicRoutes()

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
  // 샵이 1,000곳을 넘어 한 번에 받으면 뒤쪽 지역이 빠질 수 있다 → 나눠서 끝까지
  const { data } = await fetchAllRows<any>((from, to) => supabase
    .from('shops')
    .select('id, region')
    .eq('status', 'active')
    .not('region', 'is', null)
    .order('id', { ascending: true })
    .range(from, to))

  const regions = new Set((data ?? []).map((d: any) => d.region))
  return Array.from(regions).sort()
}

// ?꾪꽣?????꾩껜 ?묓뭹(?쒓렇) 紐⑸줉
export async function getAllSeriesTags() {
  const supabase = createClient()
  // 작품이 2,500개를 넘는다 → 나눠서 끝까지 (예전엔 가나다순 앞 1,000개만 왔다)
  const { data } = await fetchAllRows<any>((from, to) => supabase
    .from('tags')
    .select('id, name')
    .order('name')
    .order('id', { ascending: true })
    .range(from, to))
  return (data ?? []).map((d: any) => d.name)
}

// ?묓뭹 ?좏깮????id源뚯? ?④퍡. (getAllSeriesTags???대쫫留?以섏꽌 ?쒕낫??遺議?
export async function getAllTagsForSelect(): Promise<{ id: string; name: string; slug: string }[]> {
  const supabase = createClient()
  const rows: { id: string; name: string; slug: string }[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('tags')
      .select('id, name, slug')
      .order('name')
      .range(from, from + pageSize - 1)
    if (error) throw error
    rows.push(...((data ?? []) as { id: string; name: string; slug: string }[]))
    if ((data?.length ?? 0) < pageSize) break
  }
  return rows
}
export async function getRouteForEdit(routeId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('routes')
    .select(`id, title, description, official_difficulty,
      route_shops ( *, shops ( id, name, lat, lng, addr, region, place_id, floor, unit, floor_info, places ( name ) ) )`)
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
    return { route_id: routeId, shop_id: shop.shopId, sort_order: i, distance_from_prev_m: d, duration_from_prev_min: dur, move_tip: i < shops.length - 1 ? (shop.moveTip?.trim() || null) : null, stop_floor: shop.stopFloor?.trim() || '' }
  })
  const { error: upErr } = await supabase.from('routes').update({
    title, description: description || null, official_difficulty: difficulty,
    total_distance_m: totalDistance, total_duration_min: totalDuration,
  } as any).eq('id', routeId)
  if (upErr) { console.error('[route update]', upErr); return false }
  // 새 순서로 갈아끼우기 — 넣기에 실패하면 지우기 전 순서로 되돌린다(루트가 빈 채로 남지 않게)
  const { data: before } = await supabase.from('route_shops').select('*').eq('route_id', routeId)
  await supabase.from('route_shops').delete().eq('route_id', routeId)
  const { error: insErr } = await supabase.from('route_shops').insert(rows as any)
  if (insErr) {
    console.error('[route shops update]', insErr.code, insErr.message, insErr.details)
    if (before?.length) {
      const { error: backErr } = await supabase.from('route_shops').insert((before as any[]).map(({ id, created_at, ...r }) => r) as any)
      if (backErr) console.error('[route shops restore]', backErr.code, backErr.message)
    }
    return false
  }
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
  const { data: routes } = await supabase.from('routes').select('id, title, share_token, cover_image_url, route_shops(id)').in('id', routeIds)
  return (routes ?? []).map((r: any) => {
    const total = r.route_shops?.length ?? 0
    const visited = prog.filter((p: any) => p.route_id === r.id).length
    return { id: r.id, title: r.title, shareToken: r.share_token, cover: r.cover_image_url ?? null, total, visited, pct: total ? Math.round((visited / total) * 100) : 0 }
  }).filter((r: any) => r.visited > 0 && r.visited < r.total)
}

export async function uploadRouteCover(file: File, userId: string, routeKey: string): Promise<string | null> {
  const supabase = createClient()
  const prep = await prepareImage(file)
  /* 새 루트는 아직 id 가 없어서 호출부가 'new' 를 넘긴다 (admin/RouteBuilder.tsx:116).
     경로에 'new' 가 박히면 서로 다른 루트의 커버가 한 폴더에 섞여 어느 루트 것인지
     알 수 없다. 초안은 drafts/ 로 모으고, 파일명에 난수를 붙여 같은 밀리초에
     두 장이 올라가도 경로가 겹치지 않게 한다. */
  const key = routeKey && routeKey !== 'new' ? routeKey : 'drafts'
  const path = `routes/${userId}/${key}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${prep.ext}`
  const { error } = await supabase.storage.from('shop-images').upload(path, prep.data, { cacheControl: '31536000', contentType: prep.contentType })
  if (error) { console.error('[route cover upload]', error); return null }
  const { data } = supabase.storage.from('shop-images').getPublicUrl(path)
  return data.publicUrl
}

export async function updateRouteMeta(routeId: string, meta: { cover_image_url?: string | null; season?: string | null; themes?: string[]; target_audience?: string | null; primary_tag_id?: string | null; tips?: string | null }): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('routes').update(meta as any).eq('id', routeId)
  if (error) { console.error('[route meta]', error); return false }
  return true
}

export async function getRouteMeta(routeId: string) {
  const supabase = createClient()
  const { data } = await supabase.from('routes').select('cover_image_url, season, themes, target_audience, primary_tag_id, tips').eq('id', routeId).maybeSingle()
  return {
    cover: (data as any)?.cover_image_url ?? null,
    season: (data as any)?.season ?? null,
    themes: ((data as any)?.themes ?? []) as string[],
    target: (data as any)?.target_audience ?? null,
    tips: (data as any)?.tips ?? null,
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
    await supabase.rpc('increment_route_likes', { rid: routeId, delta: -1 })
    return false
  } else {
    await supabase.from('route_saves').insert({ route_id: routeId, user_id: userId } as any)
    await supabase.rpc('increment_route_likes', { rid: routeId, delta: 1 })
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
        route_shops ( id, sort_order, shops ( region, addr, lat, lng ) )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data ?? []).map((r: any) => r.routes).filter(Boolean)
}

/* ── 층 지도 이미지 (routes.floor_maps) ── SQL: migrations/route_floor_maps.sql
   루트 순서의 층별 묶음(같은 건물·같은 층, 키 = floorGroupKey)마다 참고용 지도 이미지 1장.
   SQL 적용 전이면 조회는 빈 목록, 저장은 false 를 돌려준다(루트 저장 자체는 막지 않음). */
/** sourceName: 출처 표시(예: @계정, OO 블로그) · sourceUrl: 출처 링크(인스타·블로그 등 https 주소) */
export interface FloorMap { key: string; label: string; url: string; sourceName?: string | null; sourceUrl?: string | null }

export async function getRouteFloorMaps(routeId: string): Promise<FloorMap[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from('routes').select('floor_maps').eq('id', routeId).maybeSingle()
  if (error || !data) return []
  const list = (data as any).floor_maps
  if (!Array.isArray(list)) return []
  // 출처 링크는 http(s) 만 통과 (javascript: 같은 링크 차단)
  return list.filter((m: any) => m && typeof m.key === 'string' && typeof m.url === 'string')
    .map((m: any) => ({ ...m, sourceUrl: typeof m.sourceUrl === 'string' && /^https?:\/\//i.test(m.sourceUrl) ? m.sourceUrl : null, sourceName: typeof m.sourceName === 'string' ? m.sourceName : null }))
}

export async function saveRouteFloorMaps(routeId: string, maps: FloorMap[]): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('routes').update({ floor_maps: maps } as any).eq('id', routeId)
  if (error) console.error('[floor maps save]', error.message)
  return !error
}

/** 층 지도 이미지 올리기 — 공개 버킷 route-photos/{userId}/floormaps/… (브라우저에서 줄여 다시 그림 → 위치정보 제거) */
export async function uploadFloorMap(userId: string, file: File): Promise<string | null> {
  const supabase = createClient()
  const { shrink } = await import('./eventVisitPhotoService')
  const { blob, ext, type } = await shrink(file)
  const id = (() => { try { return crypto.randomUUID() } catch { return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}` } })()
  const path = `${userId}/floormaps/${id}.${ext}`
  const { error } = await supabase.storage.from('route-photos').upload(path, blob, { cacheControl: '31536000', contentType: type, upsert: false })
  if (error) { console.error('[floor map upload]', error.message); return null }
  return supabase.storage.from('route-photos').getPublicUrl(path).data.publicUrl
}

/* ── 루트 출처 (routes.source_credits) ── SQL: migrations/route_sources.sql
   다른 분의 인스타·블로그 코스를 참고해 만든 루트면 출처를 남겨 루트 소개에 보여준다. */
export interface RouteSource { name: string; url: string | null }

const cleanSources = (list: any): RouteSource[] => (Array.isArray(list) ? list : [])
  .map((m: any) => ({
    name: typeof m?.name === 'string' ? m.name.trim().slice(0, 40) : '',
    url: typeof m?.url === 'string' && /^https?:\/\//i.test(m.url.trim()) ? m.url.trim().slice(0, 300) : null,   // http(s) 만
  }))
  .filter(m => m.name || m.url)

export async function getRouteSources(routeId: string): Promise<RouteSource[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from('routes').select('source_credits').eq('id', routeId).maybeSingle()
  if (error || !data) return []
  return cleanSources((data as any).source_credits)
}

export async function saveRouteSources(routeId: string, list: RouteSource[]): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('routes').update({ source_credits: cleanSources(list) } as any).eq('id', routeId)
  if (error) console.error('[route sources save]', error.message)
  return !error
}
