import { createClient } from '@/lib/supabase/client'

export interface RouteTip {
  id: string
  content: string
  created_at: string
  user_id: string
  nickname: string | null
}

// 루트 "시작하기" 기록 (팁 작성 자격)
export async function recordRouteStart(routeId: string, userId: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('route_starts').upsert({ route_id: routeId, user_id: userId } as any, { onConflict: 'route_id,user_id' })
}

export async function hasStartedRoute(routeId: string, userId: string): Promise<boolean> {
  const supabase = createClient()
  const { data } = await supabase.from('route_starts').select('route_id').eq('route_id', routeId).eq('user_id', userId).maybeSingle()
  return !!data
}

// 방문자 팁
export async function getRouteTips(routeId: string): Promise<RouteTip[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('route_tips')
    .select('id, content, created_at, user_id, profiles(nickname)')
    .eq('route_id', routeId)
    .order('created_at', { ascending: false })
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id, content: r.content, created_at: r.created_at, user_id: r.user_id,
    nickname: r.profiles?.nickname ?? null,
  }))
}

export async function addRouteTip(routeId: string, userId: string, content: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('route_tips').insert({ route_id: routeId, user_id: userId, content: content.trim() } as any)
  return !error
}

export async function deleteRouteTip(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('route_tips').delete().eq('id', id)
  return !error
}
