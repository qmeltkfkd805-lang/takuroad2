import { createClient } from '@/lib/supabase/client'

// 운영자가 만든 공식 성지 리스트 전체
export async function getOfficialLists() {
  const supabase = createClient()
  const { data } = await supabase
    .from('pilgrimage_lists')
    .select('*')
    .eq('is_active', true)
    .order('created_at')
  return data ?? []
}

// 특정 리스트에 대한 내 진행률
export async function getMyProgress(userId: string, listId: string) {
  const supabase = createClient()

  const { data: listShops } = await supabase
    .from('pilgrimage_list_shops')
    .select('shop_id')
    .eq('pilgrimage_list_id', listId)

  const total = listShops?.length ?? 0
  if (total === 0) return { visited: 0, total: 0, percent: 0 }

  const shopIds = listShops!.map(s => s.shop_id)
  const { data: checkIns } = await supabase
    .from('check_ins')
    .select('shop_id')
    .eq('user_id', userId)
    .in('shop_id', shopIds)

  const visited = new Set((checkIns ?? []).map(c => c.shop_id)).size
  const percent = Math.round((visited / total) * 100)

  return { visited, total, percent }
}

// 지역별 정복률 (홍대 7/12, 강남 4/8 같은 컬렉션)
export async function getRegionCollections(userId: string) {
  const supabase = createClient()

  const { data: shops } = await supabase
    .from('shops')
    .select('id, region')
    .eq('status', 'active')
    .not('region', 'is', null)

  if (!shops) return []

  const { data: checkIns } = await supabase
    .from('check_ins')
    .select('shop_id')
    .eq('user_id', userId)

  const visitedShopIds = new Set((checkIns ?? []).map(c => c.shop_id))

  const regionMap = new Map<string, { total: number; visited: number }>()

  for (const shop of shops) {
    if (!shop.region) continue
    const current = regionMap.get(shop.region) ?? { total: 0, visited: 0 }
    current.total += 1
    if (visitedShopIds.has(shop.id)) current.visited += 1
    regionMap.set(shop.region, current)
  }

  return Array.from(regionMap.entries())
    .map(([region, stats]) => ({
      region,
      visited: stats.visited,
      total: stats.total,
      percent: Math.round((stats.visited / stats.total) * 100),
      isComplete: stats.visited === stats.total,
    }))
    .sort((a, b) => b.percent - a.percent)
}

// 미방문 샵 목록 (지역 컬렉션용 — "아직 안 간 샵 2곳")
export async function getUnvisitedShopsForRegion(userId: string, region: string) {
  const supabase = createClient()

  const { data: shops } = await supabase
    .from('shops')
    .select('id, slug, name, addr')
    .eq('status', 'active')
    .eq('region', region)

  const { data: checkIns } = await supabase
    .from('check_ins')
    .select('shop_id')
    .eq('user_id', userId)

  const visitedIds = new Set((checkIns ?? []).map(c => c.shop_id))

  return (shops ?? []).filter(s => !visitedIds.has(s.id))
}

// === 관리자 함수 ===
export async function createPilgrimageList(title: string, description: string, country: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('pilgrimage_lists')
    .insert({ title, description, country } as any)
  return !error
}

export async function addShopToList(listId: string, shopId: string, sortOrder: number): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('pilgrimage_list_shops')
    .insert({ pilgrimage_list_id: listId, shop_id: shopId, sort_order: sortOrder } as any)
  return !error
}

export async function removeShopFromList(listId: string, shopId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('pilgrimage_list_shops')
    .delete()
    .eq('pilgrimage_list_id', listId)
    .eq('shop_id', shopId)
  return !error
}