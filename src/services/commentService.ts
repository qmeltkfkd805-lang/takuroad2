import { createClient } from '@/lib/supabase/client'

export interface ReviewComment {
  id: string
  review_id: string
  user_id: string
  content: string
  created_at: string
  author: { id: string; nickname: string; avatar_url: string | null } | null
}

function toComment(raw: any): ReviewComment {
  return {
    id: raw.id,
    review_id: raw.review_id,
    user_id: raw.user_id,
    content: raw.content,
    created_at: raw.created_at,
    author: raw.profiles ? {
      id: raw.profiles.id,
      nickname: raw.profiles.nickname,
      avatar_url: raw.profiles.avatar_url,
    } : null,
  }
}

export async function getComments(reviewId: string): Promise<ReviewComment[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('review_comments')
    .select('id, review_id, user_id, content, created_at, profiles ( id, nickname, avatar_url )')
    .eq('review_id', reviewId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })

  if (error) return []
  return (data ?? []).map(toComment)
}

export async function createComment(reviewId: string, userId: string, content: string): Promise<ReviewComment | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('review_comments')
    .insert({ review_id: reviewId, user_id: userId, content } as any)
    .select('id, review_id, user_id, content, created_at, profiles ( id, nickname, avatar_url )')
    .single()

  if (error || !data) return null
  return toComment(data)
}

export async function deleteComment(commentId: string, userId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('review_comments')
    .update({ is_deleted: true } as any)
    .eq('id', commentId)
    .eq('user_id', userId)
  return !error
}

// 내가 쓴 댓글 전체 (마이페이지용)
export async function getMyComments(userId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('review_comments')
    .select(`
      id, content, created_at,
      reviews ( id, shop_id, shops ( name, slug ) )
    `)
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })

  if (error) return []
  return data ?? []
}