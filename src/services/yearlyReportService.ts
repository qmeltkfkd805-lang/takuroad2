import { createClient } from '@/lib/supabase/client'

export interface YearlyReport {
  year: number
  visitedShopCount: number
  topSeries: string | null
  topRegion: string | null
  badgesEarnedCount: number
  routesCompletedCount: number
  mostVisitedShop: { name: string; slug: string } | null
  reviewCount: number
}

export async function getYearlyReport(userId: string, year: number): Promise<YearlyReport> {
  const supabase = createClient()
  const from = `${year}-01-01T00:00:00`
  const to = `${year}-12-31T23:59:59`

  // 방문 샵 수 (그 해 체크인한 고유 샵)
  const { data: checkIns } = await supabase
    .from('check_ins')
    .select('shop_id, created_at')
    .eq('user_id', userId)
    .gte('created_at', from)
    .lte('created_at', to)

  const visitedShopIds = (checkIns ?? []).map(c => c.shop_id)
  const visitedShopCount = new Set(visitedShopIds).size

  // 가장 많이 방문한 샵
  let mostVisitedShop = null
  if (visitedShopIds.length > 0) {
    const countMap = new Map<string, number>()
    for (const id of visitedShopIds) countMap.set(id, (countMap.get(id) ?? 0) + 1)
    const topShopId = Array.from(countMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
    if (topShopId) {
      const { data: shop } = await supabase.from('shops').select('name, slug').eq('id', topShopId).maybeSingle()
      if (shop) mostVisitedShop = { name: shop.name, slug: shop.slug }
    }
  }

  // 가장 많이 방문한 작품(태그)
  let topSeries: string | null = null
  if (visitedShopIds.length > 0) {
    const uniqueShopIds = [...new Set(visitedShopIds)]
    const { data: shopTags } = await supabase
      .from('shop_tags')
      .select('shop_id, tags ( name )')
      .in('shop_id', uniqueShopIds)

    const tagCount = new Map<string, number>()
    for (const st of shopTags ?? []) {
      const name = (st as any).tags?.name
      if (!name) continue
      tagCount.set(name, (tagCount.get(name) ?? 0) + 1)
    }
    const sorted = Array.from(tagCount.entries()).sort((a, b) => b[1] - a[1])
    topSeries = sorted[0]?.[0] ?? null
  }

  // 가장 많이 방문한 지역
  let topRegion: string | null = null
  if (visitedShopIds.length > 0) {
    const uniqueShopIds = [...new Set(visitedShopIds)]
    const { data: shopsData } = await supabase
      .from('shops')
      .select('id, region')
      .in('id', uniqueShopIds)

    const regionCount = new Map<string, number>()
    for (const s of shopsData ?? []) {
      if (!s.region) continue
      regionCount.set(s.region, (regionCount.get(s.region) ?? 0) + 1)
    }
    const sorted = Array.from(regionCount.entries()).sort((a, b) => b[1] - a[1])
    topRegion = sorted[0]?.[0] ?? null
  }

  // 그 해 획득한 배지 수
  const { count: badgesEarnedCount } = await supabase
    .from('user_badge_tiers')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('earned_at', from)
    .lte('earned_at', to)

  // 그 해 완료한 루트 수
  const { count: routesCompletedCount } = await supabase
    .from('route_completions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('completed_at', from)
    .lte('completed_at', to)

  // 그 해 작성한 후기 수
  const { count: reviewCount } = await supabase
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .gte('created_at', from)
    .lte('created_at', to)

  return {
    year,
    visitedShopCount,
    topSeries,
    topRegion,
    badgesEarnedCount: badgesEarnedCount ?? 0,
    routesCompletedCount: routesCompletedCount ?? 0,
    mostVisitedShop,
    reviewCount: reviewCount ?? 0,
  }
}

// 리포트를 볼 수 있는 연도 목록 (가입년도부터 올해까지)
export async function getAvailableYears(userId: string): Promise<number[]> {
  const supabase = createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('created_at')
    .eq('id', userId)
    .maybeSingle()

  const startYear = profile ? new Date(profile.created_at).getFullYear() : new Date().getFullYear()
  const currentYear = new Date().getFullYear()

  const years = []
  for (let y = currentYear; y >= startYear; y--) years.push(y)
  return years
}