import { createClient } from '@/lib/supabase/client'
import { FanArt, FanArtSort, NewFanArt, ReportReason, NewAppeal, ReportedFanArt, FanArtAppeal } from '@/types/fan-art'

const SELECT = `
  id, tag_id, author_id, title, description, image_url,
  show_in_gallery, status, view_count, like_count, hidden_reason, hidden_at, hidden_by, created_at,
  tags ( id, name, slug ),
  profiles ( id, nickname, avatar_url )
`

function toFanArt(raw: any, likedSet: Set<string>): FanArt {
  return {
    id: raw.id,
    tagId: raw.tag_id,
    work: raw.tags ? { id: raw.tags.id, name: raw.tags.name, slug: raw.tags.slug ?? null } : null,
    author: raw.profiles
      ? { id: raw.profiles.id, nickname: raw.profiles.nickname, avatarUrl: raw.profiles.avatar_url ?? null }
      : null,
    title: raw.title ?? null,
    description: raw.description ?? null,
    imageUrl: raw.image_url,
    showInGallery: raw.show_in_gallery,
    status: raw.status,
    viewCount: raw.view_count ?? 0,
    likeCount: raw.like_count ?? 0,
    likedByMe: likedSet.has(raw.id),
    hiddenReason: raw.hidden_reason ?? null,
    hiddenBy: raw.hidden_by ?? null,
    createdAt: raw.created_at,
  }
}

// 반환된 팬아트들 중 내가 좋아요한 id 집합
async function likedSetFor(ids: string[], userId?: string | null): Promise<Set<string>> {
  if (!userId || ids.length === 0) return new Set()
  const supabase = createClient()
  const { data } = await supabase
    .from('fan_art_likes')
    .select('fan_art_id')
    .eq('user_id', userId)
    .in('fan_art_id', ids)
  return new Set((data ?? []).map((r: any) => r.fan_art_id))
}

// ── 업로드 ──
export async function uploadFanArtImage(file: File, userId: string): Promise<string | null> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `fanart/${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('shop-images').upload(path, file)
  if (error) { console.error('[팬아트 이미지 업로드 실패]', error.message); return null }
  const { data } = supabase.storage.from('shop-images').getPublicUrl(path)
  return data.publicUrl
}

// ── 생성 (단일 글) ──
export async function createFanArt(userId: string, input: NewFanArt): Promise<string | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fan_arts')
    .insert({
      tag_id: input.tagId,
      author_id: userId,
      title: input.title?.trim() || null,
      description: input.description?.trim() || null,
      image_url: input.imageUrl,
      show_in_gallery: input.showInGallery,
    } as any)
    .select('id')
    .single()
  if (error) { console.error('[팬아트 등록 실패]', error.message, error.code); return null }
  return data?.id ?? null
}

// ── 작품 갤러리 목록 (show_in_gallery = true, active) ──
export async function getWorkGalleryFanArts(
  tagId: string,
  sort: FanArtSort = 'popular',
  userId?: string | null,
): Promise<FanArt[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('fan_arts')
    .select(SELECT)
    .eq('tag_id', tagId)
    .eq('status', 'active')
    .eq('show_in_gallery', true)
    .order(sort === 'popular' ? 'like_count' : 'created_at', { ascending: false })
  const rows = data ?? []
  const likedSet = await likedSetFor(rows.map((r: any) => r.id), userId)
  return rows.map((r: any) => toFanArt(r, likedSet))
}

// ── 대표 팬아트 (해당 작품 갤러리에서 좋아요 최다 1개) ──
export async function getRepresentativeFanArt(tagId: string, userId?: string | null): Promise<FanArt | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('fan_arts')
    .select(SELECT)
    .eq('tag_id', tagId)
    .eq('status', 'active')
    .eq('show_in_gallery', true)
    .order('like_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const likedSet = await likedSetFor([(data as any).id], userId)
  return toFanArt(data, likedSet)
}

// ── 커뮤니티 목록 (전체 active, show_in_gallery 무관) ──
export async function getCommunityFanArts(
  sort: FanArtSort = 'latest',
  userId?: string | null,
): Promise<FanArt[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('fan_arts')
    .select(SELECT)
    .eq('status', 'active')
    .order(sort === 'popular' ? 'like_count' : 'created_at', { ascending: false })
  const rows = data ?? []
  const likedSet = await likedSetFor(rows.map((r: any) => r.id), userId)
  return rows.map((r: any) => toFanArt(r, likedSet))
}

// ── 단일 조회 (상세/모달) ──
export async function getFanArt(id: string, userId?: string | null): Promise<FanArt | null> {
  const supabase = createClient()
  const { data } = await supabase.from('fan_arts').select(SELECT).eq('id', id).maybeSingle()
  if (!data) return null
  const likedSet = await likedSetFor([id], userId)
  return toFanArt(data, likedSet)
}

// ── 좋아요 토글 (한 팬아트당 1회, 취소 가능) ──
export async function toggleFanArtLike(fanArtId: string, userId: string): Promise<boolean> {
  const supabase = createClient()
  const { data: existing } = await supabase
    .from('fan_art_likes')
    .select('fan_art_id')
    .eq('fan_art_id', fanArtId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    await supabase.from('fan_art_likes').delete().eq('fan_art_id', fanArtId).eq('user_id', userId)
    return false // 이제 안 눌린 상태
  }
  await supabase.from('fan_art_likes').insert({ fan_art_id: fanArtId, user_id: userId } as any)
  return true // 이제 눌린 상태
}

// ── 조회수 증가 ──
export async function incrementFanArtView(fanArtId: string): Promise<void> {
  const supabase = createClient()
  await supabase.rpc('increment_fan_art_view', { art_id: fanArtId })
}

// ── 관리자: 숨김 / 복원 / 삭제 ──
export async function hideFanArt(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('fan_arts').update({ status: 'hidden' } as any).eq('id', id)
  return !error
}
export async function restoreFanArt(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('fan_arts').update({ status: 'active' } as any).eq('id', id)
  return !error
}
export async function deleteFanArt(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('fan_arts').delete().eq('id', id)
  return !error
}

// ── 신고 (계정당 게시글당 1회) ──
export async function reportFanArt(
  fanArtId: string, userId: string, reason: ReportReason, content?: string,
): Promise<'ok' | 'duplicate' | 'error'> {
  const supabase = createClient()
  const { error } = await supabase.from('fan_art_reports').insert({
    fan_art_id: fanArtId, reporter_id: userId, reason, content: content?.trim() || null,
  } as any)
  if (error) {
    if ((error as any).code === '23505') return 'duplicate'
    console.error('[팬아트 신고 실패]', error.message)
    return 'error'
  }
  return 'ok'
}

// ── 내 팬아트 (숨김 포함, 마이페이지) ──
export async function getMyFanArts(userId: string): Promise<FanArt[]> {
  const supabase = createClient()
  const { data } = await supabase.from('fan_arts').select(SELECT).eq('author_id', userId).order('created_at', { ascending: false })
  const rows = data ?? []
  const likedSet = await likedSetFor(rows.map((r: any) => r.id), userId)
  return rows.map((r: any) => toFanArt(r, likedSet))
}

// ── 이의제기 ──
export async function uploadAppealImage(file: File, userId: string): Promise<string | null> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `fanart-appeal/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`
  const { error } = await supabase.storage.from('shop-images').upload(path, file)
  if (error) { console.error('[이의제기 이미지 업로드 실패]', error.message); return null }
  const { data } = supabase.storage.from('shop-images').getPublicUrl(path)
  return data.publicUrl
}

export async function submitAppeal(fanArtId: string, userId: string, data: NewAppeal): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('fan_art_appeals').insert({
    fan_art_id: fanArtId, author_id: userId,
    message: data.message?.trim() || null,
    original_url: data.originalUrl?.trim() || null,
    sns_links: (data.snsLinks ?? []).filter(Boolean),
    proof_images: data.proofImages ?? [],
  } as any)
  if (error) { console.error('[이의제기 실패]', error.message); return false }
  return true
}

// ── 관리자: 신고된/숨김된 팬아트 목록 ──
export async function getReportedFanArts(): Promise<ReportedFanArt[]> {
  const supabase = createClient()
  const { data: reps } = await supabase
    .from('fan_art_reports')
    .select('fan_art_id, reason, content, created_at')
    .order('created_at', { ascending: false })
  const byArt = new Map<string, any[]>()
  for (const r of reps ?? []) {
    const arr = byArt.get(r.fan_art_id) ?? []
    arr.push(r); byArt.set(r.fan_art_id, arr)
  }
  const { data: hiddenArts } = await supabase.from('fan_arts').select('id').eq('status', 'hidden')
  for (const h of hiddenArts ?? []) if (!byArt.has(h.id)) byArt.set(h.id, [])

  const ids = Array.from(byArt.keys())
  if (ids.length === 0) return []
  const { data: arts } = await supabase.from('fan_arts').select(SELECT).in('id', ids)
  const result: ReportedFanArt[] = (arts ?? []).map((a: any) => {
    const rs = byArt.get(a.id) ?? []
    const reasonCounts: Record<string, number> = {}
    for (const r of rs) reasonCounts[r.reason] = (reasonCounts[r.reason] ?? 0) + 1
    return {
      art: toFanArt(a, new Set()),
      reportCount: rs.length,
      reasonCounts,
      reports: rs.map((r: any) => ({ reason: r.reason, content: r.content ?? null, createdAt: r.created_at })),
    }
  })
  result.sort((x, y) => y.reportCount - x.reportCount)
  return result
}

// ── 관리자: 특정 팬아트의 이의제기 목록 ──
export async function getFanArtAppeals(fanArtId: string): Promise<FanArtAppeal[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('fan_art_appeals')
    .select('id, message, original_url, sns_links, proof_images, status, created_at')
    .eq('fan_art_id', fanArtId)
    .order('created_at', { ascending: false })
  return (data ?? []).map((r: any) => ({
    id: r.id, message: r.message ?? null, originalUrl: r.original_url ?? null,
    snsLinks: r.sns_links ?? [], proofImages: r.proof_images ?? [], status: r.status, createdAt: r.created_at,
  }))
}
