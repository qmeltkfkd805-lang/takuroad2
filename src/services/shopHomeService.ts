'use client'
import { createClient } from '@/lib/supabase/client'
import { Shop } from '@/types/shop'
import { shopRegion, shopDistrict } from '@/lib/utils/region'
import { imagesFirst } from '@/lib/utils/shopOrder'
import { loadShopHomeItems } from '@/services/shopHomeLoad'

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
  /** 진행 중 이벤트의 포스터 (없으면 작품 커버). 카드 이미지로 쓴다 */
  eventCover: string | null
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

/** 샵 + 취급 작품 + 진행 중 이벤트를 한 번에.
 *  ⚡ 예전엔 화면을 열 때마다 브라우저가 DB에서 전체 샵을 직접 읽었다(하루 천 번 넘게).
 *     이제 서버가 60초마다 한 번 만든 목록(/api/shops/home-items, CDN 캐시)을 받는다. 실패하면 예전처럼 직접 읽는다. */
export async function getShopHomeItems(): Promise<ShopHomeItem[]> {
  try {
    const res = await fetch('/api/shops/home-items')
    if (res.ok) {
      const j = await res.json()
      if (Array.isArray(j?.items)) return j.items as ShopHomeItem[]
    }
  } catch { /* 아래에서 직접 읽기 */ }
  return loadShopHomeItems()
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
  imagesFirst([...items].sort((a, b) => hotScore(b) - hotScore(a))).slice(0, n)   // 사진 있는 샵 먼저

/** "새로 등록된 샵" — 등록한 지 2주(14일) 이내인 샵만, 최신순. 2주가 지나면 자동으로 빠진다.
    해당하는 샵이 없으면 빈 배열 → 샵 홈에서 섹션 자체가 숨겨진다. */
export const NEW_SHOP_DAYS = 14
export const newShops = (items: ShopHomeItem[], n = 8, now: Date = new Date()) => {
  const cutoff = now.getTime() - NEW_SHOP_DAYS * 24 * 60 * 60 * 1000
  return imagesFirst(items
    .filter(s => { const t = Date.parse(s.created_at); return Number.isFinite(t) && t >= cutoff })
    .sort((a, b) => b.created_at.localeCompare(a.created_at)))
    .slice(0, n)
}

export const eventShops = (items: ShopHomeItem[], n = 8) =>
  imagesFirst(items.filter(s => s.hasEvent).sort((a, b) => hotScore(b) - hotScore(a))).slice(0, n)

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
    const region = shopRegion(s)
    const district = shopDistrict(s)
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
      top: imagesFirst([...list].sort((a, b) => hotScore(b) - hotScore(a))).slice(0, topN),
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
      top: imagesFirst([...list].sort((a, b) => hotScore(b) - hotScore(a))).slice(0, topN),
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
