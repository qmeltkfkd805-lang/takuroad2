import { createClient } from '@/lib/supabase/client'
import { recordEventVisit } from './eventVisitService'
import { recordReviewActivity } from './activityService'

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

  // ⭐ 후기를 썼다 = 실제로 다녀왔다.
  //    버튼을 한 번 더 누르게 하지 않고 참여 기록을 자동 생성한다.
  //    recordEventVisit이 기존 기록을 먼저 확인하므로 중복은 생기지 않는다.
  //    후기 등록 자체는 이미 성공했으므로, 여기서 실패해도 사용자를 막지 않는다.
  try {
    await recordEventVisit(userId, eventId, 'review')

    // 성장 Activity — 리뷰(이벤트 후기). ref = 이벤트
    const { data: ev } = await supabase
      .from('events').select('title, type, tag_id').eq('id', eventId).maybeSingle()
    const e: any = ev ?? {}
    await recordReviewActivity({
      userId,
      targetType: 'event',
      targetId: eventId,
      targetName: e.title ?? '이벤트',
      eventType: e.type ?? undefined,
      workId: e.tag_id ?? null,
    })
  } catch (e) {
    console.error('후기 → 참여 기록 자동 생성 실패:', e)
  }

  return { ok: true }
}

export async function deleteEventReview(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('event_reviews').delete().eq('id', id)
  return !error
}
