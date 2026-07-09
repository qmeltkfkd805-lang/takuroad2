'use client'
import { createClient } from '@/lib/supabase/client'
import { Shop } from '@/types/shop'
import { toShop } from '@/services/shopService'
import { shopRegion, shopDistrict } from '@/lib/utils/region'

/**
 * 샵 홈은 "발견", 지도는 "내 주변".
 * 그래서 필터가 아니라 큐레이션 줄을 만든다.
 */
export interface ShopHomeItem extends Shop {
  /** 취급 굿즈 종류 slug (shop_products에서 모음) */
  goodsSlugs: string[]
  /** 운영자 추천 순서 — null이면 추천 아님 */
  featured_order: number | null
  /** 취급 작품 */
  works: { id: string; name: string; slug: string }[]
  /** 지금 진행 중인 이벤트 */
  hasEvent: boolean
  eventTitle: string | null
  eventEnd: string | null
}

/**
 * 핫한 정도. 찜 > 후기 > 방문 순으로 무게를 준다.
 * 방문수에 상한을 두는 이유: 새로고침·봇으로 부풀기 쉬워서
 * 상한이 없으면 방문수 큰 샵 하나가 이 줄을 영구히 점거한다.
 */
export function hotScore(s: ShopHomeItem): number {
  return (
    s.bookmark_count * 5 +
    s.rating_count * 3 +
    Math.min(s.visit_count, 500) +
    (s.hasEvent ? 40 : 0) +
    (s.is_verified ? 10 : 0)
  )
}

const SHOP_SELECT = `
  id, slug, name, description,
  addr, country, region, city, district,
  lat, lng, google_place_id,
  hours, parking, parking_note, shop_link, sns_links, phone,
  start_date, end_date, event_info,
  rating_avg, rating_count, visit_count, bookmark_count,
  is_verified, is_claimed, status, featured_order,
  added_by, owner_id,
  created_at, updated_at,
  shop_images ( image_url, is_cover, sort_order ),
  shop_categories ( categories ( name, slug, color, icon, bg_color ) )
`

/** 샵 + 취급 작품 + 진행 중 이벤트를 한 번에 */
export async function getShopHomeItems(): Promise<ShopHomeItem[]> {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)

  const [shopRes, tagRes, goodsRes, evRes] = await Promise.all([
    supabase.from('shops').select(SHOP_SELECT).eq('status', 'active'),
    supabase.from('shop_tags').select('shop_id, tags ( id, name, slug )'),
    supabase.from('shop_products').select('shop_id, goods_types ( slug )'),
    supabase
      .from('events')
      .select('shop_id, title, end_date')
      .not('shop_id', 'is', null)
      .lte('start_date', today)
      .or(`end_date.is.null,end_date.gte.${today}`),
  ] as const)

  if (shopRes.error) {
    console.error('[샵 홈] 샵 조회 실패:', shopRes.error.message)
    return []
  }
  if (tagRes.error) console.error('[샵 홈] 취급 작품 조회 실패:', tagRes.error.message)
  if (goodsRes.error) console.error('[샵 홈] 취급 굿즈 조회 실패:', goodsRes.error.message)
  if (evRes.error) console.error('[샵 홈] 이벤트 조회 실패:', evRes.error.message)

  const workMap = new Map<string, { id: string; name: string; slug: string }[]>()
  for (const r of (tagRes.data ?? []) as any[]) {
    const tag = r.tags
    if (!tag) continue
    const list = workMap.get(r.shop_id) ?? []
    list.push({ id: tag.id, name: tag.name, slug: tag.slug })
    workMap.set(r.shop_id, list)
  }

  // 샵 → 취급 굿즈 slug 집합
  const goodsMap = new Map<string, Set<string>>()
  for (const r of (goodsRes.data ?? []) as any[]) {
    const slug = r.goods_types?.slug
    if (!slug) continue
    const set = goodsMap.get(r.shop_id) ?? new Set<string>()
    set.add(slug)
    goodsMap.set(r.shop_id, set)
  }

  const evMap = new Map<string, { title: string; end: string | null }>()
  for (const e of (evRes.data ?? []) as any[]) {
    if (!evMap.has(e.shop_id)) evMap.set(e.shop_id, { title: e.title ?? '이벤트 진행 중', end: e.end_date ?? null })
  }

  return (shopRes.data ?? []).map((raw: any) => {
    const ev = evMap.get(raw.id)
    return {
      ...toShop(raw),
      featured_order: raw.featured_order ?? null,
      works: workMap.get(raw.id) ?? [],
      goodsSlugs: [...(goodsMap.get(raw.id) ?? [])],
      hasEvent: !!ev,
      eventTitle: ev?.title ?? null,
      eventEnd: ev?.end ?? null,
    } as ShopHomeItem
  })
}

/** 내 최애 작품 id */
export async function getMyFavoriteTagIds(userId: string): Promise<string[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('user_favorite_tags')
    .select('tag_id')
    .eq('user_id', userId)
    .eq('tier', 'favorite')

  if (error) { console.error('[샵 홈] 최애 작품 조회 실패:', error.message); return [] }
  return (data ?? []).map((r: any) => r.tag_id)
}

/* ---- 섹션 만들기 (전부 클라이언트에서 계산 — 쿼리는 위 세 개뿐) ---- */

export const hotShops = (items: ShopHomeItem[], n = 10) =>
  [...items].sort((a, b) => hotScore(b) - hotScore(a)).slice(0, n)

export const newShops = (items: ShopHomeItem[], n = 8) =>
  [...items].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, n)

export const eventShops = (items: ShopHomeItem[], n = 8) =>
  items.filter(s => s.hasEvent).sort((a, b) => hotScore(b) - hotScore(a)).slice(0, n)

export const featuredShops = (items: ShopHomeItem[]) =>
  items
    .filter(s => s.featured_order != null)
    .sort((a, b) => (a.featured_order! - b.featured_order!))

/** 지역별 인기 샵 — 구/군 단위로 묶고, 샵이 많은 지역부터 */
export interface RegionGroup {
  key: string        // "서울 마포구"
  region: string     // "서울"
  district: string   // "마포구"
  count: number
  top: ShopHomeItem[]
}

export function regionGroups(items: ShopHomeItem[], groupCount = 5, topN = 3): RegionGroup[] {
  const map = new Map<string, ShopHomeItem[]>()

  for (const s of items) {
    const region = shopRegion({ region: s.region, addr: s.addr })
    const district = shopDistrict({ district: s.district, addr: s.addr })
    if (!region || !district) continue   // 온라인샵 등은 지역 줄에서 제외
    const key = `${region} ${district}`
    const list = map.get(key) ?? []
    list.push(s)
    map.set(key, list)
  }

  return [...map.entries()]
    .map(([key, list]) => ({
      key,
      region: key.split(' ')[0],
      district: key.split(' ').slice(1).join(' '),
      count: list.length,
      top: [...list].sort((a, b) => hotScore(b) - hotScore(a)).slice(0, topN),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, groupCount)
}

/** 내 최애 작품별 취급샵 */
export interface FavoriteWorkGroup {
  work: { id: string; name: string; slug: string }
  count: number
  top: ShopHomeItem[]
}

export function favoriteWorkGroups(items: ShopHomeItem[], favoriteTagIds: string[], topN = 3): FavoriteWorkGroup[] {
  if (favoriteTagIds.length === 0) return []
  const fav = new Set(favoriteTagIds)
  const map = new Map<string, { work: any; list: ShopHomeItem[] }>()

  for (const s of items) {
    for (const w of s.works) {
      if (!fav.has(w.id)) continue
      const cur = map.get(w.id) ?? { work: w, list: [] }
      cur.list.push(s)
      map.set(w.id, cur)
    }
  }

  return [...map.values()]
    .map(({ work, list }) => ({
      work,
      count: list.length,
      top: [...list].sort((a, b) => hotScore(b) - hotScore(a)).slice(0, topN),
    }))
    .sort((a, b) => b.count - a.count)
}


/** 내 취향 필터에 필요한 사용자 데이터 (한 번에) */
export async function getUserShopContext(userId: string): Promise<{
  favoriteTagIds: string[]
  libraryTagIds: string[]
  savedShopIds: string[]
}> {
  const supabase = createClient()
  const [favRes, libRes, savedRes] = await Promise.all([
    supabase.from('user_favorite_tags').select('tag_id').eq('user_id', userId).eq('tier', 'favorite'),
    supabase.from('user_library').select('tag_id').eq('user_id', userId),
    supabase.from('saved_shops').select('shop_id').eq('user_id', userId),
  ])
  if (favRes.error) console.error('[샵 홈] 최애 조회 실패:', favRes.error.message)
  if (libRes.error) console.error('[샵 홈] 라이브러리 조회 실패:', libRes.error.message)
  if (savedRes.error) console.error('[샵 홈] 저장샵 조회 실패:', savedRes.error.message)
  return {
    favoriteTagIds: (favRes.data ?? []).map((r: any) => r.tag_id),
    libraryTagIds: (libRes.data ?? []).map((r: any) => r.tag_id),
    savedShopIds: (savedRes.data ?? []).map((r: any) => r.shop_id),
  }
}
