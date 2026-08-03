import { createClient } from '@/lib/supabase/client'

// 이벤트 단위 저장 (saved_events 테이블). "내 저장 이벤트" 캘린더에서 사용.
export async function getMySavedEventIds(userId: string): Promise<string[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from('saved_events').select('event_id').eq('user_id', userId)
  if (error) { console.error('[저장 이벤트] 조회 실패:', error.message); return [] }
  return (data ?? []).map((d: any) => d.event_id)
}

export async function saveEvent(userId: string, eventId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('saved_events').insert({ user_id: userId, event_id: eventId } as any)
  if (error && error.code !== '23505') { console.error('[저장 이벤트] 저장 실패:', error.message); return false }
  return true
}

export async function unsaveEvent(userId: string, eventId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('saved_events').delete().eq('user_id', userId).eq('event_id', eventId)
  if (error) { console.error('[저장 이벤트] 해제 실패:', error.message); return false }
  return true
}

export async function saveEventsBulk(userId: string, eventIds: string[]): Promise<boolean> {
  const supabase = createClient()
  if (eventIds.length === 0) return true
  const rows = eventIds.map(id => ({ user_id: userId, event_id: id }))
  const { error } = await supabase.from('saved_events').upsert(rows as any, { onConflict: 'user_id,event_id' })
  if (error) { console.error('[저장 이벤트] 일괄 저장 실패:', error.message); return false }
  return true
}
