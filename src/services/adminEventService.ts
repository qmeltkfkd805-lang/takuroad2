import { createClient } from '@/lib/supabase/client'

export async function getSeasonalEvents() {
  const supabase = createClient()
  const { data } = await supabase
    .from('seasonal_events')
    .select('*, badges ( id, name, slug )')
    .order('starts_at', { ascending: false })
  return data ?? []
}

export async function createSeasonalEvent(data: {
  title: string
  description: string
  startsAt: string
  endsAt: string
}): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('seasonal_events')
    .insert({
      title: data.title,
      description: data.description,
      starts_at: data.startsAt,
      ends_at: data.endsAt,
    } as any)
  return !error
}

export async function updateSeasonalEvent(eventId: string, data: any): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('seasonal_events')
    .update(data as any)
    .eq('id', eventId)
  return !error
}

export async function endEventEarly(eventId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('seasonal_events')
    .update({ ends_at: new Date().toISOString(), is_active: false } as any)
    .eq('id', eventId)
  return !error
}

// 이벤트에 배지(tier) 추가 — badges 테이블에 seasonal_event_id 연결
export async function linkBadgeToEvent(badgeId: string, eventId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('badges')
    .update({ seasonal_event_id: eventId } as any)
    .eq('id', badgeId)
  return !error
}

// 이벤트 그룹(event)에 속한 모든 시리즈(badges) 가져오기 — 연결 선택용
export async function getEventGroupBadges() {
  const supabase = createClient()
  const { data: group } = await supabase
    .from('badge_groups')
    .select('id')
    .eq('slug', 'event')
    .maybeSingle()

  if (!group) return []

  const { data } = await supabase
    .from('badges')
    .select('id, name, seasonal_event_id')
    .eq('group_id', group.id)
    .order('sort_order')

  return data ?? []
}