import { createClient } from '@/lib/supabase/client'

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
}

// 작품 이벤트 type별 아이콘/라벨 (작품 홈·샵 상세 공용)
export const WORK_EVENT_ICON: Record<string, string> = {
  goods_added: '🛍️', popup: '🎪', collab_cafe: '☕', exhibition: '🖼️',
}
export const WORK_EVENT_LABEL: Record<string, string> = {
  goods_added: '새 굿즈', popup: '팝업스토어', collab_cafe: '콜라보 카페', exhibition: '전시',
}

// 한 작품의 최근 Event들 (작품 홈 "새로운 소식"용). 최신순.
// 모달 상세를 위해 기간 + 연결된 샵 이름/slug도 같이 붙여 옴.
export async function getEventsByTag(tagId: string, limit = 20): Promise<WorkEvent[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('events')
    .select('id, tag_id, type, shop_id, title, created_at, start_date, end_date')
    .eq('tag_id', tagId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []
  const rows = data ?? []

  // 샵 이름/슬러그 붙이기 (모달의 "어디서" + 샵 링크용)
  const shopIds = [...new Set(rows.map((e: any) => e.shop_id).filter(Boolean))]
  let shopMap = new Map<string, any>()
  if (shopIds.length) {
    const { data: shops } = await supabase.from('shops').select('id, name, slug').in('id', shopIds)
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
}

export async function getEventsByShop(shopId: string): Promise<ShopWorkEvent[]> {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)   // YYYY-MM-DD

  const { data, error } = await supabase
    .from('events')
    .select('id, type, title, start_date, end_date, created_at')
    .eq('shop_id', shopId)
    .in('type', ['popup', 'collab_cafe', 'exhibition'])
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order('created_at', { ascending: false })

  if (error) return []
  return (data ?? []).map((e: any) => ({
    id: e.id,
    type: e.type,
    title: e.title,
    startDate: e.start_date,
    endDate: e.end_date,
    createdAt: e.created_at,
  }))
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
    .select('id, tag_id, type, shop_id, title, start_date, end_date, cover_url')
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

  // 샵이 없는 이벤트는 제보(event_submissions)에 장소명이 남아 있다
  const noShopIds = rows.filter((e: any) => !e.shop_id).map((e: any) => e.id)
  const placeMap = new Map<string, string>()
  if (noShopIds.length) {
    const { data: subs } = await supabase
      .from('event_submissions')
      .select('event_id, place_snapshot')
      .in('event_id', noShopIds)
    for (const s of (subs ?? []) as any[]) {
      // 옛 문자열과 카카오 객체가 섞여 있다
      const snap = s.place_snapshot
      const name = typeof snap === 'string' ? snap : snap?.name
      if (name) placeMap.set(s.event_id, name)
    }
  }

  return rows.map((e: any) => ({
    id: e.id,
    title: e.title,
    type: e.type,
    workName: e.tag_id ? (tagMap.get(e.tag_id)?.name ?? null) : null,
    shopName: e.shop_id ? (shopMap.get(e.shop_id)?.name ?? null) : null,
    placeName: (e.shop_id ? shopMap.get(e.shop_id)?.name : null) ?? placeMap.get(e.id) ?? null,
    startDate: e.start_date,
    endDate: e.end_date,
    // 이벤트 포스터 우선, 없으면 작품 커버 (이벤트 홈과 같은 규칙)
    coverUrl: e.cover_url ?? (e.tag_id ? (tagMap.get(e.tag_id)?.cover_url ?? null) : null),
  }))
}