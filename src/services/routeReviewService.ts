import { createClient } from '@/lib/supabase/client'
import { shrink } from './eventVisitPhotoService'

/* ============================================================
   루트 완주 후기 — 글 + 사진(최대 3장)
   - 완주한 사람만 쓴다(DB 정책: route_completions 에 내 행이 있어야 insert)
   - 완주할 때마다 1개씩(하루 1번 센 완주 횟수만큼), 각각 수정·삭제 가능
   - 사진: 공개 버킷 route-photos, 경로 {userId}/{routeId}/{uuid}.webp (브라우저에서 줄여 다시 그려서 위치정보 제거)
   - 루트 상세 > 후기, 연대기·공개 프로필 방문 기록의 "루트 완주"에 함께 보인다
   SQL: migrations/route_reviews.sql
   ============================================================ */

const BUCKET = 'route-photos'
export const MAX_ROUTE_PHOTOS = 3
export const MAX_REVIEW_LEN = 1000

export interface RouteReviewPhoto { id: string; path: string; url: string }
export interface RouteReview {
  id: string
  routeId: string
  userId: string
  nickname: string
  avatarUrl: string | null
  content: string
  createdAt: string
  updatedAt: string
  photos: RouteReviewPhoto[]
}

function uuid(): string {
  try { return crypto.randomUUID() } catch { return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}` }
}

function publicUrl(path: string): string {
  return createClient().storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

const SELECT = 'id, route_id, user_id, content, created_at, updated_at, route_review_photos ( id, object_path, sort, created_at )'

function toReview(r: any, prof?: { nickname?: string | null; avatar_url?: string | null }): RouteReview {
  const photos = [...(r.route_review_photos ?? [])]
    .sort((a: any, b: any) => (a.sort - b.sort) || String(a.created_at).localeCompare(String(b.created_at)))
    .map((p: any) => ({ id: p.id, path: p.object_path, url: publicUrl(p.object_path) }))
  return {
    id: r.id, routeId: r.route_id, userId: r.user_id,
    nickname: prof?.nickname ?? '알 수 없음', avatarUrl: prof?.avatar_url ?? null,
    content: r.content ?? '', createdAt: r.created_at, updatedAt: r.updated_at, photos,
  }
}

/** 이 루트의 후기 (최신순). 표가 아직 없으면(SQL 적용 전) 빈 목록 */
export async function getRouteReviews(routeId: string): Promise<RouteReview[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from('route_reviews').select(SELECT)
    .eq('route_id', routeId).order('created_at', { ascending: false }).limit(50)
  if (error || !data?.length) return []
  const ids = [...new Set((data as any[]).map(r => r.user_id))]
  const { data: profs } = await supabase.from('profiles').select('id, nickname, avatar_url').in('id', ids)
  const byId = new Map(((profs ?? []) as any[]).map(p => [p.id, p]))
  return (data as any[]).map(r => toReview(r, byId.get(r.user_id)))
}

export async function getMyRouteReview(routeId: string, userId: string): Promise<RouteReview | null> {
  const supabase = createClient()
  const { data } = await supabase.from('route_reviews').select(SELECT)
    .eq('route_id', routeId).eq('user_id', userId).maybeSingle()
  return data ? toReview(data) : null
}

/**
 * 후기 저장 — 글 저장(처음이면 만들고, 있으면 고침) → 뺀 사진 지우기 → 새 사진 올리기.
 * 사진 행 추가가 실패하면 방금 올린 파일을 지운다.
 */
export async function saveRouteReview(
  routeId: string, userId: string, content: string,
  opts: { existingId?: string | null; removePhotos?: RouteReviewPhoto[]; newFiles?: File[] } = {},
): Promise<string> {
  const supabase = createClient()
  const text = content.trim().slice(0, MAX_REVIEW_LEN)
  let reviewId = opts.existingId ?? null

  if (reviewId) {
    const { error } = await supabase.from('route_reviews')
      .update({ content: text, updated_at: new Date().toISOString() } as any).eq('id', reviewId).eq('user_id', userId)
    if (error) throw new Error('후기를 저장하지 못했어요')
  } else {
    const { data, error } = await supabase.from('route_reviews')
      .insert({ route_id: routeId, user_id: userId, content: text } as any).select('id').single()
    if (error || !data) {
      throw new Error(error?.code === '42501' || error?.message?.includes('row-level')
        ? '완주할 때마다 후기를 1개씩 남길 수 있어요'
        : '후기를 저장하지 못했어요')
    }
    reviewId = (data as any).id as string
  }

  // 뺀 사진
  const rm = opts.removePhotos ?? []
  if (rm.length) {
    await supabase.from('route_review_photos').delete().in('id', rm.map(p => p.id)).eq('user_id', userId)
    await supabase.storage.from(BUCKET).remove(rm.map(p => p.path)).catch(() => {})
  }

  // 새 사진
  const files = opts.newFiles ?? []
  for (const [i, f] of files.entries()) {
    const { blob, ext, type } = await shrink(f)
    const path = `${userId}/${routeId}/${uuid()}.${ext}`
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: type, upsert: false })
    if (upErr) throw new Error('사진을 올리지 못했어요')
    const { error: rowErr } = await supabase.from('route_review_photos')
      .insert({ review_id: reviewId, user_id: userId, object_path: path, sort: Math.floor(Date.now() / 1000) + i } as any)
    if (rowErr) {
      await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
      throw new Error(rowErr.message?.includes('3장') ? `사진은 후기당 ${MAX_ROUTE_PHOTOS}장까지 남길 수 있어요` : '사진을 저장하지 못했어요')
    }
  }
  return reviewId
}

/** 후기 삭제 — 사진 파일 먼저 지우고 후기 행 삭제(사진 행은 함께 사라짐) */
export async function deleteRouteReview(review: RouteReview, userId: string): Promise<boolean> {
  const supabase = createClient()
  if (review.photos.length) await supabase.storage.from(BUCKET).remove(review.photos.map(p => p.path)).catch(() => {})
  const { error } = await supabase.from('route_reviews').delete().eq('id', review.id).eq('user_id', userId)
  return !error
}

/** 연대기용 — 내가 완주 후기에 남긴 사진 { routeId: [url, …] } */
export async function getMyRouteReviewPhotoUrls(userId: string, routeIds: string[]): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {}
  const ids = [...new Set(routeIds.filter(Boolean))]
  if (!ids.length) return out
  const supabase = createClient()
  const { data, error } = await supabase.from('route_reviews')
    .select('route_id, route_review_photos ( object_path, sort, created_at )')
    .eq('user_id', userId).in('route_id', ids).order('created_at', { ascending: true })
  if (error || !data) return out
  for (const r of data as any[]) {
    const list = [...(r.route_review_photos ?? [])]
      .sort((a: any, b: any) => (a.sort - b.sort) || String(a.created_at).localeCompare(String(b.created_at)))
      .map((p: any) => publicUrl(p.object_path))
    if (list.length) out[r.route_id] = [...(out[r.route_id] ?? []), ...list]   // 완주 후기가 여러 개면 사진을 이어 붙인다
  }
  return out
}
