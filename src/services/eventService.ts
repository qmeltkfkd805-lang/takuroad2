import { createClient } from '@/lib/supabase/client'

// 작품(tag)에 일어난 사건. type별로 표시만 다르게.
export interface WorkEvent {
  id: string
  tagId: string
  type: string
  shopId: string | null
  title: string | null
  createdAt: string
}

// 작품 이벤트 type별 아이콘/라벨 (작품 홈·샵 상세 공용)
export const WORK_EVENT_ICON: Record<string, string> = {
  goods_added: '🆕', popup: '🎪', collab_cafe: '☕', exhibition: '🖼️',
}
export const WORK_EVENT_LABEL: Record<string, string> = {
  goods_added: '새 굿즈', popup: '팝업스토어', collab_cafe: '콜라보 카페', exhibition: '전시',
}

// 한 작품의 최근 Event들 (작품 홈 "새로운 소식"용). 최신순.
export async function getEventsByTag(tagId: string, limit = 20): Promise<WorkEvent[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('events')
    .select('id, tag_id, type, shop_id, title, created_at')
    .eq('tag_id', tagId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []
  return (data ?? []).map((e: any) => ({
    id: e.id,
    tagId: e.tag_id,
    type: e.type,
    shopId: e.shop_id,
    title: e.title,
    createdAt: e.created_at,
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