import { createClient } from '@/lib/supabase/client'

// 공식 루트 후보 (좋아요/완료 인원 순)
export async function getOfficialRouteCandidates() {
  const supabase = createClient()

  const { data: routes } = await supabase
    .from('routes')
    .select(`
      id, title, description, likes, is_official,
      profiles ( nickname ),
      route_shops ( id )
    `)
    .eq('is_shared', true)
    .order('likes', { ascending: false })

  if (!routes) return []

  const withCompletions = await Promise.all(
    routes.map(async (route: any) => {
      const { count } = await supabase
        .from('route_completions')
        .select('id', { count: 'exact', head: true })
        .eq('route_id', route.id)
      return { ...route, completionCount: count ?? 0 }
    })
  )

  return withCompletions
}

// 현재 공식 루트 목록
export async function getOfficialRoutes() {
  const supabase = createClient()
  const { data } = await supabase
    .from('routes')
    .select(`
      id, title, official_difficulty, approved_at,
      profiles ( nickname ),
      route_shops ( id )
    `)
    .eq('is_official', true)
    .order('approved_at', { ascending: false })
  return data ?? []
}

// 공식 루트 승인
export async function approveOfficialRoute(routeId: string, difficulty: number, adminId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('routes')
    .update({
      is_official: true,
      official_difficulty: difficulty,
      approved_by: adminId,
      approved_at: new Date().toISOString(),
    } as any)
    .eq('id', routeId)
  return !error
}

// 공식 루트 해제
export async function revokeOfficialRoute(routeId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('routes')
    .update({ is_official: false } as any)
    .eq('id', routeId)
  return !error
}