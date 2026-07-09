import { SupabaseClient } from '@supabase/supabase-js'
import { toShop } from '@/services/shopService'
import { resolveEventCover } from '@/lib/event/eventCover'
import type { Shop } from '@/types/shop'

export type PlaceType =
  | 'SHOPPING_MALL' | 'DEPARTMENT_STORE' | 'EXHIBITION' | 'EVENT_HALL' | 'CULTURE_SPACE'

export const PLACE_TYPE_LABEL: Record<PlaceType, string> = {
  SHOPPING_MALL:   '쇼핑몰',
  DEPARTMENT_STORE:'백화점',
  EXHIBITION:      '전시장',
  EVENT_HALL:      '행사장',
  CULTURE_SPACE:   '문화공간',
}

export interface PlaceEvent {
  id: string
  title: string
  type: string
  startDate: string | null
  endDate: string | null
  cover: string | null
  shopName: string | null   // 이 장소 안 어느 샵의 이벤트인지 (없으면 장소 직속)
}

export interface PlaceDetail {
  id: string
  slug: string
  name: string
  placeType: PlaceType
  addr: string | null
  region: string | null
  district: string | null
  lat: number | null
  lng: number | null
  description: string | null
  hours: any
  parking: boolean | null
  parkingNote: string | null
  coverUrl: string | null
  shops: Shop[]         // 입점 샵 (floor/unit 로 정렬)
  events: PlaceEvent[]  // 진행 중 이벤트
}

/**
 * 장소 + 입점 샵 + 진행 중 이벤트를 한 번에.
 * 서버/클라이언트 어디서든 쓰도록 supabase 클라이언트를 받는다.
 */
export async function getPlaceBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<PlaceDetail | null> {
  const { data: place, error } = await supabase
    .from('places')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) { console.error('[place] 조회 실패:', error.message); return null }
  if (!place) return null

  const today = new Date().toISOString().slice(0, 10)

  // 입점 샵 + 그 장소 직속/소속 이벤트
  const [shopRes, evRes] = await Promise.all([
    supabase
      .from('shops')
      .select(`
        id, slug, name, description,
        addr, country, region, city, district,
        lat, lng, google_place_id,
        place_id, floor, unit,
        places ( name, lat, lng ),
        hours, parking, parking_note, shop_link, sns_links, phone,
        start_date, end_date, event_info,
        rating_avg, rating_count, visit_count, bookmark_count,
        is_verified, is_claimed, status,
        added_by, owner_id, created_at, updated_at,
        shop_images ( image_url, is_cover, sort_order ),
        shop_categories ( categories ( name, slug, color, icon, bg_color ) )
      `)
      .eq('place_id', place.id)
      .eq('status', 'active'),

    supabase
      .from('events')
      .select('id, title, type, start_date, end_date, cover_url, tag_id, shop_id, place_id')
      .eq('place_id', place.id)
      .lte('start_date', today)
      .or(`end_date.is.null,end_date.gte.${today}`),
  ])

  if (shopRes.error) console.error('[place] 입점 샵 조회 실패:', shopRes.error.message)
  if (evRes.error) console.error('[place] 이벤트 조회 실패:', evRes.error.message)

  const shops = (shopRes.data ?? [])
    .map(toShop)
    .sort((a, b) => (a.floor ?? '').localeCompare(b.floor ?? '', 'ko', { numeric: true }))

  // 이벤트 포스터: cover_url → 작품 커버
  const evRows = (evRes.data ?? []) as any[]
  const tagIds = [...new Set(evRows.map(e => e.tag_id).filter(Boolean))]
  const shopIds = [...new Set(evRows.map(e => e.shop_id).filter(Boolean))]
  const [tagRes, evShopRes] = await Promise.all([
    tagIds.length ? supabase.from('tags').select('id, cover_url').in('id', tagIds) : Promise.resolve({ data: [] as any[] }),
    shopIds.length ? supabase.from('shops').select('id, name').in('id', shopIds) : Promise.resolve({ data: [] as any[] }),
  ])
  const tagCover = new Map<string, string | null>((tagRes.data ?? []).map((t: any) => [t.id, t.cover_url ?? null]))
  const shopName = new Map<string, string>((evShopRes.data ?? []).map((s: any) => [s.id, s.name]))

  const events: PlaceEvent[] = evRows.map(e => ({
    id: e.id,
    title: e.title ?? '이벤트',
    type: e.type,
    startDate: e.start_date ?? null,
    endDate: e.end_date ?? null,
    cover: resolveEventCover({
      eventCoverUrl: e.cover_url ?? null,
      workCoverUrl: e.tag_id ? (tagCover.get(e.tag_id) ?? null) : null,
    }),
    shopName: e.shop_id ? (shopName.get(e.shop_id) ?? null) : null,
  }))

  return {
    id: place.id,
    slug: place.slug,
    name: place.name,
    placeType: place.place_type,
    addr: place.addr ?? null,
    region: place.region ?? null,
    district: place.district ?? null,
    lat: place.lat ?? null,
    lng: place.lng ?? null,
    description: place.description ?? null,
    hours: place.hours ?? null,
    parking: place.parking ?? null,
    parkingNote: place.parking_note ?? null,
    coverUrl: place.cover_url ?? null,
    shops,
    events,
  }
}
