import { createClient } from '@/lib/supabase/client'
import { EventHomeType } from '@/services/eventHomeService'
import { BusinessHours } from '@/types/database'
import { getEventDetail } from '@/services/eventDetailService'
import { EventHours } from '@/lib/event/eventHours'

// 위저드가 다루는 전체 폼. 저장될 때 세 테이블로 갈라진다.
//   events            : tagId, type, title, startDate, endDate, shopId, hoursInfo, entryInfo
//   event_submissions : description, sourceUrl, placeDetail, placeSnapshot
//   event_goods       : 굿즈 (별도 서비스)
export interface EventFormData {
  tagId: string | null
  type: EventHomeType
  title: string
  /** 메인 이미지(포스터). 없으면 작품 커버가 대신 쓰인다 */
  coverUrl: string | null
  startDate: string
  endDate: string
  /** 사전예약 기간 (선택) */
  reserveStart: string
  reserveEnd: string

  shopId: string | null
  /** 샵을 못 찾았을 때 — 카카오 장소 검색 결과 */
  placeName: string
  placeAddr: string
  placeLat: number | null
  placeLng: number | null
  /** 층수·매장 위치 */
  placeDetail: string
  /** 주차 — true 가능 / false 불가 / null 모름 */
  parking: boolean | null
  parkingNote: string

  /** 요일별 운영시간 (샵과 같은 모양) */
  hours: EventHours | null
  /** 표로 표현 안 되는 추가 안내 (예: 라스트 오더 21:00) */
  /** 요일별 운영시간 (샵과 같은 JSON) */
  hours: BusinessHours | null
  /** 추가 안내 — 라스트 오더 등 */
  hoursInfo: string
  entryInfo: string
  description: string
  /** 공식 사이트·SNS. 첫 링크는 하위호환용으로 source_url에도 저장된다 */
  sourceUrls: string[]
  /** 예매·예약 페이지 */
  ticketUrls: string[]
}

export const EMPTY_EVENT_FORM: EventFormData = {
  tagId: null, type: 'popup', title: '', coverUrl: null, startDate: '', endDate: '',
  reserveStart: '', reserveEnd: '',
  shopId: null, placeName: '', placeAddr: '', placeLat: null, placeLng: null, placeDetail: '',
  parking: null, parkingNote: '',
  hours: null, hoursInfo: '', entryInfo: '', description: '', sourceUrls: [''], ticketUrls: [''],
}

const nn = (s: string) => (s.trim() ? s.trim() : null)
const cleanLinks = (arr: string[] | undefined) => (arr ?? []).map(s => s.trim()).filter(Boolean)

/** 2단계 완료 시 — events 행을 만들고 id를 돌려준다 */
export async function createEventDraft(form: EventFormData, userId: string): Promise<{ id: string | null; message?: string }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('events')
    .insert({
      tag_id: form.tagId,
      type: form.type,
      title: form.title.trim(),
      start_date: nn(form.startDate),
      end_date: nn(form.endDate),
      reserve_start: nn(form.reserveStart),
      reserve_end: nn(form.reserveEnd),
      cover_url: form.coverUrl,
      shop_id: form.shopId,
      parking: form.parking,
      parking_note: nn(form.parkingNote),
      created_by: userId,
    } as any)
    .select('id')
    .single()

  if (error) return { id: null, message: error.message }
  return { id: data.id }
}

/** 이후 단계 — events 쪽 필드 갱신 */
export async function updateEventDraft(eventId: string, form: EventFormData): Promise<{ ok: boolean; message?: string }> {
  const supabase = createClient()
  const { error } = await supabase
    .from('events')
    .update({
      tag_id: form.tagId,
      type: form.type,
      title: form.title.trim(),
      start_date: nn(form.startDate),
      end_date: nn(form.endDate),
      reserve_start: nn(form.reserveStart),
      reserve_end: nn(form.reserveEnd),
      cover_url: form.coverUrl,
      shop_id: form.shopId,
      parking: form.parking,
      parking_note: nn(form.parkingNote),
      hours: form.hours,
      hours_info: nn(form.hoursInfo),
      entry_info: nn(form.entryInfo),
    } as any)
    .eq('id', eventId)

  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/**
 * events에 없는 정보(소개·출처·층수·장소명)를 event_submissions에 저장.
 * 이미 있으면 갱신, 없으면 새로 만든다.
 * 나중에 이 컬럼들이 events로 옮겨가면 이 함수만 지우면 된다.
 */
export async function saveEventExtra(eventId: string, form: EventFormData, userId: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = createClient()

  const payload = {
    tag_id: form.tagId,
    type: form.type,
    title: form.title.trim(),
    shop_id: form.shopId,
    // 카카오 원본 모양 그대로 저장 (기존 제보 폼과 같은 형태)
    place_snapshot: form.shopId || !form.placeName.trim() ? null : {
      name: form.placeName.trim(),
      address: form.placeAddr || null,
      roadAddress: form.placeAddr || null,
      lat: form.placeLat,
      lng: form.placeLng,
    },
    place_detail: nn(form.placeDetail),
    start_date: nn(form.startDate),
    end_date: nn(form.endDate),
    // 빈 칸은 버리고, 첫 링크만 옛 컬럼에 남긴다
    source_url: cleanLinks(form.sourceUrls)[0] ?? null,
    source_urls: cleanLinks(form.sourceUrls),
    ticket_urls: cleanLinks(form.ticketUrls),
    description: nn(form.description),
    submitted_by: userId,
    status: 'approved',
    event_id: eventId,
    reviewed_at: new Date().toISOString(),
  }

  const { data: existing } = await supabase
    .from('event_submissions')
    .select('id')
    .eq('event_id', eventId)
    .limit(1)
    .maybeSingle()

  const { error } = existing
    ? await supabase.from('event_submissions').update(payload as any).eq('id', (existing as any).id)
    : await supabase.from('event_submissions').insert(payload as any)

  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** 샵 검색 — 이름으로 (등록된 샵에 연결하면 지도·길찾기·평점이 다 붙는다) */
export async function searchShopsByName(q: string): Promise<{ id: string; name: string; addr: string | null }[]> {
  const query = q.trim()
  if (query.length < 1) return []

  const supabase = createClient()
  const { data, error } = await supabase
    .from('shops')
    .select('id, name, addr')
    .ilike('name', `%${query}%`)
    .eq('status', 'active')
    .limit(8)

  if (error) return []
  return (data ?? []) as any[]
}


/** 수정 모드 — 기존 이벤트를 위저드 폼 모양으로 되돌려 읽는다 */
export async function loadEventForm(eventId: string): Promise<{ form: EventFormData; createdBy: string | null } | null> {
  const ev = await getEventDetail(eventId)
  if (!ev) return null

  return {
    createdBy: ev.createdBy,
    form: {
      tagId: ev.work?.id ?? null,
      type: ev.type,
      title: ev.title,
      coverUrl: ev.posterUrl,   // 작품 커버가 아니라 이벤트 전용 포스터만
      startDate: ev.startDate ?? '',
      endDate: ev.endDate ?? '',
      reserveStart: ev.reserveStart ?? '',
      reserveEnd: ev.reserveEnd ?? '',

      shopId: ev.shop?.id ?? null,
      placeName: ev.shop?.name ?? ev.placeSnapshot ?? '',
      placeAddr: ev.shop?.addr ?? ev.placeAddr ?? '',
      placeLat: ev.shop?.lat ?? ev.placeLat,
      placeLng: ev.shop?.lng ?? ev.placeLng,
      placeDetail: ev.placeDetail ?? '',

      parking: ev.parking,
      parkingNote: ev.parkingNote ?? '',

      hours: ev.hours,
      hoursInfo: ev.hoursInfo ?? '',
      entryInfo: ev.entryInfo ?? '',
      description: ev.description ?? '',
      sourceUrls: ev.sourceUrls.length > 0 ? ev.sourceUrls : [''],
      ticketUrls: ev.ticketUrls.length > 0 ? ev.ticketUrls : [''],
    },
  }
}


/** 메인 이미지 업로드 — 굿즈와 같은 버킷의 covers/ 아래 */
export async function uploadEventCover(file: File): Promise<{ url: string | null; error: string | null }> {
  if (file.size > 5 * 1024 * 1024) return { url: null, error: '사진은 5MB 이하만 올릴 수 있어요.' }

  const supabase = createClient()
  const mime = file.type.split('/')[1]
  const ext = mime && /^[a-z0-9]+$/i.test(mime) ? (mime === 'jpeg' ? 'jpg' : mime) : 'jpg'
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  const { error } = await supabase.storage.from('event-goods').upload(`covers/${rand}.${ext}`, file)
  if (error) {
    console.error('[이벤트 커버 업로드 실패]', error.message)
    return { url: null, error: error.message }
  }
  const { data } = supabase.storage.from('event-goods').getPublicUrl(`covers/${rand}.${ext}`)
  return { url: data.publicUrl, error: null }
}
