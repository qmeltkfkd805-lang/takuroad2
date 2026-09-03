import { createClient } from '@/lib/supabase/client'
import {
  Board, CommunityPost, NewPost, PostSort, PostComment,
  ReportReason, NewAppeal, PostAppeal,
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
  const postId = data?.id ?? null

  // 팬아트 업로드 XP (비활동 소스 — 글당 1회)
  if (postId && input.board === 'fanart') {
    import('./expService')
      .then(({ addExpOnce, XP_RULES }) => addExpOnce(userId, XP_RULES.fanart.baseXp, 'fanart', 'post', postId))
      .catch(e => console.error('[팬아트 XP 실패]', e))
  }

  return postId
}

// ── 커뮤니티 게시판 목록 (board 기준, active) ──
export async function getPostsByBoard(board: Board, sort: PostSort = 'latest', userId?: string | null): Promise<CommunityPost[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('community_posts_visible')   // 차단 작성자 제외 뷰 (카나리)
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
    .from('community_posts_visible')
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
    .from('community_posts_visible')
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
    .from('community_posts_visible')
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
  const { data } = await supabase.from('community_posts_visible').select(SELECT).eq('id', id).maybeSingle()
  if (!data) return null
  const likedSet = await likedSetFor([id], userId)
  return toPost(data, likedSet)
}

// ── 이전/다음 글 (같은 게시판, active·공개·공지 제외, 작성일 기준) ──
export interface PostNeighbor { id: string; title: string | null; createdAt: string }
export async function getAdjacentPosts(current: { id: string; board: Board; createdAt: string }): Promise<{ prev: PostNeighbor | null; next: PostNeighbor | null }> {
  const supabase = createClient()
  const base = () => supabase
    .from('community_posts_visible')
    .select('id, title, created_at')
    .eq('board', current.board)
    .eq('status', 'active')
    .eq('visibility', 'public')
    .eq('is_notice', false)
  // 이전 글 = 더 과거(작성일이 현재보다 작은 것 중 가장 최신), 다음 글 = 더 최신(작성일이 현재보다 큰 것 중 가장 오래된)
  const [prevRes, nextRes] = await Promise.all([
    base().lt('created_at', current.createdAt).order('created_at', { ascending: false }).limit(1),
    base().gt('created_at', current.createdAt).order('created_at', { ascending: true }).limit(1),
  ])
  const map = (rows: any[] | null): PostNeighbor | null => {
    const r = rows?.[0]
    return r ? { id: r.id, title: r.title ?? null, createdAt: r.created_at } : null
  }
  return { prev: map(prevRes.data), next: map(nextRes.data) }
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
    .from('post_comments_visible')
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
  }
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

/* hidePost / restorePost 는 없앴다.
   관리자의 글 상태 변경은 신고 처리와 한 트랜잭션이어야 해서 서버 라우트
   /api/admin/post-report → admin_resolve_post_reports RPC 로 옮겼다(resolvePostReports).
   hidePost 는 PostUI 의 onHide 하나만 부르고 있었는데 그 onHide 가 JSX 어디에도
   렌더되지 않는 죽은 코드였다 — 작성자 메뉴는 수정/나만보기/삭제 셋뿐이다.
   migrations/community_posts_write_privileges.sql 이후로는 authenticated 에게
   status·hidden_* UPDATE 권한이 없어 실행되면 42501 이 난다. */
export async function deletePost(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('community_posts').delete().eq('id', id)
  return !error
}

/* 작성자 본인이 글을 지울 때 — 연결된 굿즈도 내 굿즈에서 함께 삭제.
   단 그 굿즈로 쓴 다른 자랑 글이 있거나 전시관에 걸려 있으면 굿즈는 남는다(keptGoods로 알려줌).
   판단·삭제는 서버 라우트에서. 라우트가 실패하면 글만 지우는 기존 경로로 폴백. */
export interface DeletePostResult { ok: boolean; deletedGoods: string[]; keptGoods: { id: string; reason: string }[] }
export async function deletePostWithGoods(id: string): Promise<DeletePostResult> {
  try {
    const res = await fetch(`/api/community/post/${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (res.ok) {
      const j = await res.json().catch(() => ({}))
      return { ok: true, deletedGoods: j?.deletedGoods ?? [], keptGoods: j?.keptGoods ?? [] }
    }
  } catch { /* 아래 폴백 */ }
  const ok = await deletePost(id)
  return { ok, deletedGoods: [], keptGoods: [] }
}

/* ── 관리자 > 게시글 신고 ─────────────────────────────────────────────
   예전 getReportedPosts 는 "모든 신고 + 숨김 글"을 한 덩어리로 돌려줬다.
   post_reports 에 처리 상태가 없어서 미처리와 처리 완료를 구분할 수 없었기 때문이다.
   migrations/post_report_review.sql 로 status(pending/dismissed/resolved)가 생겨
   대기열 / 처리 이력 / 숨김 글을 각각 따로 가져온다.

   조회는 관리자 RLS(post_reports_admin, cposts_admin)로 통과한다.
   실패는 삼키지 않고 throw 한다 — 화면에서 빈 목록과 조회 실패를 구분해야 한다.
   신고자(reporter_id)는 이 화면에서 쓰지 않으므로 아예 select 하지 않는다. */

export type PostReportStatus = 'pending' | 'dismissed' | 'resolved'

export interface PostReportRow {
  id: string
  postId: string
  reason: string
  content: string | null
  createdAt: string
  status: PostReportStatus
  reviewedAt: string | null
  /** 처리한 관리자. 계정이 지워지면 reviewed_by 가 null 이 되어 여기도 null 이다 */
  reviewer: { id: string; nickname: string } | null
}

export interface PostReportGroup {
  postId: string
  post: CommunityPost | null
  reports: PostReportRow[]   // 오래된 순
}

/* profiles 로 나가는 FK 가 reporter_id·reviewed_by 둘이라 이름으로 지정해야 한다.
   reporter 쪽은 조인하지 않는다(신고자 닉네임은 이 화면에 표시하지 않는다). */
const REPORT_SELECT = `
  id, post_id, reason, content, created_at, status, reviewed_at,
  reviewer:profiles!post_reports_reviewed_by_fkey ( id, nickname )
`

/* PostgREST 원본 행. Database 타입이 any 라 여기서 형태를 명시한다.
   임베드는 관계에 따라 객체 하나로도, 배열로도 온다 — 둘 다 받는다. */
interface RawReviewer { id: string; nickname: string }
interface RawReportRow {
  id: string
  post_id: string
  reason: string
  content: string | null
  created_at: string
  status: PostReportStatus
  reviewed_at: string | null
  reviewer: RawReviewer | RawReviewer[] | null
}

function toReportRow(r: RawReportRow): PostReportRow {
  const rev = Array.isArray(r.reviewer) ? r.reviewer[0] : r.reviewer
  return {
    id: r.id,
    postId: r.post_id,
    reason: r.reason,
    content: r.content ?? null,
    createdAt: r.created_at,
    status: r.status,
    reviewedAt: r.reviewed_at ?? null,
    reviewer: rev ? { id: rev.id, nickname: rev.nickname } : null,
  }
}

async function fetchPostReportGroups(statuses: PostReportStatus[]): Promise<PostReportGroup[]> {
  const supabase = createClient()
  const { data: reps, error } = await supabase
    .from('post_reports')
    .select(REPORT_SELECT)
    .in('status', statuses)
    .order('created_at', { ascending: true })
  if (error) throw error

  const rows = (reps ?? []).map(toReportRow)
  if (rows.length === 0) return []

  // 글 본문은 한 번에 가져와 그룹에 붙인다 (신고마다 중복으로 받지 않는다)
  const ids = Array.from(new Set(rows.map(r => r.postId)))
  const { data: posts, error: postError } = await supabase
    .from('community_posts').select(SELECT).in('id', ids)
  if (postError) throw postError
  const byId = new Map<string, CommunityPost>()
  for (const p of posts ?? []) byId.set(p.id, toPost(p, new Set()))

  const map = new Map<string, PostReportGroup>()
  for (const r of rows) {
    const g = map.get(r.postId)
    if (g) g.reports.push(r)
    else map.set(r.postId, { postId: r.postId, post: byId.get(r.postId) ?? null, reports: [r] })
  }
  return Array.from(map.values())
}

/** 미처리 신고 (대기열) */
export function getPendingPostReports(): Promise<PostReportGroup[]> {
  return fetchPostReportGroups(['pending'])
}
/** 처리 이력 — 반려(dismissed) + 조치 완료(resolved) */
export function getReviewedPostReports(): Promise<PostReportGroup[]> {
  return fetchPostReportGroups(['dismissed', 'resolved'])
}

/** 숨김 처리된 글. 신고 없이 숨겨진 글(자동 숨김·작성자 숨김)도 여기 잡힌다 */
export async function getHiddenPosts(): Promise<CommunityPost[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('community_posts').select(SELECT)
    .eq('status', 'hidden')
    .order('hidden_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(p => toPost(p, new Set()))
}

export type PostReportAction = 'dismiss' | 'hide_and_resolve' | 'restore'

/* 글 상태 변경과 신고 처리는 원자적이어야 한다.
   클라이언트에서 두 번 UPDATE 하지 않고, 서버 라우트가 admin_resolve_post_reports
   RPC 를 부른다(plpgsql 함수 본문 = 단일 트랜잭션).
   보내는 것은 postId 와 동작뿐이다 — 처리할 신고 목록·처리자·처리 시각은
   서버가 정한다. */
export async function resolvePostReports(
  postId: string, action: PostReportAction,
): Promise<{ ok: boolean; error?: string; reports?: number }> {
  try {
    const res = await fetch('/api/admin/post-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, action }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: json?.error ?? '처리에 실패했어요' }
    return { ok: true, reports: typeof json?.reports === 'number' ? json.reports : undefined }
  } catch (e) {
    console.error('[게시글 신고 처리 실패]', e)
    return { ok: false, error: '네트워크 오류로 처리하지 못했어요' }
  }
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
export type SearchField = 'title' | 'both' | 'author' | 'tag' | 'comment'
const NO_MATCH_ID = '00000000-0000-0000-0000-000000000000'
export interface PostQuery {
  mineOnly?: boolean
  search?: string    // 검색어
  field?: SearchField // 검색 범위 (기본 both = 제목+내용)
  tagId?: string     // 작품(만화) 필터
}
export async function getPosts(
  board: Board | 'all', sort: PostSort = 'latest', userId?: string | null, opts?: PostQuery,
): Promise<CommunityPost[]> {
  const supabase = createClient()
  let q = supabase.from('community_posts_visible').select(SELECT).eq('status', 'active').eq('visibility', 'public').eq('is_notice', false)
  if (board !== 'all') q = q.eq('board', board)
  if (opts?.mineOnly && userId) q = q.eq('author_id', userId)
  if (opts?.tagId) q = q.contains('tag_ids', [opts.tagId])
  if (opts?.search && opts.search.trim()) {
    const kw = opts.search.trim().replace(/[%,]/g, '')
    const field = opts.field ?? 'both'
    const parts: string[] = []
    if (field === 'title' || field === 'both') parts.push(`title.ilike.%${kw}%`)
    if (field === 'both') parts.push(`content.ilike.%${kw}%`)
    if (field === 'author') {
      const { data: authors } = await supabase.from('profiles').select('id').ilike('nickname', `%${kw}%`).limit(50)
      const ids = (authors ?? []).map((a: any) => a.id)
      parts.push(ids.length ? `author_id.in.(${ids.join(',')})` : `id.eq.${NO_MATCH_ID}`)
    }
    if (field === 'tag') {
      const { data: tg } = await supabase.from('tags').select('id').ilike('name', `%${kw}%`).limit(50)
      const ids = (tg ?? []).map((a: any) => a.id)
      if (ids.length) q = q.overlaps('tag_ids', ids); else q = q.eq('id', NO_MATCH_ID)
    }
    if (field === 'comment') {
      const { data: cmts } = await supabase.from('post_comments').select('post_id').eq('status', 'active').ilike('content', `%${kw}%`).limit(300)
      const pids = Array.from(new Set((cmts ?? []).map((c: any) => c.post_id).filter(Boolean)))
      parts.push(pids.length ? `id.in.(${pids.join(',')})` : `id.eq.${NO_MATCH_ID}`)
    }
    if (parts.length) q = q.or(parts.join(','))
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
  let q = supabase.from('community_posts_visible').select(SELECT).eq('status', 'active').eq('visibility', 'public').eq('is_notice', true)
  if (board && board !== 'all') q = q.or(`board.eq.${board},notice_all.eq.true`)
  else q = q.eq('notice_all', true)
  const { data, error } = await q.order('notice_all', { ascending: false }).order('created_at', { ascending: false })
  if (error) console.error('[getNotices]', error.message, error.details ?? '', error.hint ?? '')
  return (data ?? []).map((r: any) => toPost(r, new Set()))
}

/* setNotice(공지 지정/해제)도 없앴다. 호출부가 하나도 없었다.
   공지는 PostWritePage 의 작성 시점 체크박스(isAdmin && isNotice)로만 지정되고
   그건 INSERT 다. is_notice 의 UPDATE 권한은 회수됐다. */

// ── 인기 게시글 (좋아요 최다) ──
export async function getPopularPosts(limit = 5): Promise<CommunityPost[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('community_posts_visible').select(SELECT).eq('status', 'active').eq('visibility', 'public').eq('is_notice', false)
    .order('like_count', { ascending: false }).order('created_at', { ascending: false }).limit(limit)
  return (data ?? []).map((r: any) => toPost(r, new Set()))
}


// ── 기간별 인기 게시글 (점수 = 좋아요×3 + 댓글×2 + 조회×0.1) ──
export async function getPopularPostsInWindow(days: number, limit: number): Promise<CommunityPost[]> {
  const supabase = createClient()
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const { data } = await supabase
    .from('community_posts_visible').select(SELECT)
    .eq('status', 'active').eq('visibility', 'public').eq('is_notice', false)
    .gte('created_at', since)
    .order('like_count', { ascending: false }).limit(200)
  const rows = (data ?? []).map((r: any) => toPost(r, new Set()))
  const score = (p: CommunityPost) => p.likeCount * 3 + p.commentCount * 2 + p.viewCount * 0.1
  return rows.filter(p => score(p) > 0).sort((a, b) => score(b) - score(a)).slice(0, limit)
}

// ── 게시판별 글 수 (바로가기) ──
export async function getBoardCounts(): Promise<Record<string, number>> {
  const supabase = createClient()
  const { data } = await supabase
    .from('community_posts').select('board')
    .eq('status', 'active').eq('visibility', 'public').eq('is_notice', false)
  const m: Record<string, number> = {}
  for (const r of (data ?? []) as any[]) { if (r.board) m[r.board] = (m[r.board] ?? 0) + 1 }
  return m
}

// ── 내 활동 카운트 (작성 글·작성 댓글) ──
export async function getMyActivityCounts(userId: string): Promise<{ posts: number; comments: number }> {
  const supabase = createClient()
  const [p, c] = await Promise.all([
    supabase.from('community_posts').select('id', { count: 'exact', head: true }).eq('author_id', userId).eq('status', 'active'),
    supabase.from('post_comments').select('id', { count: 'exact', head: true }).eq('author_id', userId).eq('status', 'active'),
  ])
  return { posts: p.count ?? 0, comments: c.count ?? 0 }
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
export async function getTrendingTags(limit = 10): Promise<TrendingTag[]> {
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
