import { createClient } from '@/lib/supabase/client'

/* 전시관 서비스 — 조회 개수는 RPC(get_exhibit_count) 직접, 목록/상세/등록은 서버 라우트(signed URL·검증) 경유. */

export type ExhibitVisibility = 'public' | 'followers' | 'private'

export interface ExhibitCard {
  id: string
  caption: string | null
  visibility: ExhibitVisibility
  workName: string | null
  goodsTypeName: string | null
  coverUrl: string | null
  imageCount: number
  hasPost: boolean
  createdAt: string
}

export interface ExhibitDetail {
  id: string
  ownerId: string
  caption: string | null
  visibility: ExhibitVisibility
  goodsName: string | null
  goodsTypeName: string | null
  workId: string | null
  workName: string | null
  images: string[]          // signed URL
  postId: string | null
  goodsItemId: string | null   // 소유자 조회 시에만 채워짐
  createdAt: string
}

export interface CreateExhibitInput {
  goodsItemId: string
  imageIds: string[]        // goods_item_images id, 순서 = 정렬(첫 번째 = 대표)
  caption?: string | null
  visibility: ExhibitVisibility
  sourcePostId?: string | null
}

/* 전시 개수 (본인/타인 모두 can_view_exhibit 적용) */
export async function getExhibitCount(ownerId?: string): Promise<number> {
  const supabase = createClient()
  let owner = ownerId
  if (!owner) { const { data: { user } } = await supabase.auth.getUser(); owner = user?.id }
  if (!owner) return 0
  const { data, error } = await supabase.rpc('get_exhibit_count', { p_owner: owner })
  if (error) return 0
  return Number(data) || 0
}

/* 전시 목록 (cover signed URL 포함) */
export async function getExhibits(ownerId: string): Promise<ExhibitCard[]> {
  const res = await fetch(`/api/exhibit/list?owner=${encodeURIComponent(ownerId)}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('전시 목록을 불러오지 못했어요')
  const json = await res.json()
  return (json.items ?? []) as ExhibitCard[]
}

/* 전시 상세 (이미지 signed URL 포함) */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export async function getExhibitDetail(id: string): Promise<ExhibitDetail | null> {
  // id가 UUID가 아니면(닉네임 등 잘못된 경로) API 호출 없이 not-found 처리
  if (!UUID_RE.test(id)) return null
  const res = await fetch(`/api/exhibit/${encodeURIComponent(id)}`, { cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) throw new Error('전시를 불러오지 못했어요')
  return (await res.json()) as ExhibitDetail
}

/* 전시 삭제 (소유자) */
export async function deleteExhibit(id: string): Promise<void> {
  const res = await fetch(`/api/exhibit/${id}`, { method: 'DELETE' })
  if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.error ?? '삭제에 실패했어요') }
}

/* 전시 등록 → 새 전시 id */
export async function createExhibit(input: CreateExhibitInput): Promise<string> {
  const res = await fetch('/api/exhibit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error ?? '전시 등록에 실패했어요')
  return json.id as string
}

/* ---- 편집(소유자 전용) ---- */

export interface ExhibitManageImage { id: string; url: string }
export interface ExhibitPostOption { id: string; title: string; createdAt: string }
export interface ExhibitManage {
  id: string
  goodsItemId: string
  goodsName: string | null
  workName: string | null
  caption: string | null
  visibility: ExhibitVisibility
  sourcePostId: string | null
  images: ExhibitManageImage[]
  postOptions: ExhibitPostOption[]
}

/* 편집용 데이터(이미지 id 포함) */
export async function getExhibitManage(id: string): Promise<ExhibitManage | null> {
  const res = await fetch(`/api/exhibit/${encodeURIComponent(id)}/manage`, { cache: 'no-store' })
  if (res.status === 403 || res.status === 401 || res.status === 404) return null
  if (!res.ok) throw new Error('전시 정보를 불러오지 못했어요')
  return (await res.json()) as ExhibitManage
}

async function manage(id: string, payload: any): Promise<void> {
  const res = await fetch(`/api/exhibit/${encodeURIComponent(id)}/manage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  })
  if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.error ?? '처리에 실패했어요') }
}

/* 캡션·공개범위·원본 글 저장 */
export function updateExhibit(id: string, v: { caption: string | null; visibility: ExhibitVisibility; sourcePostId: string | null }): Promise<void> {
  return manage(id, { action: 'update', ...v })
}
/* 굿즈 이미지에서 사진 추가(서버 복사) */
export function addExhibitImages(id: string, imageIds: string[]): Promise<void> {
  return manage(id, { action: 'add', imageIds })
}
/* 사진 삭제(최소 1장 유지) */
export function removeExhibitImage(id: string, imageId: string): Promise<void> {
  return manage(id, { action: 'remove', imageId })
}
/* 사진 순서 변경 */
export function reorderExhibitImages(id: string, ordered: string[]): Promise<void> {
  return manage(id, { action: 'reorder', ordered })
}
/* 대표(커버) 지정 */
export function setExhibitCover(id: string, imageId: string): Promise<void> {
  return manage(id, { action: 'cover', imageId })
}
