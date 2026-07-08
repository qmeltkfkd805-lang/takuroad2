import { createClient } from '@/lib/supabase/client'

export interface EventQna {
  id: string
  eventId: string
  userId: string
  question: string
  answer: string | null
  answeredAt: string | null
  createdAt: string
  asker: { id: string; nickname: string; avatarUrl: string | null } | null
  answerer: { id: string; nickname: string } | null
}

// ⚠️ user_id·answered_by 둘 다 profiles를 가리켜서 관계가 모호하다.
//    FK 이름을 명시하지 않으면 목록이 통째로 빈 채 에러도 안 뜬다.
const SELECT = `
  id, event_id, user_id, question, answer, answered_at, created_at,
  profiles!event_qna_user_id_fkey ( id, nickname, avatar_url ),
  answerer:profiles!event_qna_answered_by_fkey ( id, nickname )
`

function toQna(raw: any): EventQna {
  const pf: any = Array.isArray(raw.profiles) ? raw.profiles[0] : raw.profiles
  const an: any = Array.isArray(raw.answerer) ? raw.answerer[0] : raw.answerer
  return {
    id: raw.id,
    eventId: raw.event_id,
    userId: raw.user_id,
    question: raw.question,
    answer: raw.answer ?? null,
    answeredAt: raw.answered_at ?? null,
    createdAt: raw.created_at,
    asker: pf ? { id: pf.id, nickname: pf.nickname, avatarUrl: pf.avatar_url ?? null } : null,
    answerer: an ? { id: an.id, nickname: an.nickname } : null,
  }
}

export async function getEventQna(eventId: string): Promise<EventQna[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('event_qna')
    .select(SELECT)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (error) return []
  return (data ?? []).map(toQna)
}

export async function getEventQnaCount(eventId: string): Promise<number> {
  const supabase = createClient()
  const { count } = await supabase
    .from('event_qna')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
  return count ?? 0
}

export async function createEventQuestion(eventId: string, userId: string, question: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('event_qna')
    .insert({ event_id: eventId, user_id: userId, question } as any)
  return !error
}

/** 답변은 관리자만 (RLS가 막는다) */
export async function answerEventQuestion(id: string, userId: string, answer: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('event_qna')
    .update({ answer, answered_by: userId, answered_at: new Date().toISOString() } as any)
    .eq('id', id)
  return !error
}

export async function deleteEventQuestion(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('event_qna').delete().eq('id', id)
  return !error
}
