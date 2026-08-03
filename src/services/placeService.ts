import { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
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
  // 한글 slug는 URL을 거치며 유니코드 정규화(NFC/NFD)가 달라질 수 있어
  // DB 저장값과 바이트가 안 맞으면 .eq()가 0건이 된다. 두 형태를 모두 시도한다.
  const decoded = (() => { try { return decodeURIComponent(slug) } catch { return slug } })()
  const variants = Array.from(new Set([
    slug, decoded,
    slug.normalize('NFC'), slug.normalize('NFD'),
    decoded.normalize('NFC'), decoded.normalize('NFD'),
  ]))

  let place: any = null
  for (const v of variants) {
    const { data, error } = await supabase.from('places').select('*').eq('slug', v).maybeSingle()
    if (error) { console.error('[place] 조회 실패:', error.message); continue }
    if (data) { place = data; break }
  }
  // 최후: 대소문자·정규화 무시 부분매칭
  if (!place) {
    const { data } = await supabase.from('places').select('*').ilike('slug', decoded).limit(1).maybeSingle()
    if (data) place = data
  }
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
      temporary_holiday_start, temporary_holiday_end, temporary_holiday_message,
        added_by, owner_id, created_at, updated_at,
        shop_images ( image_url, is_cover, sort_order ),
        cats
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


/* ═══════ 카카오 Place 자동 연결/생성 ═══════ */

/** 카카오 카테고리를 place_type으로 느슨하게 매핑 (실패해도 안 깨지게 기본값) */
function mapKakaoCategory(groupCode: string | null, categoryName: string | null): PlaceType {
  // category_group_code 우선
  if (groupCode === 'CT1') return 'CULTURE_SPACE'   // 문화시설
  if (groupCode === 'AT4') return 'EXHIBITION'      // 관광명소(전시 성격 많음)

  // 없으면 카테고리 이름으로 (카카오 원본 문자열)
  const c = categoryName ?? ''
  if (c.includes('백화점')) return 'DEPARTMENT_STORE'
  if (c.includes('쇼핑몰') || c.includes('아울렛') || c.includes('마트')) return 'SHOPPING_MALL'
  if (c.includes('전시') || c.includes('미술') || c.includes('박물')) return 'EXHIBITION'
  if (c.includes('컨벤션') || c.includes('전시장') || c.includes('행사')) return 'EVENT_HALL'
  if (c.includes('문화')) return 'CULTURE_SPACE'

  return 'SHOPPING_MALL'   // 기본값 (매핑 실패해도 진행)
}


/* ═══════ place_address_map — 주소로 place 자동 연결 ═══════ */

/**
 * 주소 정규화 — 매핑 key로 쓴다.
 * 키워드 매칭이 아니라 "표기 흔들림 제거" 규칙이라 안 썩는다.
 *   "경기 수원시 장안구 수성로 175 (정자동) 3층 305호" → "경기수원시장안구수성로175"
 */
export function normalizeAddr(addr: string | null | undefined): string {
  if (!addr) return ''
  return addr
    .replace(/\([^)]*\)/g, ' ')                    // 괄호 안 (동 이름 등) 제거
    .replace(/\s*\d+\s*(층|호|동)\b/g, ' ')        // "3층" "305호" "101동" 상세주소 제거
    .replace(/\s*[Bb]?\d+[Ff]\b/g, ' ')            // "3F" "B1F" 층 표기 제거
    .replace(/\s+/g, '')                          // 모든 공백 제거
    .trim()
}

/** 주소로 연결된 place 찾기 (등록 시 자동 연결) */
export async function findPlaceByAddr(addr: string | null): Promise<{ id: string; name: string; slug: string } | null> {
  const key = normalizeAddr(addr)
  if (!key) return null
  const supabase = createClient()

  const { data, error } = await supabase
    .from('place_address_map')
    .select('places ( id, name, slug )')
    .eq('addr', key)
    .maybeSingle()

  if (error) { console.error('[place] 주소 매핑 조회 실패:', error.message); return null }
  const place: any = (data as any)?.places
  return place ? { id: place.id, name: place.name, slug: place.slug } : null
}

/**
 * 같은 주소(정규화 기준)를 가진 다른 샵이 이미 어떤 장소에 연결돼 있으면 그 장소를 돌려준다.
 * place_address_map에 학습돼 있지 않아도, "완전히 같은 주소면 한 장소로 묶는다"를 보장한다.
 */
export async function findPlaceBySameAddr(addr: string | null): Promise<{ id: string; name: string; slug: string } | null> {
  const key = normalizeAddr(addr)
  if (!key) return null
  const supabase = createClient()

  const { data, error } = await supabase
    .from('shops')
    .select('addr, places ( id, name, slug )')
    .not('place_id', 'is', null)
    .eq('status', 'active')

  if (error) { console.error('[place] 동일 주소 샵 조회 실패:', error.message); return null }
  for (const row of (data ?? []) as any[]) {
    const p = row.places
    if (p && normalizeAddr(row.addr) === key) return { id: p.id, name: p.name, slug: p.slug }
  }
  return null
}

/**
 * 관리자 학습 — "이 주소는 이 장소다"를 등록한다.
 * 1) place 없으면 카카오 정보로 생성
 * 2) place_address_map에 (정규화 주소 → place_id) 등록
 * 반환된 place_id를 호출부에서 shop.place_id로 연결하면 된다.
 */
export async function mapAddrToPlace(input: {
  addr: string                    // 원본 주소 (정규화는 내부에서)
  // 카카오에서 고른 장소 정보 (place가 아직 없을 때 생성용)
  kakaoPlaceId: string | null
  name: string
  placeAddr: string | null
  region: string | null
  district: string | null
  lat: number | null
  lng: number | null
  categoryName: string | null
  categoryGroupCode: string | null
}): Promise<{ id: string; name: string; slug: string } | null> {
  const supabase = createClient()
  const key = normalizeAddr(input.addr)
  if (!key) return null

  // 1) 이 카카오 장소로 이미 만든 place가 있나
  let placeId: string | null = null
  let placeRow: any = null

  if (input.kakaoPlaceId) {
    const { data: existing } = await supabase
      .from('places').select('id, name, slug')
      .eq('kakao_place_id', input.kakaoPlaceId).maybeSingle()
    if (existing) { placeId = existing.id; placeRow = existing }
  }

  // 2) 없으면 생성
  if (!placeId) {
    // slug는 ASCII만 — 한글이 URL을 거치며 정규화가 바뀌면 조회가 깨진다.
    const base = input.name.trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'place'
    const suffix = input.kakaoPlaceId ? input.kakaoPlaceId.slice(-6) : Math.random().toString(36).slice(2, 6)
    const { data: created, error } = await supabase
      .from('places')
      .insert({
        slug: `${base}-${suffix}`,
        name: input.name.trim(),
        place_type: mapKakaoCategory(input.categoryGroupCode, input.categoryName),
        addr: input.placeAddr,
        region: input.region,
        district: input.district,
        lat: input.lat,
        lng: input.lng,
        kakao_place_id: input.kakaoPlaceId,
        category_name: input.categoryName,
        system_created: false,   // 관리자가 지정한 것이라 시스템 자동생성 아님
      } as any)
      .select('id, name, slug').single()
    if (error || !created) { console.error('[place] 생성 실패:', error?.message); return null }
    placeId = created.id; placeRow = created
  }

  // 3) 주소 → place 매핑 등록 (이미 있으면 갱신)
  const { error: mapErr } = await supabase
    .from('place_address_map')
    .upsert({ addr: key, place_id: placeId } as any, { onConflict: 'addr' })
  if (mapErr) { console.error('[place] 주소 매핑 등록 실패:', mapErr.message); return null }

  return { id: placeRow.id, name: placeRow.name, slug: placeRow.slug }
}
