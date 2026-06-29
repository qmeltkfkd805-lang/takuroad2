import { createClient } from '@/lib/supabase/client'
import { getMyWorkRelationships } from './workRelationshipService'

export interface HomeStats {
  visitedShopCount: number
  checkInCount: number
  favoriteWorkCount: number
  completedRouteCount: number
}

export async function getMyHomeStats(userId: string): Promise<HomeStats> {
  const supabase = createClient()

  const [checkInsRes, completionsRes, rels] = await Promise.all([
    supabase.from('check_ins').select('shop_id').eq('user_id', userId),
    supabase.from('route_completions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    getMyWorkRelationships(userId),
  ])

  const checkIns = checkInsRes.data ?? []
  const visitedShops = new Set(checkIns.map((c: any) => c.shop_id))

  return {
    visitedShopCount: visitedShops.size,
    checkInCount: checkIns.length,
    favoriteWorkCount: rels.filter(r => r.affinity).length,
    completedRouteCount: completionsRes.count ?? 0,
  }
}
