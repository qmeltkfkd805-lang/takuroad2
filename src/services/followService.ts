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