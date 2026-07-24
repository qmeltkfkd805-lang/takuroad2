import { createClient } from '@/lib/supabase/client'

export type ShopEventType =
  | 'notice' | 'event' | 'restock' | 'new_arrival'
  | 'sold_out' | 'discount' | 'reservation'
  | 'exchange_meet' | 'fan_meet'

export const EVENT_TYPE_ICON: Record<ShopEventType, string> = { notice: 'megaphone', event: 'event', restock: 'box', new_arrival: 'sparkle', sold_out: 'close', discount: 'gift', reservation: 'ticket', exchange_meet: 'handshake', fan_meet: 'users' }

export const EVENT_TYPE_LABEL: Record<ShopEventType, string> = {
  notice: '공지', event: '이벤트', restock: '재입고', new_arrival: '신상품',
  sold_out: '품절', discount: '할인', reservation: '예약',
  exchange_meet: '교환회', fan_meet: '팬모임',
}

// 샵 상세에 보여줄 활성 이벤트 (기간 만료된 건 자동으로 안 보임)
export async function getActiveShopEvents(shopId: string) {
  const supabase = createClient()
  const now = new Date().toISOString()

  const { data } = await supabase
    .from('shop_events')
    .select('*, tags ( name, slug ), goods_types ( name, icon )')
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  return data ?? []
}

// 사장님 관리용 — 전체 이벤트 (비활성/만료 포함)
export async function getAllShopEvents(shopId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('shop_events')
    .select('*, tags ( name, slug ), goods_types ( name, icon )')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function createShopEvent(params: {
  shopId: string
  type: ShopEventType
  title: string
  description?: string
  imageUrl?: string
  videoUrl?: string
  tagId?: string
  goodsTypeId?: string
  startsAt?: string | null
  endsAt?: string | null
  isPinned?: boolean
  userId: string
}): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('shop_events')
    .insert({
      shop_id: params.shopId,
      type: params.type,
      title: params.title,
      description: params.description ?? null,
      image_url: params.imageUrl ?? null,
      video_url: params.videoUrl ?? null,
      tag_id: params.tagId ?? null,
      goods_type_id: params.goodsTypeId ?? null,
      starts_at: params.startsAt ?? null,
      ends_at: params.endsAt ?? null,
      is_pinned: params.isPinned ?? false,
      created_by: params.userId,
    } as any)
  return !error
}

export async function updateShopEvent(eventId: string, data: any): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('shop_events')
    .update({ ...data, updated_at: new Date().toISOString() } as any)
    .eq('id', eventId)
  return !error
}

export async function deactivateShopEvent(eventId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('shop_events')
    .update({ is_active: false } as any)
    .eq('id', eventId)
  return !error
}

export async function pinShopEvent(eventId: string, isPinned: boolean): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('shop_events')
    .update({ is_pinned: isPinned } as any)
    .eq('id', eventId)
  return !error
}

export async function deleteShopEvent(eventId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('shop_events')
    .delete()
    .eq('id', eventId)
  return !error
}

export async function uploadEventImage(file: File, shopSlug: string): Promise<string | null> {
  const supabase = createClient()
  const ext = file.name.split('.').pop()
  const path = `${shopSlug}/events/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('shop-images')
    .upload(path, file)

  if (error) return null

  const { data } = supabase.storage.from('shop-images').getPublicUrl(path)
  return data.publicUrl
}
// ── 매장 소식 영상 업로드 (릴스형) ──
// 용량 제한 50MB — 무료 스토리지 보호
export const MAX_EVENT_VIDEO_MB = 50

export async function uploadEventVideo(file: File, shopSlug: string): Promise<string | null> {
  if (file.size > MAX_EVENT_VIDEO_MB * 1024 * 1024) return null
  const supabase = createClient()
  const ext = file.name.split('.').pop()
  const path = shopSlug + '/events/video-' + Date.now() + '.' + ext

  const { error } = await supabase.storage
    .from('shop-images')
    .upload(path, file, { contentType: file.type })

  if (error) {
    console.error('uploadEventVideo 실패:', file.type, file.size, JSON.stringify(error))
    return null
  }

  const { data } = supabase.storage.from('shop-images').getPublicUrl(path)
  return data.publicUrl
}
// 수정 화면용 — 소식 1건 조회
export async function getShopEventById(eventId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('shop_events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle()
  return data ?? null
}
// 숨김 ↔ 다시 표시 토글
export async function setShopEventActive(eventId: string, isActive: boolean): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('shop_events')
    .update({ is_active: isActive } as any)
    .eq('id', eventId)
  return !error
}