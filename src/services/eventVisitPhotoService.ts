import { createClient } from '@/lib/supabase/client'

/* ============================================================
   이벤트 "다녀왔어요" 사진 — 특전·음식·굿즈 사진을 연대기에 함께 남긴다.

   - 공개: 내 공개 프로필 > 방문 기록에도 보인다 (event_visit_photos.visibility 기본 'public')
     파일은 비공개 버킷 visit-photos. 남에게는 서버가 권한 확인 후 서명 URL 로만 준다
     (SQL: migrations/event_visit_photo_visibility.sql)
   - 경로: {userId}/{eventId}/{uuid}.{ext}  (저장소 정책이 첫 폴더 = 본인 id 를 강제)
   - 목록은 event_visit_photos 표 (RLS 본인만, "다녀왔어요" 한 이벤트만, 이벤트당 3장)
   - 사진은 브라우저에서 줄이고 다시 그려서 올린다 → 위치정보(EXIF)가 빠진다
   SQL: migrations/event_visit_photos.sql
   ============================================================ */

const BUCKET = 'visit-photos'
export const MAX_VISIT_PHOTOS = 3

function uuid(): string {
  try { return crypto.randomUUID() } catch { return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}` }
}

/* 긴 변 1600px 로 줄여 다시 그린다. (루트 후기 사진도 같이 쓴다 — routeReviewService) webp 를 못 만드는 브라우저(일부 사파리)는 jpeg 로. */
export async function shrink(file: File): Promise<{ blob: Blob; ext: string; type: string }> {
  const bitmap = await createImageBitmap(file)
  let { width, height } = bitmap
  const max = 1600
  if (width > max || height > max) {
    const s = max / Math.max(width, height)
    width = Math.round(width * s); height = Math.round(height * s)
  }
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('사진을 처리하지 못했어요')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()
  const toBlob = (type: string, q: number) => new Promise<Blob | null>(res => canvas.toBlob(b => res(b), type, q))
  const webp = await toBlob('image/webp', 0.85)
  if (webp && webp.type === 'image/webp') return { blob: webp, ext: 'webp', type: 'image/webp' }
  const jpg = await toBlob('image/jpeg', 0.85)
  if (!jpg) throw new Error('사진을 처리하지 못했어요')
  return { blob: jpg, ext: 'jpg', type: 'image/jpeg' }
}

/** 이 이벤트에 내가 올린 사진 수 */
export async function getMyVisitPhotoCount(userId: string, eventId: string): Promise<number> {
  const supabase = createClient()
  const { count, error } = await supabase
    .from('event_visit_photos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('event_id', eventId)
  if (error) return 0
  return count ?? 0
}

/**
 * 사진 올리기 — 남은 칸(3장 - 이미 올린 수)만큼만 올린다.
 * 파일 올리기 → 목록 행 추가 순서. 행 추가가 실패하면 방금 올린 파일을 지운다.
 * 반환: 실제로 저장된 장수
 */
export async function uploadVisitPhotos(userId: string, eventId: string, files: File[]): Promise<number> {
  const supabase = createClient()
  const already = await getMyVisitPhotoCount(userId, eventId)
  const room = Math.max(0, MAX_VISIT_PHOTOS - already)
  const picked = files.slice(0, room)
  let saved = 0
  for (const f of picked) {
    const { blob, ext, type } = await shrink(f)
    const path = `${userId}/${eventId}/${uuid()}.${ext}`
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: type, upsert: false })
    if (upErr) throw new Error('사진을 올리지 못했어요')
    // 공개 여부는 DB 기본값(public)을 따른다
    const { error: rowErr } = await supabase.from('event_visit_photos').insert({ user_id: userId, event_id: eventId, object_path: path } as any)
    if (rowErr) {
      await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
      throw new Error(rowErr.message?.includes('3장') ? '사진은 이벤트당 3장까지 남길 수 있어요' : '사진을 저장하지 못했어요')
    }
    saved++
  }
  return saved
}

/**
 * 연대기용 — 여러 이벤트의 내 사진 서명 URL (1시간). { eventId: [url, …] }
 * 표나 버킷이 아직 없으면(SQL 적용 전) 조용히 빈 결과.
 */
export async function getMyVisitPhotoUrls(userId: string, eventIds: string[]): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {}
  const ids = [...new Set(eventIds.filter(Boolean))]
  if (!ids.length) return out
  const supabase = createClient()
  const { data, error } = await supabase
    .from('event_visit_photos')
    .select('event_id, object_path, created_at')
    .eq('user_id', userId)
    .in('event_id', ids)
    .order('created_at', { ascending: true })
  if (error || !data?.length) return out
  const rows = data as { event_id: string; object_path: string }[]
  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(rows.map(r => r.object_path), 3600)
  const urlByPath = new Map<string, string>()
  for (const s of signed ?? []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl)
  for (const r of rows) {
    const u = urlByPath.get(r.object_path)
    if (u) (out[r.event_id] ??= []).push(u)
  }
  return out
}
