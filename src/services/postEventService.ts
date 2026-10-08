import { createClient } from '@/lib/supabase/client'
import { kstToday } from '@/lib/utils/kstDate'

/* 덕메게시판 글 ↔ 이벤트 연결 (글 하나에 이벤트 하나).
   DB: migrations/community_post_events.sql (community_post_events 표) */

export interface PostEventSummary {
  id: string
  title: string
  coverUrl: string | null
  startDate: string | null
  endDate: string | null
  placeName: string | null
}

function toSummary(r: any): PostEventSummary {
  return {
    id: String(r.id),
    title: r.title ?? '',
    coverUrl: r.cover_url ?? null,
    startDate: r.start_date ?? null,
    endDate: r.end_date ?? null,
    placeName: r.place_name ?? r.shops?.name ?? null,
  }
}

const EVENT_COLS = 'id, title, cover_url, start_date, end_date, place_name, shops ( name )'

/** 고를 수 있는 이벤트 — 끝나지 않은(진행 중·예정) 이벤트를 제목으로 찾는다. 검색어가 없으면 곧 끝나는/진행 중인 것부터 */
export async function searchCompanionEvents(q: string, limit = 20): Promise<PostEventSummary[]> {
  const supabase = createClient()
  const today = kstToday()
  let query = supabase
    .from('events')
    .select(EVENT_COLS)
    .is('deleted_at', null)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order('start_date', { ascending: true, nullsFirst: false })
    .limit(limit)
  const kw = q.trim()
  if (kw) query = query.ilike('title', `%${kw}%`)
  const { data, error } = await query
  if (error) { console.error('[덕메 이벤트 검색]', error); return [] }
  return (data ?? []).map(toSummary)
}

/** 글에 연결된 이벤트 (없으면 null) */
export async function getPostEvent(postId: string): Promise<PostEventSummary | null> {
  const supabase: any = createClient()   // 새 표라 타입 정의에 아직 없음
  const { data, error } = await supabase
    .from('community_post_events')
    .select(`event_id, events ( ${EVENT_COLS} )`)
    .eq('post_id', postId)
    .maybeSingle()
  if (error || !data) return null
  const ev = (data as any).events
  return ev ? toSummary(ev) : null
}

/** 글의 이벤트 연결을 바꾼다 (null 이면 연결 해제). 작성자만 가능(RLS) */
export async function setPostEvent(postId: string, eventId: string | null): Promise<boolean> {
  const supabase: any = createClient()   // 새 표라 타입 정의에 아직 없음
  const { error: delErr } = await supabase.from('community_post_events').delete().eq('post_id', postId)
  if (delErr) { console.error('[덕메 이벤트 해제]', delErr); return false }
  if (!eventId) return true
  const { error } = await supabase.from('community_post_events').insert({ post_id: postId, event_id: eventId })
  if (error) { console.error('[덕메 이벤트 연결]', error); return false }
  return true
}
