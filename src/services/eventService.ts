import { createClient } from '@/lib/supabase/client'
import { resolveEventCover } from '@/lib/event/eventCover'
import { rankEvents } from '@/lib/event/rankEvents'

// 작품(tag)에 일어난 사건. type별로 표시만 다르게.
export interface WorkEvent {
  id: string
  tagId: string
  type: string
  shopId: string | null
  title: string | null
  createdAt: string
  // 상세(모달)용 — 일부 호출처(검수 미리보기 등)는 안 채움
  startDate?: string | null
  endDate?: string | null
  shopName?: string | null
  shopSlug?: string | null
  coverUrl?: string | null
  shopImage?: string | null
}

// 작품 이벤트 type별 아이콘/라벨 (작품 홈·샵 상세 공용)
export const WORK_EVENT_ICON: Record<string, string> = { goods_added: 'goods', popup: 'popup', collab_cafe: 'cafe', exhibition: 'exhibition' }
export const WORK_EVENT_LABEL: Record<string, string> = {
  goods_added: '새 굿즈', popup: '팝업스토어', collab_cafe: '콜라보 카페', exhibition: '전시',
}

// 한 작품의 최근 Event들 (작품 홈 "새로운 소식"용). 최신순.
// 모달 상세를 위해 기간 + 연결된 샵 이름/slug도 같이 붙여 옴.
export async function getEventsByTag(tagId: string, limit = 20): Promise<WorkEvent[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('events')
    .select('id, tag_id, type, shop_id, title, created_at, start_date, end_date, cover_url')
    .eq('tag_id', tagId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []
  const rows = data ?? []

  // 샵 이름/슬러그 붙이기 (모달의 "어디서" + 샵 링크용)
  const shopIds = [...new Set(rows.map((e: any) => e.shop_id).filter(Boolean))]
  let shopMap = new Map<string, any>()
  if (shopIds.length) {
    const { data: shops } = await supabase.from('shops').select('id, name, slug, shop_images ( image_url, is_cover )').in('id', shopIds)
    shopMap = new Map((shops ?? []).map((s: any) => [s.id, s]))
  }

  return rows.map((e: any) => ({
    id: e.id,
    tagId: e.tag_id,
    type: e.type,
    shopId: e.shop_id,
    title: e.title,
    createdAt: e.created_at,
    startDate: e.start_date,
    endDate: e.end_date,
    shopName: e.shop_id ? (shopMap.get(e.shop_id)?.name ?? null) : null,
    shopSlug: e.shop_id ? (shopMap.get(e.shop_id)?.slug ?? null) : null,
    coverUrl: e.cover_url ?? null,
    shopImage: ((shopMap.get(e.shop_id)?.shop_images ?? []).find((i: any) => i.is_cover)?.image_url ?? (shopMap.get(e.shop_id)?.shop_images ?? [])[0]?.image_url ?? null),
  }))
}

// 한 샵에서 열리는 작품 이벤트 (샵 상세 타임라인용).
// - 팝업/콜라보/전시만 (goods_added는 작품 피드용이라 샵 소식엔 제외)
// - 만료된 건 제외 (end_date가 없거나 오늘 이후인 것만)
export interface ShopWorkEvent {
  id: string
  type: string
  title: string | null
  startDate: string | null
  endDate: string | null
  createdAt: string
  /** 이벤트 포스터, 없으면 작품 커버 (이벤트 홈과 같은 규칙) */
  coverUrl: string | null
  workName: string | null
  workSlug: string | null
  tagId: string | null
}

export async function getEventsByShop(shopId: string): Promise<ShopWorkEvent[]> {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)   // YYYY-MM-DD

  const { data, error } = await supabase
    .from('events')
    .select('id, type, title, start_date, end_date, created_at, cover_url, tag_id')
    .eq('shop_id', shopId)
    .in('type', ['popup', 'collab_cafe', 'exhibition'])
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order('created_at', { ascending: false })

  if (error) { console.error('[샵 이벤트] 조회 실패:', error.message); return [] }
  const rows = data ?? []

  // 작품명·작품 커버 붙이기 (포스터가 없는 이벤트는 작품 커버로 대체)
  const tagIds = [...new Set(rows.map((e: any) => e.tag_id).filter(Boolean))]
  let tagMap = new Map<string, any>()
  if (tagIds.length) {
    const { data: tags } = await supabase.from('tags').select('id, name, slug, cover_url').in('id', tagIds)
    tagMap = new Map((tags ?? []).map((t: any) => [t.id, t]))
  }

  const items: ShopWorkEvent[] = rows.map((e: any) => {
    const tag = e.tag_id ? tagMap.get(e.tag_id) : null
    return {
      id: e.id,
      type: e.type,
      title: e.title,
      startDate: e.start_date,
      endDate: e.end_date,
      createdAt: e.created_at,
      coverUrl: resolveEventCover({ eventCoverUrl: e.cover_url ?? null, workCoverUrl: tag?.cover_url ?? null }),
      workName: tag?.name ?? null,
      workSlug: tag?.slug ?? null,
      tagId: e.tag_id ?? null,
    }
  })

  // 이벤트 홈과 같은 순서: 오늘 종료 > 종료 임박 > 진행 중(끝나는 날 가까운 순) > 곧 시작(시작 가까운 순)
  // (최애 작품 가산점은 샵 상세에서 최애 목록을 안 읽으므로 빠진다)
  return rankEvents(items).map(r => r.event)
}

/* 같은 이벤트의 다른 지점 (events.series_key가 같은 것들). 이벤트 상세 하단용. */
export interface SeriesSibling {
  id: string
  title: string | null
  placeName: string | null
  startDate: string | null
  endDate: string | null
}
export async function getSeriesSiblings(seriesKey: string | null, excludeId: string): Promise<SeriesSibling[]> {
  const key = (seriesKey ?? '').trim()
  if (!key) return []
  const supabase = createClient()
  const { data, error } = await supabase
    .from('events')
    .select('id, title, place_name, shop_id, start_date, end_date')
    .eq('series_key', key)
    .neq('id', excludeId)
    .order('start_date', { ascending: true })
  if (error) { console.error('[다른 지점] 조회 실패:', error.message); return [] }
  const rows = data ?? []

  // 샵에 연결된 지점은 샵 이름이 곧 장소다
  const shopIds = [...new Set(rows.map((r: any) => r.shop_id).filter(Boolean))]
  let shopMap = new Map<string, any>()
  if (shopIds.length) {
    const { data: shops } = await supabase.from('shops').select('id, name').in('id', shopIds)
    shopMap = new Map((shops ?? []).map((s: any) => [s.id, s]))
  }

  return rows.map((r: any) => ({
    id: r.id,
    title: r.title,
    placeName: (r.shop_id ? shopMap.get(r.shop_id)?.name : null) ?? r.place_name ?? null,
    startDate: r.start_date,
    endDate: r.end_date,
  }))
}

/* ───────── 샵 ↔ 이벤트 연결 ─────────
   샵보다 이벤트가 먼저 등록되는 일이 흔하다(그때는 카카오 장소로 넣으므로 shop_id가 빈다).
   나중에 그 자리에 샵이 생겨도 자동으로 이어지지 않아서, 손으로 붙일 수 있게 하는 함수들.
   연결 = events.shop_id 하나. 다른 필드는 건드리지 않는다. */

export interface LinkableEvent {
  id: string
  title: string | null
  type: string
  startDate: string | null
  endDate: string | null
  placeName: string | null
  placeAddr: string | null
  shopId: string | null
}

const EVENT_LINK_COLS = 'id, title, type, start_date, end_date, place_name, place_addr, shop_id'
const toLinkable = (e: any): LinkableEvent => ({
  id: e.id, title: e.title, type: e.type,
  startDate: e.start_date, endDate: e.end_date,
  placeName: e.place_name ?? null, placeAddr: e.place_addr ?? null,
  shopId: e.shop_id ?? null,
})

/** 아직 샵에 안 붙은 이벤트 중 아직 안 끝난 것들 (연결 후보 풀). 매칭 점수는 화면에서 계산. */
export async function getUnlinkedEvents(limit = 300): Promise<LinkableEvent[]> {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_LINK_COLS)
    .is('shop_id', null)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order('start_date', { ascending: false })
    .limit(limit)
  if (error) { console.error('[이벤트 연결] 후보 조회 실패:', error.message); return [] }
  return (data ?? []).map(toLinkable)
}

/** 이 샵에 이미 붙어 있는 이벤트 (끝난 것 포함 — 잘못 붙은 걸 풀 수 있어야 하니까) */
export async function getLinkedEvents(shopId: string): Promise<LinkableEvent[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_LINK_COLS)
    .eq('shop_id', shopId)
    .order('start_date', { ascending: false })
  if (error) { console.error('[이벤트 연결] 연결 목록 조회 실패:', error.message); return [] }
  return (data ?? []).map(toLinkable)
}

/** 이벤트를 이 샵에 연결 / 해제. 위키 방식이라 로그인한 사람이면 수정 가능(events RLS). */
export async function setEventShop(eventId: string, shopId: string | null, userId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('events')
    .update({ shop_id: shopId, updated_by: userId, updated_at: new Date().toISOString() } as any)
    .eq('id', eventId)
  if (error) { console.error('[이벤트 연결] 저장 실패:', error.message); return false }
  return true
}

// 진행중·다가오는 이벤트 (홈 "추천 이벤트"용).
// end_date 없거나 오늘 이후. 작품명/샵명 붙여서 EventCard 형태로.
export interface ActiveEvent {
  id: string
  title: string | null
  type: string
  workName: string | null
  shopName: string | null
  startDate: string | null
  endDate: string | null
  /** 이벤트 포스터, 없으면 작품 커버 */
  coverUrl: string | null
  /** 샵 이름, 없으면 제보에 저장된 장소명 */
  placeName: string | null
}

export async function getActiveEvents(limit = 8): Promise<ActiveEvent[]> {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('events')
    .select('id, tag_id, type, shop_id, title, start_date, end_date, cover_url, place_name')
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order('start_date', { ascending: true })
    .limit(limit)
  if (error) return []
  const rows = data ?? []

  // 작품명(tag) + 샵명 붙이기
  const tagIds = [...new Set(rows.map((e: any) => e.tag_id).filter(Boolean))]
  const shopIds = [...new Set(rows.map((e: any) => e.shop_id).filter(Boolean))]
  let tagMap = new Map<string, any>()
  let shopMap = new Map<string, any>()
  if (tagIds.length) {
    const { data: tags } = await supabase.from('tags').select('id, name, cover_url').in('id', tagIds)
    tagMap = new Map((tags ?? []).map((t: any) => [t.id, t]))
  }
  if (shopIds.length) {
    const { data: shops } = await supabase.from('shops').select('id, name').in('id', shopIds)
    shopMap = new Map((shops ?? []).map((s: any) => [s.id, s]))
  }


  return rows.map((e: any) => ({
    id: e.id,
    title: e.title,
    type: e.type,
    workName: e.tag_id ? (tagMap.get(e.tag_id)?.name ?? null) : null,
    shopName: e.shop_id ? (shopMap.get(e.shop_id)?.name ?? null) : null,
    placeName: (e.shop_id ? shopMap.get(e.shop_id)?.name : null) ?? e.place_name ?? null,
    startDate: e.start_date,
    endDate: e.end_date,
    // 이벤트 포스터 우선, 없으면 작품 커버 (이벤트 홈과 같은 규칙)
    coverUrl: e.cover_url ?? (e.tag_id ? (tagMap.get(e.tag_id)?.cover_url ?? null) : null),
  }))
}