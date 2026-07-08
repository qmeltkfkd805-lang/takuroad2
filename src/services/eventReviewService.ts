import { createClient } from '@/lib/supabase/client'

export interface EventReview {
  id: string
  eventId: string
  userId: string
  stars: number
  content: string
  createdAt: string
  author: { id: string; nickname: string; avatarUrl: string | null } | null
}

export interface EventReviewSummary {
  count: number
  avg: number | null
}

// Supabase 조인 결과가 배열로 추론될 수 있어 방어한다
function toReview(raw: any): EventReview {
  const pf: any = Array.isArray(raw.profiles) ? raw.profiles[0] : raw.profiles
  return {
    id: raw.id,
    eventId: raw.event_id,
    userId: raw.user_id,
    stars: raw.stars,
    content: raw.content,
    createdAt: raw.created_at,
    author: pf ? { id: pf.id, nickname: pf.nickname, avatarUrl: pf.avatar_url ?? null } : null,
  }
}

export async function getEventReviews(eventId: string): Promise<EventReview[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('event_reviews')
    .select('id, event_id, user_id, stars, content, created_at, profiles ( id, nickname, avatar_url )')
    .eq('event_id', eventId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })

  if (error) return []
  return (data ?? []).map(toReview)
}

export async function getEventReviewSummary(eventId: string): Promise<EventReviewSummary> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('event_reviews')
    .select('stars')
    .eq('event_id', eventId)
    .eq('is_deleted', false)

  if (error || !data || data.length === 0) return { count: 0, avg: null }
  const sum = data.reduce((acc: number, r: any) => acc + r.stars, 0)
  return { count: data.length, avg: sum / data.length }
}

export async function createEventReview(
  eventId: string, userId: string, stars: number, content: string,
): Promise<{ ok: boolean; message?: string }> {
  const supabase = createClient()
  const { error } = await supabase
    .from('event_reviews')
    .insert({ event_id: eventId, user_id: userId, stars, content } as any)

  if (error) {
    // unique (event_id, user_id) 위반
    if (error.code === '23505') return { ok: false, message: '이미 이 이벤트에 후기를 남기셨어요.' }
    return { ok: false, message: '후기 등록에 실패했어요.' }
  }
  return { ok: true }
}

export async function deleteEventReview(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('event_reviews').delete().eq('id', id)
  return !error
}
