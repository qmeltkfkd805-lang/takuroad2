// 샵 홈·샵 전체보기·마이페이지에서 쓰는 "전체 샵 목록" — DB에서 직접 읽는 부분.
// 'use client' 가 없어서 서버(/api/shops/home-items)와 브라우저 양쪽에서 쓸 수 있다.
// 화면에서는 보통 shopHomeService.getShopHomeItems() 를 쓴다 (캐시된 API 를 먼저 부르고, 실패하면 이걸 직접 부름).
import { createClient } from '@/lib/supabase/client'
import { toShop } from '@/services/shopService'
import { resolveEventCover } from '@/lib/event/eventCover'
import type { ShopHomeItem } from '@/services/shopHomeService'
import { fetchAllRows } from '@/lib/supabase/fetchAll'

const SHOP_SELECT = `
  id, slug, name, name_en, description,
  addr, country, region, city, district,
  lat, lng, google_place_id,
  hours, parking, parking_note, shop_link, sns_links, phone,
  start_date, end_date, event_info,
  rating_avg, rating_count, visit_count, bookmark_count,
  is_verified, is_claimed, status,
      temporary_holiday_start, temporary_holiday_end, temporary_holiday_message, featured_order,
  added_by, owner_id,
  created_at, updated_at,
  shop_images ( image_url, is_cover, sort_order ),
  cats
`

/** 샵 + 취급 작품 + 진행 중 이벤트를 한 번에 (DB에서 직접) */
export async function loadShopHomeItems(): Promise<ShopHomeItem[]> {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)

  /* 샵·취급 작품·굿즈 연결은 1,000줄을 넘는다 — 한 번에 받으면 뒤쪽이 말없이 잘려서
     (샵이 빠지거나, 취급 작품이 비어 작품 필터에 안 걸리는 샵이 생겼다) 나눠서 끝까지 받는다 */
  const [shopRes, tagRes, goodsRes, goodsCatRes, evRes] = await Promise.all([
    fetchAllRows<any>((from, to) => supabase.from('shops').select(SHOP_SELECT).eq('status', 'active').order('id', { ascending: true }).range(from, to)),
    fetchAllRows<any>((from, to) => supabase.from('shop_tags').select('shop_id, tag_id, tags ( id, name, slug )').order('shop_id', { ascending: true }).order('tag_id', { ascending: true }).range(from, to)),
    fetchAllRows<any>((from, to) => supabase.from('shop_products').select('id, shop_id, goods_types ( slug )').order('id', { ascending: true }).range(from, to)),
    fetchAllRows<any>((from, to) => supabase.from('shop_goods_categories').select('shop_id, goods_type_id, goods_types ( slug )').order('shop_id', { ascending: true }).order('goods_type_id', { ascending: true }).range(from, to)),
    supabase
      .from('events')
      .select('shop_id, title, end_date, cover_url, tag_id')
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

  // 샵 → 취급 굿즈 slug 집합 (개별 상품 + 취급 분야 둘 다에서 모음)
  const goodsMap = new Map<string, Set<string>>()
  const addGoods = (rows: any[]) => {
    for (const r of rows) {
      const slug = r.goods_types?.slug
      if (!slug) continue
      const set = goodsMap.get(r.shop_id) ?? new Set<string>()
      set.add(slug)
      goodsMap.set(r.shop_id, set)
    }
  }
  addGoods((goodsRes.data ?? []) as any[])
  addGoods((goodsCatRes.data ?? []) as any[])

  // 이벤트 포스터가 없으면 작품 커버로 대체 — tags.cover_url을 미리 모은다
  const evTagIds = [...new Set((evRes.data ?? []).map((e: any) => e.tag_id).filter(Boolean))]
  const tagCoverMap = new Map<string, string | null>()
  if (evTagIds.length) {
    const { data: evTags } = await supabase.from('tags').select('id, cover_url').in('id', evTagIds)
    for (const tg of (evTags ?? []) as any[]) tagCoverMap.set(tg.id, tg.cover_url ?? null)
  }

  const evMap = new Map<string, { title: string; end: string | null; cover: string | null }>()
  for (const e of (evRes.data ?? []) as any[]) {
    if (evMap.has(e.shop_id)) continue
    const cover = resolveEventCover({
      eventCoverUrl: e.cover_url ?? null,
      workCoverUrl: e.tag_id ? (tagCoverMap.get(e.tag_id) ?? null) : null,
    })
    evMap.set(e.shop_id, { title: e.title ?? '이벤트 진행 중', end: e.end_date ?? null, cover })
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
      eventCover: ev?.cover ?? null,
    } as ShopHomeItem
  })
}
