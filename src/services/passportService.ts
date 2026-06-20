import { createClient } from '@/lib/supabase/client'
import { getFirstAndLatestCheckIn, getMyCheckIns } from './checkInService'
import { getRegionCollections } from './pilgrimageService'

export interface OtakuPassport {
  nickname: string
  avatarUrl: string | null
  passportNumber: string | null
  issuedAt: string
  tagline: string
  titleBadgeName: string | null
  visitedShopCount: number
  pilgrimageCount: number
  totalBadgeCount: number
  reviewCount: number
  featuredBadges: { name: string; rarity: string; iconUrl: string | null }[]
  topVisitedSeries: { name: string; count: number }[]
  firstShop: { name: string; date: string } | null
  latestShop: { name: string; date: string } | null
  recentActivities: any[]
  isPublic: boolean
}

// 가장 많이 방문한 작품 Top 3
async function getTopVisitedSeries(userId: string, limit = 3) {
  const supabase = createClient()

  const { data: checkIns } = await supabase
    .from('check_ins')
    .select('shop_id')
    .eq('user_id', userId)

  if (!checkIns || checkIns.length === 0) return []

  const shopIds = [...new Set(checkIns.map(c => c.shop_id))]

  const { data: shopTags } = await supabase
    .from('shop_tags')
    .select('shop_id, tags ( name )')
    .in('shop_id', shopIds)

  const tagCount = new Map<string, number>()
  for (const st of shopTags ?? []) {
    const tagName = (st as any).tags?.name
    if (!tagName) continue
    tagCount.set(tagName, (tagCount.get(tagName) ?? 0) + 1)
  }

  return Array.from(tagCount.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

// 덕질 DNA 기반 자동 소개 문구 생성
function generateTagline(topRegion: string | null, topSeries: string | null, titleName: string | null): string {
  function extractHonorific(name: string): string {
    const words = name.trim().split(' ')
    return words[words.length - 1] || '오타쿠'
  }

  if (topRegion && topSeries) {
    const honorific = titleName ? extractHonorific(titleName) : '순례자'
    return `${topRegion}를 가장 사랑하는 ${topSeries} ${honorific}`
  }
  if (topSeries) {
    return `${topSeries} 성지를 찾아다니는 순례자`
  }
  if (topRegion) {
    return `${topRegion}을 탐험하는 여행자`
  }
  return '타쿠로드를 탐험하는 여행자'
}

export async function getMyPassport(userId: string): Promise<OtakuPassport | null> {
  const supabase = createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname, avatar_url, passport_number, created_at, is_profile_public, selected_title_id')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) return null

  // 방문 샵 수
  const { data: checkIns } = await supabase
    .from('check_ins')
    .select('shop_id')
    .eq('user_id', userId)
  const visitedShopCount = new Set((checkIns ?? []).map(c => c.shop_id)).size

  // 완료한 루트(성지순례) 수
  const { count: pilgrimageCount } = await supabase
    .from('route_completions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  // 배지 총 개수
  const { count: totalBadgeCount } = await supabase
    .from('user_badge_tiers')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  // 후기 수
  const { count: reviewCount } = await supabase
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_deleted', false)

  // 대표 배지 3개
  const { data: featured } = await supabase
    .from('user_badge_tiers')
    .select('badge_tiers ( name, rarity, badge_id, badges ( icon_url ) )')
    .eq('user_id', userId)
    .eq('is_featured', true)

  const featuredBadges = (featured ?? []).map((f: any) => ({
    name: f.badge_tiers?.name ?? '',
    rarity: f.badge_tiers?.rarity ?? 'common',
    iconUrl: f.badge_tiers?.badges?.icon_url ?? null,
  }))

  // 가장 많이 방문한 작품
  const topSeries = await getTopVisitedSeries(userId, 3)

  // 가장 많이 방문한 지역
  const regions = await getRegionCollections(userId)
  const topRegion = regions[0]?.region ?? null

  // 명패 이름 (선택된 badge_tier)
  let titleBadgeName: string | null = null
  if (profile.selected_title_id) {
    const { data: titleTier } = await supabase
      .from('badge_tiers')
      .select('name')
      .eq('id', profile.selected_title_id)
      .maybeSingle()
    titleBadgeName = titleTier?.name ?? null
  }

  // 첫 성지 / 최근 성지
  const { first, latest } = await getFirstAndLatestCheckIn(userId)

  // 최근 활동
  const { data: activities } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)

  const tagline = generateTagline(topRegion, topSeries[0]?.name ?? null, titleBadgeName)

  return {
    nickname: profile.nickname,
    avatarUrl: profile.avatar_url,
    passportNumber: profile.passport_number,
    issuedAt: profile.created_at,
    tagline,
    titleBadgeName,
    visitedShopCount,
    pilgrimageCount: pilgrimageCount ?? 0,
    totalBadgeCount: totalBadgeCount ?? 0,
    reviewCount: reviewCount ?? 0,
    featuredBadges,
    topVisitedSeries: topSeries,
    firstShop: first ? { name: (first as any).shops?.name ?? '알 수 없음', date: first.created_at } : null,
    latestShop: latest ? { name: (latest as any).shops?.name ?? '알 수 없음', date: latest.created_at } : null,
    recentActivities: activities ?? [],
    isPublic: profile.is_profile_public ?? true,
  }
}

// 공개 프로필 조회 (닉네임 기반)
export async function getPublicPassport(nickname: string): Promise<OtakuPassport | null> {
  const supabase = createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, is_profile_public')
    .eq('nickname', nickname)
    .maybeSingle()

  if (!profile) return null
  if (!profile.is_profile_public) return null

  return getMyPassport(profile.id)
}

// 명패 설정
export async function setTitleBadge(userId: string, badgeTierId: string): Promise<boolean> {
  const supabase = createClient()

  // 실제 보유 여부 확인
  const { data: owned } = await supabase
    .from('user_badge_tiers')
    .select('id')
    .eq('user_id', userId)
    .eq('badge_tier_id', badgeTierId)
    .maybeSingle()

  if (!owned) return false

  const { error } = await supabase
    .from('profiles')
    .update({ selected_title_id: badgeTierId, selected_title_type: 'badge' } as any)
    .eq('id', userId)

  return !error
}

export async function clearTitleBadge(userId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ selected_title_id: null } as any)
    .eq('id', userId)
  return !error
}

// 프로필 공개 설정
export async function setProfilePublic(userId: string, isPublic: boolean): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ is_profile_public: isPublic } as any)
    .eq('id', userId)
  return !error
}

// 내가 명패로 설정할 수 있는 배지 목록 (보유한 것만)
export async function getMyAvailableTitles(userId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('user_badge_tiers')
    .select('badge_tier_id, badge_tiers ( id, name, rarity )')
    .eq('user_id', userId)
  return (data ?? []).map((d: any) => d.badge_tiers).filter(Boolean)
}