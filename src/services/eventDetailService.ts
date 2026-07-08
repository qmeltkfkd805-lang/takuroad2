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

  /** events에 없는 정보 — 승인된 제보(event_submissions)에서 되짚어 온다 */
  description: string | null
  sourceUrls: string[]
  /** 예매·예약 페이지 */
  ticketUrls: string[]
  placeDetail: string | null
  /** 샵으로 연결되지 않은 이벤트의 장소 (이름·주소·좌표) */
  placeSnapshot: string | null
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
    .select('id, tag_id, type, shop_id, title, start_date, end_date, reserve_start, reserve_end, entry_info, hours_info, hours, cover_url, parking, parking_note, created_by')
    .eq('id', eventId)
    .maybeSingle()

  if (error || !ev) return null
  const e = ev as any

  const [tagRes, shopRes, subRes] = await Promise.all([
    e.tag_id
      ? supabase.from('tags').select('id, name, slug, cover_url').eq('id', e.tag_id).maybeSingle()
      : Promise.resolve({ data: null }),
    e.shop_id
      ? supabase.from('shops')
          .select('id, name, slug, addr, lat, lng, rating_avg, rating_count, sns_links, shop_link')
          .eq('id', e.shop_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('event_submissions')
      .select('description, source_url, source_urls, ticket_urls, place_detail, place_snapshot')
      .eq('event_id', eventId)
      .limit(1)
      .maybeSingle(),
  ])

  const tag: any = tagRes.data
  const shop: any = shopRes.data
  const sub: any = subRes.data

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
    description: sub?.description ?? null,
    // 옛 이벤트는 source_url 하나, 새 이벤트는 source_urls 배열 — 둘 다 받는다
    sourceUrls: Array.isArray(sub?.source_urls) && sub.source_urls.length > 0
      ? (sub.source_urls as string[])
      : (sub?.source_url ? [sub.source_url] : []),
    ticketUrls: Array.isArray(sub?.ticket_urls) ? (sub.ticket_urls as string[]) : [],
    placeDetail: sub?.place_detail ?? null,
    // place_snapshot은 옛 문자열과 카카오 객체가 섞여 있다 — 둘 다 받는다
    ...(() => {
      const snap: any = sub?.place_snapshot ?? null
      if (!snap) return { placeSnapshot: null, placeAddr: null, placeLat: null, placeLng: null }
      if (typeof snap === 'string') return { placeSnapshot: snap, placeAddr: null, placeLat: null, placeLng: null }
      return {
        placeSnapshot: snap.name ?? null,
        placeAddr: snap.roadAddress ?? snap.address ?? null,
        placeLat: snap.lat != null ? Number(snap.lat) : null,
        placeLng: snap.lng != null ? Number(snap.lng) : null,
      }
    })(),
    entryInfo: e.entry_info ?? null,
    hours: (e.hours ?? null) as BusinessHours | null,
    hoursInfo: e.hours_info ?? null,
    parking: e.parking ?? null,
    parkingNote: e.parking_note ?? null,
    createdBy: e.created_by ?? null,
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
