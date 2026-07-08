import { createClient } from '@/lib/supabase/client'

export type GoodsKind = 'menu' | 'goods'

export interface EventGoods {
  id: string
  eventId: string
  name: string | null
  kind: GoodsKind
  price: number | null
  imageUrl: string | null
  updatedAt: string
  updatedBy: { id: string; nickname: string } | null
}

export interface GoodsInput {
  name: string | null
  kind: GoodsKind
  price: number | null
  imageUrl: string | null
}

// ⚠️ created_by · updated_by 둘 다 profiles를 가리켜 관계가 모호하다.
//    FK 이름을 명시하지 않으면 목록이 통째로 빈 채 에러도 안 뜬다.
const SELECT = `
  id, event_id, name, kind, price, image_url, updated_at,
  editor:profiles!event_goods_updated_by_fkey ( id, nickname )
`

function toGoods(raw: any): EventGoods {
  const ed: any = Array.isArray(raw.editor) ? raw.editor[0] : raw.editor
  return {
    id: raw.id,
    eventId: raw.event_id,
    name: raw.name ?? null,
    kind: raw.kind,
    price: raw.price ?? null,
    imageUrl: raw.image_url ?? null,
    updatedAt: raw.updated_at,
    updatedBy: ed ? { id: ed.id, nickname: ed.nickname } : null,
  }
}

export async function getEventGoods(eventId: string): Promise<EventGoods[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('event_goods')
    .select(SELECT)
    .eq('event_id', eventId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })

  if (error) return []
  return (data ?? []).map(toGoods)
}

export async function createEventGoods(eventId: string, userId: string, input: GoodsInput): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('event_goods').insert({
    event_id: eventId,
    name: input.name?.trim() || null,
    kind: input.kind,
    price: input.price,
    image_url: input.imageUrl,
    created_by: userId,
    updated_by: userId,
  } as any)
  return !error
}

/** 위키식 — 로그인한 누구나 수정 가능. 수정 전 값은 트리거가 이력에 남긴다. */
export async function updateEventGoods(id: string, userId: string, input: GoodsInput): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('event_goods')
    .update({
      name: input.name?.trim() || null,
      kind: input.kind,
      price: input.price,
      image_url: input.imageUrl,
      updated_by: userId,
    } as any)
    .eq('id', id)
  return !error
}

/** 물리 삭제가 아니라 숨김 — 되살릴 수 있다 */
export async function hideEventGoods(id: string, userId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('event_goods')
    .update({ is_deleted: true, updated_by: userId } as any)
    .eq('id', id)
  return !error
}

export interface UploadResult {
  url: string | null
  error: string | null
}

/** 파일명 대신 MIME 타입에서 확장자를 뽑는다 (확장자 없는 파일·한글 파일명 대응) */
function extOf(file: File): string {
  const fromMime = file.type.split('/')[1]
  if (fromMime && /^[a-z0-9]+$/i.test(fromMime)) return fromMime === 'jpeg' ? 'jpg' : fromMime
  const fromName = file.name.split('.').pop() ?? ''
  return /^[a-z0-9]+$/i.test(fromName) ? fromName.toLowerCase() : 'jpg'
}

export async function uploadGoodsImage(eventId: string, file: File): Promise<UploadResult> {
  const supabase = createClient()
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const path = `${eventId}/${rand}.${extOf(file)}`

  const { error } = await supabase.storage.from('event-goods').upload(path, file, { upsert: false })
  if (error) {
    // 원인을 삼키지 않는다 — 버킷 없음 / RLS 거부 / 용량 초과가 전부 여기로 온다
    console.error('[굿즈 이미지 업로드 실패]', error.message, error)
    return { url: null, error: error.message }
  }

  const { data } = supabase.storage.from('event-goods').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}
