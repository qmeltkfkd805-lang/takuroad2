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

/* ============================================================
   연간 리포트 공유 이미지용 데이터 — getYearlyReport + 보강
   ⭐ 유형 칸: equipped.title(대표 칭호)만. 없으면 null → 숨김(레벨명 대체 안 함)
   ⭐ 최애: equipped.featuredWork → topSeries → null
   ⭐ 이동거리: 그 해 완주 기록 × routes.total_distance_m 합(완주 횟수만큼)
   ⭐ 활발한 달: activity_logs 원장의 "의미 있는 사용자 활동"만(교차 중복 없음)
   ============================================================ */

// "가장 활발했던 달" 집계 대상 (activity_logs 원장 기준, 시스템/관리자 제외)
export const MONTH_ACTIVITY_TYPES = [
  'shop_visit', 'event_visit', 'route_completed', 'review', 'photo_upload',
  'shop_register', 'work_register', 'event_submit', 'route_created',
] as const

export interface ReportCardData {
  year: number
  nickname: string
  title: string | null            // 대표 칭호(없으면 숨김)
  visitedShopCount: number
  routesCompletedCount: number
  distanceKm: number | null       // 0이면 null(숨김)
  badgesEarnedCount: number       // 올해 획득
  topRegion: string | null
  mostActiveMonth: number | null  // 1~12, 없으면 null(숨김)
  favoriteWork: string | null     // featuredWork → topSeries → null
  hasAnyActivity: boolean
}

export async function getReportCardData(userId: string, year: number): Promise<ReportCardData> {
  const supabase = createClient()
  const from = `${year}-01-01T00:00:00`
  const to = `${year}-12-31T23:59:59`

  const base = await getYearlyReport(userId, year)

  const { data: prof } = await supabase
    .from('profiles').select('nickname, equipped').eq('id', userId).maybeSingle()
  const equipped = ((prof as any)?.equipped ?? {}) as Record<string, any>
  const nickname = (prof as any)?.nickname ?? '타쿠'

  // 대표 칭호 (equipped.title 코스메틱 이름) — 없으면 null
  let title: string | null = null
  if (typeof equipped.title === 'string' && equipped.title) {
    const { data: cos } = await supabase.from('cosmetics').select('name').eq('id', equipped.title).maybeSingle()
    title = (cos as any)?.name ?? null
  }

  // 최애 작품: featuredWork → topSeries
  let favoriteWork: string | null = null
  if (typeof equipped.featuredWork === 'string' && equipped.featuredWork) {
    const { data: tg } = await supabase.from('tags').select('name').eq('id', equipped.featuredWork).maybeSingle()
    favoriteWork = (tg as any)?.name ?? null
  }
  if (!favoriteWork) favoriteWork = base.topSeries

  // 이동 거리: 그 해 완주 기록마다 연결된 routes.total_distance_m 합(완주 횟수만큼)
  let distanceKm: number | null = null
  const { data: comps } = await supabase
    .from('route_completions').select('route_id')
    .eq('user_id', userId).gte('completed_at', from).lte('completed_at', to)
  const routeIds = (comps ?? []).map((c: any) => c.route_id).filter(Boolean)
  if (routeIds.length > 0) {
    const uniq = [...new Set(routeIds)]
    const { data: rts } = await supabase.from('routes').select('id, total_distance_m').in('id', uniq)
    const dmap = new Map((rts ?? []).map((r: any) => [r.id, Number(r.total_distance_m) || 0]))
    const totalM = routeIds.reduce((s: number, id: string) => s + (dmap.get(id) ?? 0), 0)
    distanceKm = totalM > 0 ? Math.round(totalM / 100) / 10 : null   // 소수 1자리 km
  }

  // 가장 활발했던 달: activity_logs 의미 활동만 월별 최다
  const { data: acts } = await supabase
    .from('activity_logs').select('type, occurred_at')
    .eq('user_id', userId)
    .in('type', MONTH_ACTIVITY_TYPES as unknown as string[])
    .gte('occurred_at', from).lte('occurred_at', to)
  const monthCount = new Array(13).fill(0)
  for (const a of (acts ?? []) as any[]) {
    const d = new Date(a.occurred_at)
    if (!Number.isNaN(d.getTime())) monthCount[d.getMonth() + 1]++
  }
  let mostActiveMonth: number | null = null
  let best = 0
  for (let m = 1; m <= 12; m++) if (monthCount[m] > best) { best = monthCount[m]; mostActiveMonth = m }

  const hasAnyActivity =
    base.visitedShopCount > 0 || base.routesCompletedCount > 0 ||
    base.badgesEarnedCount > 0 || base.reviewCount > 0 || (acts?.length ?? 0) > 0

  return {
    year, nickname, title,
    visitedShopCount: base.visitedShopCount,
    routesCompletedCount: base.routesCompletedCount,
    distanceKm,
    badgesEarnedCount: base.badgesEarnedCount,
    topRegion: base.topRegion,
    mostActiveMonth,
    favoriteWork,
    hasAnyActivity,
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