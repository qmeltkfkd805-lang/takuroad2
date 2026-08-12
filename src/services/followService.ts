import { createClient } from '@/lib/supabase/client'

export interface FollowState {
  following: boolean
  notify: boolean
}

export async function getFollowState(followerId: string, followingId: string): Promise<FollowState> {
  const supabase = createClient()
  const { data } = await supabase
    .from('user_follows')
    .select('notify')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle()
  return { following: !!data, notify: (data as any)?.notify ?? false }
}

export async function follow(followerId: string, followingId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('user_follows')
    .insert({ follower_id: followerId, following_id: followingId, notify: true } as any)
  if (error) console.error('follow:', JSON.stringify(error))
  return !error
}

export async function unfollow(followerId: string, followingId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('user_follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
  return !error
}

export async function setFollowNotify(followerId: string, followingId: string, notify: boolean): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('user_follows')
    .update({ notify } as any)
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
  return !error
}

/** 팔로워·팔로잉 수 */
export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const supabase = createClient()
  const [a, b] = await Promise.all([
    supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
  ])
  return { followers: a.count ?? 0, following: b.count ?? 0 }
}

/** 내가 팔로우한 유저 id 목록 */
export async function getFollowingIds(userId: string): Promise<string[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', userId)
  return (data ?? []).map((r: any) => r.following_id)
}

/** 이 사람을 팔로우하면서 알림을 켠 사람들 (새 글 알림 보낼 대상) */
export async function getNotifyFollowerIds(authorId: string): Promise<string[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('user_follows')
    .select('follower_id')
    .eq('following_id', authorId)
    .eq('notify', true)
  return (data ?? []).map((r: any) => r.follower_id)
}

export interface FollowUser {
  id: string
  nickname: string
  avatarUrl: string | null
}

async function profilesByIds(ids: string[]): Promise<FollowUser[]> {
  if (ids.length === 0) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, nickname, avatar_url')
    .in('id', ids)
  const byId = new Map<string, any>((data ?? []).map((p: any) => [p.id, p]))
  // 팔로우한 순서(최근 우선)를 유지한다
  return ids
    .map(id => byId.get(id))
    .filter(Boolean)
    .map((p: any) => ({ id: p.id, nickname: p.nickname ?? '알 수 없음', avatarUrl: p.avatar_url ?? null }))
}

/** 나를 팔로우하는 사람들 (최근 팔로우 순) */
export async function getFollowers(userId: string): Promise<FollowUser[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('user_follows')
    .select('follower_id, created_at')
    .eq('following_id', userId)
    .order('created_at', { ascending: false })
  return profilesByIds((data ?? []).map((r: any) => r.follower_id))
}

/** 내가 팔로우하는 사람들 (최근 팔로우 순) */
export async function getFollowing(userId: string): Promise<FollowUser[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('user_follows')
    .select('following_id, created_at')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false })
  return profilesByIds((data ?? []).map((r: any) => r.following_id))
}

export interface FollowFeedItem {
  id: string
  kind: 'post' | 'route'
  title: string
  author: string
  href: string
  date: string
}

/** 팔로우 소식 — 내가 팔로우한 유저의 공개 커뮤니티 글 + 공개(공유된) 루트만.
 *  비공개 활동은 status/visibility/is_shared 필터로 애초에 제외된다. */
export async function getFollowFeed(userId: string, limit = 12): Promise<FollowFeedItem[]> {
  const ids = await getFollowingIds(userId)
  if (ids.length === 0) return []

  const supabase = createClient()
  const [postsRes, routesRes] = await Promise.all([
    supabase
      .from('community_posts')
      .select('id, title, created_at, profiles!community_posts_author_id_fkey ( nickname )')
      .in('author_id', ids)
      .eq('status', 'active')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('routes')
      .select('id, title, share_token, created_at, profiles!routes_user_id_fkey ( nickname )')
      .in('user_id', ids)
      .eq('is_shared', true)
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  const posts: FollowFeedItem[] = (postsRes.data ?? []).map((r: any) => ({
    id: `p_${r.id}`,
    kind: 'post',
    title: (r.title && String(r.title).trim()) || '커뮤니티 글',
    author: r.profiles?.nickname ?? '',
    href: `/community/${r.id}`,
    date: r.created_at ?? '',
  }))
  const routes: FollowFeedItem[] = (routesRes.data ?? []).map((r: any) => ({
    id: `r_${r.id}`,
    kind: 'route',
    title: (r.title && String(r.title).trim()) || '루트',
    author: r.profiles?.nickname ?? '',
    href: r.share_token ? `/route/${r.share_token}` : '#',
    date: r.created_at ?? '',
  }))

  return [...posts, ...routes]
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, limit)
}