import { createClient } from '@/lib/supabase/client'
import {
  Board, CommunityPost, NewPost, PostSort, PostComment,
  ReportReason, NewAppeal, ReportedPost, PostAppeal,
  CommunityStats, TrendingTag,
} from '@/types/community-post'

const SELECT = `
  id, board, tag_id, tag_ids, author_id, title, content, images,
  show_on_work, is_notice, is_spoiler, flair, visibility, status, hidden_reason, hidden_at, hidden_by,
  view_count, like_count, comment_count, created_at,
  tags ( id, name, slug ),
  profiles!community_posts_author_id_fkey ( id, nickname, avatar_url )
`

function toPost(raw: any, likedSet: Set<string>): CommunityPost {
  return {
    id: raw.id,
    board: raw.board,
    tagId: raw.tag_id ?? null,
    work: raw.tags ? { id: raw.tags.id, name: raw.tags.name, slug: raw.tags.slug ?? null } : null,
    author: raw.profiles
      ? { id: raw.profiles.id, nickname: raw.profiles.nickname, avatarUrl: raw.profiles.avatar_url ?? null }
      : null,
    title: raw.title ?? null,
    content: raw.content ?? null,
    images: raw.images ?? [],
    showOnWork: raw.show_on_work,
    isNotice: raw.is_notice ?? false,
    isSpoiler: raw.is_spoiler ?? false,
    tagIds: raw.tag_ids ?? [],
    flair: raw.flair ?? null,
    visibility: raw.visibility ?? 'public',
    status: raw.status,
    hiddenReason: raw.hidden_reason ?? null,
    hiddenBy: raw.hidden_by ?? null,
    viewCount: raw.view_count ?? 0,
    likeCount: raw.like_count ?? 0,
    commentCount: raw.comment_count ?? 0,
    likedByMe: likedSet.has(raw.id),
    createdAt: raw.created_at,
  }
}

async function likedSetFor(ids: string[], userId?: string | null): Promise<Set<string>> {
  if (!userId || ids.length === 0) return new Set()
  const supabase = createClient()
  const { data } = await supabase.from('post_likes').select('post_id').eq('user_id', userId).in('post_id', ids)
  return new Set((data ?? []).map((r: any) => r.post_id))
}

// ── 이미지 업로드 ──
export async function uploadPostImage(file: File, userId: string): Promise<string | null> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `community/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`
  const { error } = await supabase.storage.from('shop-images').upload(path, file)
  if (error) { console.error('[게시글 이미지 업로드 실패]', error.message); return null }
  const { data } = supabase.storage.from('shop-images').getPublicUrl(path)
  return data.publicUrl
}

// ── 생성 (단일 글) ──
export async function createPost(userId: string, input: NewPost): Promise<string | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('community_posts')
    .insert({
      board: input.board,
      tag_id: input.tagIds?.[0] ?? null,
      tag_ids: input.tagIds ?? [],
      author_id: userId,
      title: input.title?.trim() || null,
      content: input.content?.trim() || null,
      images: input.images ?? [],
      show_on_work: input.showOnWork,
      is_notice: input.isNotice ?? false,
      notice_all: input.noticeAll ?? false,
      is_spoiler: input.spoiler ?? false,
      flair: input.flair ?? null,
    } as any)
    .select('id')
    .single()
  if (error) { console.error('[게시글 등록 실패]', error.message, error.code); return null }
  return data?.id ?? null
}

// ── 커뮤니티 게시판 목록 (board 기준, active) ──
export async function getPostsByBoard(board: Board, sort: PostSort = 'latest', userId?: string | null): Promise<CommunityPost[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('community_posts')
    .select(SELECT)
    .eq('board', board)
    .eq('status', 'active')
    .order(sort === 'popular' ? 'like_count' : 'created_at', { ascending: false })
  const rows = data ?? []
  const likedSet = await likedSetFor(rows.map((r: any) => r.id), userId)
  return rows.map((r: any) => toPost(r, likedSet))
}

// ── 작품 상세 탭 (작품 + board, show_on_work, active) ──
export async function getWorkPosts(tagId: string, board: Board, sort: PostSort = 'popular', userId?: string | null): Promise<CommunityPost[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('community_posts')
    .select(SELECT)
    .contains('tag_ids', [tagId])
    .eq('board', board)
    .eq('status', 'active')
    .eq('show_on_work', true)
    .order(sort === 'popular' ? 'like_count' : 'created_at', { ascending: false })
  const rows = data ?? []
  const likedSet = await likedSetFor(rows.map((r: any) => r.id), userId)
  return rows.map((r: any) => toPost(r, likedSet))
}

// ── 작품 상세: 그 작품의 커뮤니티 글(전체 게시판, 공지 제외) 미리보기 ──
export async function getWorkAllPosts(tagId: string, userId?: string | null, limit = 6): Promise<CommunityPost[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('community_posts')
    .select(SELECT)
    .contains('tag_ids', [tagId])
    .eq('status', 'active')
    .eq('visibility', 'public')
    .eq('is_notice', false)
    .order('created_at', { ascending: false })
    .limit(limit)
  const rows = data ?? []
  const likedSet = await likedSetFor(rows.map((r: any) => r.id), userId)
  return rows.map((r: any) => toPost(r, likedSet))
}

// ── 대표 팬아트 (작품 팬아트 중 좋아요 최다 1개) ──
export async function getRepresentativeFanArt(tagId: string, userId?: string | null): Promise<CommunityPost | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('community_posts')
    .select(SELECT)
    .contains('tag_ids', [tagId])
    .eq('board', 'fanart')
    .eq('status', 'active')
    .eq('show_on_work', true)
    .order('like_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const likedSet = await likedSetFor([(data as any).id], userId)
  return toPost(data, likedSet)
}

// ── 단일 조회 ──
export async function getPost(id: string, userId?: string | null): Promise<CommunityPost | null> {
  const supabase = createClient()
  const { data } = await supabase.from('community_posts').select(SELECT).eq('id', id).maybeSingle()
  if (!data) return null
  const likedSet = await likedSetFor([id], userId)
  return toPost(data, likedSet)
}

// ── 내 글 (숨김 포함) ──
export async function getMyPosts(userId: string): Promise<CommunityPost[]> {
  const supabase = createClient()
  const { data } = await supabase.from('community_posts').select(SELECT).eq('author_id', userId).order('created_at', { ascending: false })
  const rows = data ?? []
  const likedSet = await likedSetFor(rows.map((r: any) => r.id), userId)
  return rows.map((r: any) => toPost(r, likedSet))
}

// ── 좋아요 토글 (1글 1회, 취소 가능) ──
export async function togglePostLike(postId: string, userId: string): Promise<boolean> {
  const supabase = createClient()
  const { data: existing } = await supabase
    .from('post_likes').select('post_id').eq('post_id', postId).eq('user_id', userId).maybeSingle()
  if (existing) {
    await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId)
    return false
  }
  await supabase.from('post_likes').insert({ post_id: postId, user_id: userId } as any)
  return true
}

// ── 조회수 ──
const _viewedThisSession = new Set<string>()
export async function incrementPostView(postId: string): Promise<void> {
  // 한 세션(페이지 로드) 안에서 같은 글은 1회만. 재로그인/새로고침하면 다시 집계됨
  if (_viewedThisSession.has(postId)) return
  _viewedThisSession.add(postId)
  const supabase = createClient()
  await supabase.rpc('increment_post_view', { post: postId })
}

// ── 댓글 ──
export async function getComments(postId: string, userId?: string | null): Promise<PostComment[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('post_comments')
    .select('id, content, created_at, parent_id, like_count, profiles!post_comments_author_id_fkey ( id, nickname, avatar_url )')
    .eq('post_id', postId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
  const rows = data ?? []
  let liked = new Set<string>()
  if (userId && rows.length) {
    const ids = rows.map((r: any) => r.id)
    const { data: ls } = await supabase.from('comment_likes').select('comment_id').eq('user_id', userId).in('comment_id', ids)
    liked = new Set((ls ?? []).map((l: any) => l.comment_id))
  }
  const map = new Map<string, PostComment>()
  for (const r of rows) { const pf: any = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles; map.set(r.id, {
    id: r.id, content: r.content, createdAt: r.created_at,
    parentId: r.parent_id ?? null, likeCount: r.like_count ?? 0, likedByMe: liked.has(r.id),
    author: pf ? { id: pf.id, nickname: pf.nickname, avatarUrl: pf.avatar_url ?? null } : null,
    replies: [],
  })
  const roots: PostComment[] = []
  for (const r of rows) {
    const c = map.get(r.id)!
    if (r.parent_id && map.has(r.parent_id)) map.get(r.parent_id)!.replies.push(c)
    else roots.push(c)
  }
  return roots
}
export async function addComment(postId: string, userId: string, content: string, parentId?: string | null): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('post_comments').insert({ post_id: postId, author_id: userId, content: content.trim(), parent_id: parentId ?? null } as any)
  return !error
}
export async function toggleCommentLike(commentId: string, userId: string): Promise<boolean> {
  const supabase = createClient()
  const { data: ex } = await supabase.from('comment_likes').select('comment_id').eq('comment_id', commentId).eq('user_id', userId).maybeSingle()
  if (ex) { await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', userId); return false }
  await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: userId } as any)
  return true
}
export async function deleteComment(commentId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('post_comments').delete().eq('id', commentId)
  return !error
}

// ── 신고 (계정당 게시글당 1회) ──
export async function reportPost(postId: string, userId: string, reason: ReportReason, content?: string): Promise<'ok' | 'duplicate' | 'error'> {
  const supabase = createClient()
  const { error } = await supabase.from('post_reports').insert({
    post_id: postId, reporter_id: userId, reason, content: content?.trim() || null,
  } as any)
  if (error) {
    if ((error as any).code === '23505') return 'duplicate'
    console.error('[게시글 신고 실패]', error.message)
    return 'error'
  }
  return 'ok'
}

// ── 이의제기 ──
export async function uploadAppealImage(file: File, userId: string): Promise<string | null> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `community-appeal/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`
  const { error } = await supabase.storage.from('shop-images').upload(path, file)
  if (error) { console.error('[이의제기 이미지 업로드 실패]', error.message); return null }
  const { data } = supabase.storage.from('shop-images').getPublicUrl(path)
  return data.publicUrl
}
export async function submitAppeal(postId: string, userId: string, data: NewAppeal): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('post_appeals').insert({
    post_id: postId, author_id: userId,
    message: data.message?.trim() || null,
    original_url: data.originalUrl?.trim() || null,
    sns_links: (data.snsLinks ?? []).filter(Boolean),
    proof_images: data.proofImages ?? [],
  } as any)
  if (error) { console.error('[이의제기 실패]', error.message); return false }
  return true
}

// ── 관리자 ──
export async function hidePost(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('community_posts').update({ status: 'hidden', hidden_by: 'admin', hidden_at: new Date().toISOString() } as any).eq('id', id)
  return !error
}
export async function restorePost(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('community_posts').update({ status: 'active' } as any).eq('id', id)
  return !error
}
export async function deletePost(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('community_posts').delete().eq('id', id)
  return !error
}

export async function getReportedPosts(): Promise<ReportedPost[]> {
  const supabase = createClient()
  const { data: reps } = await supabase.from('post_reports').select('post_id, reason, content, created_at').order('created_at', { ascending: false })
  const byPost = new Map<string, any[]>()
  for (const r of reps ?? []) {
    const arr = byPost.get(r.post_id) ?? []; arr.push(r); byPost.set(r.post_id, arr)
  }
  const { data: hiddenPosts } = await supabase.from('community_posts').select('id').eq('status', 'hidden')
  for (const h of hiddenPosts ?? []) if (!byPost.has(h.id)) byPost.set(h.id, [])

  const ids = Array.from(byPost.keys())
  if (ids.length === 0) return []
  const { data: posts } = await supabase.from('community_posts').select(SELECT).in('id', ids)
  const result: ReportedPost[] = (posts ?? []).map((p: any) => {
    const rs = byPost.get(p.id) ?? []
    const reasonCounts: Record<string, number> = {}
    for (const r of rs) reasonCounts[r.reason] = (reasonCounts[r.reason] ?? 0) + 1
    return {
      post: toPost(p, new Set()),
      reportCount: rs.length,
      reasonCounts,
      reports: rs.map((r: any) => ({ reason: r.reason, content: r.content ?? null, createdAt: r.created_at })),
    }
  })
  result.sort((x, y) => y.reportCount - x.reportCount)
  return result
}

export async function getPostAppeals(postId: string): Promise<PostAppeal[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('post_appeals')
    .select('id, message, original_url, sns_links, proof_images, status, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: false })
  return (data ?? []).map((r: any) => ({
    id: r.id, message: r.message ?? null, originalUrl: r.original_url ?? null,
    snsLinks: r.sns_links ?? [], proofImages: r.proof_images ?? [], status: r.status, createdAt: r.created_at,
  }))
}

// ── 커뮤니티 홈: 통합 목록 (전체/board + 내 글 필터) ──
export interface PostQuery {
  mineOnly?: boolean
  search?: string    // 제목/내용 검색
  tagId?: string     // 작품(만화) 필터
}
export async function getPosts(
  board: Board | 'all', sort: PostSort = 'latest', userId?: string | null, opts?: PostQuery,
): Promise<CommunityPost[]> {
  const supabase = createClient()
  let q = supabase.from('community_posts').select(SELECT).eq('status', 'active').eq('visibility', 'public').eq('is_notice', false)
  if (board !== 'all') q = q.eq('board', board)
  if (opts?.mineOnly && userId) q = q.eq('author_id', userId)
  if (opts?.tagId) q = q.contains('tag_ids', [opts.tagId])
  if (opts?.search && opts.search.trim()) {
    const kw = opts.search.trim().replace(/[%,]/g, '')
    // 작성자(닉네임)로도 검색
    const { data: authors } = await supabase.from('profiles').select('id').ilike('nickname', `%${kw}%`).limit(50)
    const ids = (authors ?? []).map((a: any) => a.id)
    const parts = [`title.ilike.%${kw}%`, `content.ilike.%${kw}%`]
    if (ids.length) parts.push(`author_id.in.(${ids.join(',')})`)
    q = q.or(parts.join(','))
  }
  const { data, error } = await q.order(sort === 'popular' ? 'like_count' : 'created_at', { ascending: false })
  if (error) console.error('[getPosts]', error.message, error.details ?? '', error.hint ?? '')
  const rows = data ?? []
  const likedSet = await likedSetFor(rows.map((r: any) => r.id), userId)
  return rows.map((r: any) => toPost(r, likedSet))
}

// 공지 (상단 고정)
export async function getNotices(board?: Board | 'all'): Promise<CommunityPost[]> {
  const supabase = createClient()
  let q = supabase.from('community_posts').select(SELECT).eq('status', 'active').eq('visibility', 'public').eq('is_notice', true)
  if (board && board !== 'all') q = q.or(`board.eq.${board},notice_all.eq.true`)
  else q = q.eq('notice_all', true)
  const { data, error } = await q.order('notice_all', { ascending: false }).order('created_at', { ascending: false })
  if (error) console.error('[getNotices]', error.message, error.details ?? '', error.hint ?? '')
  return (data ?? []).map((r: any) => toPost(r, new Set()))
}

// 관리자: 공지 지정/해제
export async function setNotice(id: string, isNotice: boolean): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('community_posts').update({ is_notice: isNotice } as any).eq('id', id)
  return !error
}

// ── 인기 게시글 (좋아요 최다) ──
export async function getPopularPosts(limit = 5): Promise<CommunityPost[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('community_posts').select(SELECT).eq('status', 'active').eq('visibility', 'public').eq('is_notice', false)
    .order('like_count', { ascending: false }).order('created_at', { ascending: false }).limit(limit)
  return (data ?? []).map((r: any) => toPost(r, new Set()))
}


// ── 커뮤니티 통계 ──
export async function getCommunityStats(): Promise<CommunityStats> {
  const supabase = createClient()
  const start = new Date(); start.setHours(0, 0, 0, 0); const iso = start.toISOString()
  const [total, today, comments] = await Promise.all([
    supabase.from('community_posts').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('community_posts').select('id', { count: 'exact', head: true }).eq('status', 'active').gte('created_at', iso),
    supabase.from('post_comments').select('id', { count: 'exact', head: true }).eq('status', 'active').gte('created_at', iso),
  ])
  return { totalPosts: total.count ?? 0, todayPosts: today.count ?? 0, todayComments: comments.count ?? 0 }
}

// ── 실시간 인기 태그 (최근 글에서 많이 태그된 작품) ──
export async function getTrendingTags(limit = 12): Promise<TrendingTag[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('community_posts').select('tag_id, tags ( id, name, slug )')
    .eq('status', 'active').not('tag_id', 'is', null)
    .order('created_at', { ascending: false }).limit(300)
  const map = new Map<string, TrendingTag>()
  for (const r of (data ?? []) as any[]) {
    if (!r.tags) continue
    const cur = map.get(r.tags.id) ?? { id: r.tags.id, name: r.tags.name, slug: r.tags.slug ?? null, count: 0 }
    cur.count++; map.set(r.tags.id, cur)
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, limit)
}

// ── 작품별 검색량 (search_logs.matched_tag_id 집계) ──
export async function getWorkSearchCounts(): Promise<Record<string, number>> {
  const supabase = createClient()
  const { data } = await supabase
    .from('search_logs')
    .select('matched_tag_id')
    .not('matched_tag_id', 'is', null)
    .limit(5000)
  const m: Record<string, number> = {}
  for (const r of (data ?? []) as any[]) {
    const id = r.matched_tag_id
    if (id) m[id] = (m[id] ?? 0) + 1
  }
  return m
}

// ── 작성자: 글 수정 ──
export async function updatePost(id: string, patch: {
  board?: Board; tagIds?: string[]; title?: string | null; content?: string | null; images?: string[]; showOnWork?: boolean; spoiler?: boolean; flair?: string | null
}): Promise<boolean> {
  const supabase = createClient()
  const upd: any = {}
  if (patch.board !== undefined) upd.board = patch.board
  if (patch.tagIds !== undefined) { upd.tag_ids = patch.tagIds; upd.tag_id = patch.tagIds[0] ?? null }
  if (patch.title !== undefined) upd.title = patch.title
  if (patch.content !== undefined) upd.content = patch.content
  if (patch.images !== undefined) upd.images = patch.images
  if (patch.showOnWork !== undefined) upd.show_on_work = patch.showOnWork
  if (patch.spoiler !== undefined) upd.is_spoiler = patch.spoiler
  if (patch.flair !== undefined) upd.flair = patch.flair
  const { error } = await supabase.from('community_posts').update(upd).eq('id', id)
  if (error) console.error('[updatePost]', error.message)
  return !error
}

// ── 작성자: 공개범위 (public | private=나만보기) ──
export async function setPostVisibility(id: string, visibility: 'public' | 'private'): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('community_posts').update({ visibility } as any).eq('id', id)
  if (error) console.error('[setPostVisibility]', error.message)
  return !error
}
