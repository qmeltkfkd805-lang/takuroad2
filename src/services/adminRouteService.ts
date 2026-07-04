import { createClient } from '@/lib/supabase/client'

export async function getOfficialRouteCandidates() {
  const supabase = createClient()

  const { data: routes, error } = await supabase
    .from('routes')
    .select(`
      id, title, description, likes, is_official, user_id,
      profiles!routes_user_id_fkey ( nickname ),
      route_shops ( id )
    `)
    .eq('is_shared', true)

  if (error) {
    console.error('getOfficialRouteCandidates error:', JSON.stringify(error))
    return []
  }

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

  // 醫뗭븘??+ ?꾨즺 ?몄썝???⑹튇 ?먯닔濡??대┝李⑥닚 ?뺣젹
  return withCompletions.sort((a, b) => {
    const scoreA = a.likes + a.completionCount
    const scoreB = b.likes + b.completionCount
    return scoreB - scoreA
  })
}

export async function getOfficialRoutes() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('routes')
    .select(`
      id, title, official_difficulty, approved_at, user_id,
      profiles!routes_user_id_fkey ( nickname ),
      route_shops ( id )
    `)
    .eq('is_official', true)
    .order('approved_at', { ascending: false })

  if (error) {
    console.error('getOfficialRoutes error:', JSON.stringify(error))
    return []
  }
  return data ?? []
}

export async function approveOfficialRoute(routeId: string, difficulty: number, adminId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('routes')
    .update({
      is_official: true,
      is_shared: true,
      official_difficulty: difficulty,
      approved_by: adminId,
      approved_at: new Date().toISOString(),
    } as any)
    .eq('id', routeId)

  if (error) {
    console.error('approveOfficialRoute error:', JSON.stringify(error))
  }
  return !error
}

export async function revokeOfficialRoute(routeId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('routes')
    .update({ is_official: false } as any)
    .eq('id', routeId)
  return !error
}

