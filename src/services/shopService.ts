import { createClient } from '@/lib/supabase/client'
import { Shop } from '@/types/shop'

// ============================================================
// shopService
// 모든 샵 관련 Supabase 쿼리는 여기서만 관리
// Hook은 이 함수만 호출 — supabase 직접 접근 안 함
// select("*") 사용 금지 — 필요한 컬럼만 명시
// ============================================================

// DB 응답 → UI Shop 타입으로 변환
export function toShop(raw: any): Shop {
  const cats = (raw.shop_categories ?? [])
    .map((sc: any) => sc.categories?.name)
    .filter(Boolean) as string[]

  const images = (raw.shop_images ?? [])
    .sort((a: any, b: any) => {
      // is_cover=true 우선, 그 다음 sort_order
      if (a.is_cover && !b.is_cover) return -1
      if (!a.is_cover && b.is_cover) return 1
      return a.sort_order - b.sort_order
    })
    .map((img: any) => img.image_url) as string[]

  return {
    id:             raw.id,
    slug:           raw.slug,
    name:           raw.name,
    description:    raw.description,
    addr:           raw.addr,
    country:        raw.country ?? 'KR',
    region:         raw.region,
    city:           raw.city,
    district:       raw.district,
    lat:            raw.lat,
    lng:            raw.lng,
    google_place_id: raw.google_place_id,
    cat:            cats[0] ?? '기타',
    cats:           cats,
    images,
    hours:          raw.hours,
    parking:        raw.parking,
    parking_note:   raw.parking_note,
    shop_link:      raw.shop_link,
    start_date:     raw.start_date,
    end_date:       raw.end_date,
    event_info:     raw.event_info,
    rating_avg:     raw.rating_avg ?? 0,
    rating_count:   raw.rating_count ?? 0,
    visit_count:    raw.visit_count ?? 0,
    bookmark_count: raw.bookmark_count ?? 0,
    is_verified:    raw.is_verified ?? false,
    is_claimed:     raw.is_claimed ?? false,
    status:         raw.status,
    added_by:       raw.added_by,
    owner_id:       raw.owner_id,
    created_at:     raw.created_at,
    updated_at:     raw.updated_at,
  }
}

// 지도용 샵 전체 목록
export async function getShops(): Promise<Shop[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('shops')
    .select(`
      id, slug, name, description,
      addr, country, region, city, district,
      lat, lng, google_place_id,
      hours, parking, parking_note, shop_link,
      start_date, end_date, event_info,
      rating_avg, rating_count, visit_count, bookmark_count,
      is_verified, is_claimed, status,
      added_by, owner_id,
      created_at, updated_at,
      shop_images ( image_url, is_cover, sort_order ),
      shop_categories ( categories ( name, slug, color, icon, bg_color ) )
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getShops error:', error)
    return []
  }

  return (data ?? []).map(toShop)
}

// 슬러그로 단일 샵 조회 (상세 페이지용)
export async function getShopBySlug(slug: string): Promise<Shop | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('shops')
    .select(`
      id, slug, name, description,
      addr, country, region, city, district,
      lat, lng, google_place_id,
      hours, parking, parking_note, shop_link,
      start_date, end_date, event_info,
      rating_avg, rating_count, visit_count, bookmark_count,
      is_verified, is_claimed, status,
      added_by, owner_id,
      created_at, updated_at,
      shop_images ( image_url, is_cover, sort_order ),
      shop_categories ( categories ( name, slug, color, icon, bg_color ) )
    `)
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle()

  if (error || !data) return null
  return toShop(data)
}

// 검색
export async function searchShops(query: string): Promise<Shop[]> {
  if (!query.trim()) return []

  const supabase = createClient()

  const { data, error } = await supabase
    .from('shops')
    .select(`
      id, slug, name, addr, lat, lng,
      rating_avg, rating_count, status,
      shop_images ( image_url, is_cover, sort_order ),
      shop_categories ( categories ( name, slug, color, icon, bg_color ) )
    `)
    .eq('status', 'active')
    .ilike('name', `%${query}%`)
    .limit(20)

  if (error) return []
  return (data ?? []).map(toShop)
}

// 조회수 증가 (RPC)
export async function incrementVisit(shopId: string): Promise<void> {
  const supabase = createClient()
  await (supabase as any).rpc('increment_visit_count', { p_shop_id: shopId })
}

// 찜 추가 (Step 09에서 활성화)
export async function saveBookmark(shopId: string, userId: string): Promise<void> {
  const supabase = createClient()
  await supabase
    .from('saved_shops')
    .insert({ shop_id: shopId, user_id: userId } as any)
}

// 찜 제거
export async function removeBookmark(shopId: string, userId: string): Promise<void> {
  const supabase = createClient()
  await supabase
    .from('saved_shops')
    .delete()
    .eq('shop_id', shopId)
    .eq('user_id', userId)
}

// 내 찜 샵 ID 목록
export async function getSavedShopIds(userId: string): Promise<string[]> {
  const supabase = createClient()

  const { data } = await supabase
    .from('saved_shops')
    .select('shop_id')
    .eq('user_id', userId)

  return (data ?? []).map((d: any) => d.shop_id)
}

// 샵 등록
export async function createShop(
  data: ShopFormData,
  userId: string
): Promise<{ slug: string } | null> {
  const supabase = createClient()

  const { data: shop, error } = await supabase
    .from('shops')
    .insert({
      slug:         data.slug,
      name:         data.name,
      description:  data.description || null,
      addr:         data.addr || null,
      lat:          data.lat,
      lng:          data.lng,
      hours:        data.hours,
      parking:      data.parking,
      parking_note: data.parking_note || null,
      shop_link:    data.shop_link || null,
      start_date:   data.start_date || null,
      end_date:     data.end_date || null,
      event_info:   data.event_info || null,
      added_by:     userId,
      owner_id:     userId,
      status:       'pending',
    } as any)
    .select('slug, id')
    .single()

  if (error || !shop) return null

  // 카테고리 연결
  if (data.cats.length > 0) {
    const { data: cats } = await supabase
      .from('categories')
      .select('id, name')
      .in('name', data.cats)

    if (cats && cats.length > 0) {
      await supabase
        .from('shop_categories')
        .insert(cats.map((c: any) => ({ shop_id: shop.id, category_id: c.id })) as any)
    }
  }

  return { slug: shop.slug }
}

// 샵 수정
export async function updateShop(
  shopId: string,
  data: ShopFormData,
  userId: string
): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('shops')
    .update({
      name:         data.name,
      description:  data.description || null,
      addr:         data.addr || null,
      lat:          data.lat,
      lng:          data.lng,
      hours:        data.hours,
      parking:      data.parking,
      parking_note: data.parking_note || null,
      shop_link:    data.shop_link || null,
      start_date:   data.start_date || null,
      end_date:     data.end_date || null,
      event_info:   data.event_info || null,
    } as any)
    .eq('id', shopId)
    .eq('owner_id', userId)

  if (error) return false

  // 카테고리 재연결
  await supabase.from('shop_categories').delete().eq('shop_id', shopId)

  if (data.cats.length > 0) {
    const { data: cats } = await supabase
      .from('categories')
      .select('id, name')
      .in('name', data.cats)

    if (cats && cats.length > 0) {
      await supabase
        .from('shop_categories')
        .insert(cats.map((c: any) => ({ shop_id: shopId, category_id: c.id })) as any)
    }
  }

  return true
}

// 태그별 샵 목록
export async function getShopsByTag(tagSlug: string): Promise<Shop[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('shop_tags')
    .select(`
      shops (
        id, slug, name, description,
        addr, country, region, city, district,
        lat, lng, google_place_id,
        hours, parking, parking_note, shop_link,
        start_date, end_date, event_info,
        rating_avg, rating_count, visit_count, bookmark_count,
        is_verified, is_claimed, status,
        added_by, owner_id, created_at, updated_at,
        shop_images ( image_url, is_cover, sort_order ),
        shop_categories ( categories ( name, slug, color, icon, bg_color ) )
      )
    `)
    .eq('tags.slug', tagSlug)
    .eq('shops.status', 'active')

  if (error) return []
  return (data ?? [])
    .map((d: any) => d.shops)
    .filter(Boolean)
    .map(toShop)
}

// 태그 정보 조회
export async function getTagBySlug(slug: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('tags')
    .select('id, name, slug, created_at')
    .eq('slug', slug)
    .maybeSingle()
  return data
}

// 전체 태그 목록 (인기순)
export async function getAllTags() {
  const supabase = createClient()
  const { data } = await supabase
    .from('tags')
    .select('id, name, slug, created_at')
    .order('name')
  return data ?? []
}