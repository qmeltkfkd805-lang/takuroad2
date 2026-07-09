import { createClient } from '@/lib/supabase/client'
import { resolveEventCover } from '@/lib/event/eventCover'
import { EventHomeType } from '@/services/eventHomeService'
import { BusinessHours } from '@/types/database'

export interface EventDetail {
  id: string
  type: EventHomeType
  title: string
  startDate: string | null
  endDate: string | null
  /** 사전예약 기간 (없으면 null) */
  reserveStart: string | null
  reserveEnd: string | null
  /** 화면에 보이는 커버 (없으면 작품 커버로 대체된 값) */
  coverUrl: string | null
  /** events.cover_url 원본 — 수정 폼은 이걸 읽어야 작품 커버가 박제되지 않는다 */
  posterUrl: string | null

  work: { id: string; name: string; slug: string } | null
  shop: {
    id: string; name: string; slug: string
    addr: string | null
    lat: number | null; lng: number | null
    ratingAvg: number | null; ratingCount: number | null
    snsLinks: string[]
    shopLink: string | null
  } | null

  description: string | null
  sourceUrls: string[]
  /** 예매·예약 페이지 */
  ticketUrls: string[]
  placeDetail: string | null
  /** 샵으로 연결되지 않은 이벤트의 장소 (이름·주소·좌표) */
  placeSnapshot: string | null
  placeId: string | null
  placeAddr: string | null
  placeLat: number | null
  placeLng: number | null
  /** 입장 방법 (관리자 입력, 없으면 null) */
  entryInfo: string | null
  /** 요일별 운영시간 */
  hours: BusinessHours | null
  /** 추가 안내 텍스트 */
  hoursInfo: string | null
  /** 주차 — true 가능 / false 불가 / null 모름 */
  parking: boolean | null
  parkingNote: string | null
  /** 이 이벤트를 올린 사람. 제보 없이 만들어진 이벤트는 null */
  createdBy: string | null
  /** 마지막으로 고친 사람 (위키라서 표시한다) */
  updatedByName: string | null
  updatedAt: string | null
}

export interface RelatedEvent {
  id: string
  type: EventHomeType
  title: string
  startDate: string | null
  endDate: string | null
  shopName: string | null
  coverUrl: string | null
}

export async function getEventDetail(eventId: string): Promise<EventDetail | null> {
  const supabase = createClient()

  const { data: ev, error } = await supabase
    .from('events')
    .select('id, tag_id, type, shop_id, title, start_date, end_date, reserve_start, reserve_end, entry_info, hours_info, hours, cover_url, parking, parking_note, description, place_name, place_addr, place_lat, place_lng, place_detail, place_id, source_urls, ticket_urls, created_by, updated_by, updated_at')
    .eq('id', eventId)
    .maybeSingle()

  if (error || !ev) return null
  const e = ev as any

  const [tagRes, shopRes, editorRes] = await Promise.all([
    e.tag_id
      ? supabase.from('tags').select('id, name, slug, cover_url').eq('id', e.tag_id).maybeSingle()
      : Promise.resolve({ data: null }),
    e.shop_id
      ? supabase.from('shops')
          .select('id, name, slug, addr, lat, lng, rating_avg, rating_count, sns_links, shop_link')
          .eq('id', e.shop_id).maybeSingle()
      : Promise.resolve({ data: null }),
    e.updated_by
      ? supabase.from('profiles').select('nickname').eq('id', e.updated_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const tag: any = tagRes.data
  const shop: any = shopRes.data
  const editor: any = editorRes.data

  return {
    id: e.id,
    type: e.type,
    title: e.title ?? '',
    startDate: e.start_date ?? null,
    endDate: e.end_date ?? null,
    reserveStart: e.reserve_start ?? null,
    reserveEnd: e.reserve_end ?? null,
    coverUrl: resolveEventCover({ eventCoverUrl: e.cover_url ?? null, workCoverUrl: tag?.cover_url ?? null }),
    posterUrl: e.cover_url ?? null,
    work: tag ? { id: tag.id, name: tag.name, slug: tag.slug } : null,
    shop: shop ? {
      id: shop.id, name: shop.name, slug: shop.slug,
      addr: shop.addr ?? null,
      // Supabase numeric은 문자열로 올 수 있어 Number()로 강제
      lat: shop.lat != null ? Number(shop.lat) : null,
      lng: shop.lng != null ? Number(shop.lng) : null,
      ratingAvg: shop.rating_avg != null ? Number(shop.rating_avg) : null,
      ratingCount: shop.rating_count != null ? Number(shop.rating_count) : null,
      snsLinks: Array.isArray(shop.sns_links) ? shop.sns_links : [],
      shopLink: shop.shop_link ?? null,
    } : null,
    description: e.description ?? null,
    sourceUrls: Array.isArray(e.source_urls) ? (e.source_urls as string[]) : [],
    ticketUrls: Array.isArray(e.ticket_urls) ? (e.ticket_urls as string[]) : [],
    placeDetail: e.place_detail ?? null,
    placeSnapshot: e.place_name ?? null,
    placeId: e.place_id ?? null,
    placeAddr: e.place_addr ?? null,
    placeLat: e.place_lat != null ? Number(e.place_lat) : null,
    placeLng: e.place_lng != null ? Number(e.place_lng) : null,
    entryInfo: e.entry_info ?? null,
    hours: (e.hours ?? null) as BusinessHours | null,
    hoursInfo: e.hours_info ?? null,
    parking: e.parking ?? null,
    parkingNote: e.parking_note ?? null,
    createdBy: e.created_by ?? null,
    updatedByName: editor?.nickname ?? null,
    updatedAt: e.updated_at ?? null,
  }
}

/** 같은 작품의 다른 이벤트 (자기 자신 제외, 안 끝난 것 우선) */
export async function getRelatedEvents(tagId: string, excludeId: string, limit = 6): Promise<RelatedEvent[]> {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data } = await supabase
    .from('events')
    .select('id, type, title, shop_id, start_date, end_date, cover_url')
    .eq('tag_id', tagId)
    .neq('id', excludeId)
    .in('type', ['popup', 'collab_cafe', 'exhibition', 'official_event'])
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order('start_date', { ascending: true })
    .limit(limit)

  const rows = (data ?? []) as any[]
  if (rows.length === 0) return []

  const shopIds = [...new Set(rows.map(r => r.shop_id).filter(Boolean))]
  let shopMap = new Map<string, any>()
  if (shopIds.length) {
    const { data: shops } = await supabase.from('shops').select('id, name').in('id', shopIds)
    shopMap = new Map((shops ?? []).map((s: any) => [s.id, s]))
  }

  // 포스터가 없는 이벤트를 위한 작품 커버 (같은 작품이라 한 번만 조회)
  const { data: tagRow } = await supabase.from('tags').select('cover_url').eq('id', tagId).maybeSingle()
  const tagCoverUrl = (tagRow as any)?.cover_url ?? null
  return rows.map(r => ({
    id: r.id,
    type: r.type,
    title: r.title ?? '',
    startDate: r.start_date ?? null,
    endDate: r.end_date ?? null,
    shopName: r.shop_id ? (shopMap.get(r.shop_id)?.name ?? null) : null,
    // 자기 포스터가 있으면 그걸, 없으면 작품 커버 (같은 작품이므로 tagCoverUrl 하나로 충분)
    coverUrl: resolveEventCover({ eventCoverUrl: r.cover_url ?? null, workCoverUrl: tagCoverUrl }),
  }))
}


// ── 수정 / 삭제 ────────────────────────────────────────────
// 권한은 RLS가 강제한다(작성자 또는 관리자). 클라이언트 체크는 UI를 위한 것일 뿐.

export interface EventEditInput {
  title: string
  type: EventHomeType
  startDate: string | null
  endDate: string | null
  reserveStart: string | null
  reserveEnd: string | null
  hours: BusinessHours | null
  hoursInfo: string | null
  entryInfo: string | null
}

export async function updateEvent(id: string, input: EventEditInput): Promise<{ ok: boolean; message?: string }> {
  const supabase = createClient()
  const { error } = await supabase
    .from('events')
    .update({
      title: input.title.trim(),
      type: input.type,
      start_date: input.startDate,
      end_date: input.endDate,
      reserve_start: input.reserveStart,
      reserve_end: input.reserveEnd,
      hours: input.hours,
      hours_info: input.hoursInfo?.trim() || null,
      entry_info: input.entryInfo?.trim() || null,
    } as any)
    .eq('id', id)

  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** 굿즈·후기·Q&A는 on delete cascade 로 함께 사라진다 */
export async function deleteEvent(id: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = createClient()
  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}
