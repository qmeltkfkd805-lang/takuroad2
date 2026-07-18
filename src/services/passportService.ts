import { createClient } from '@/lib/supabase/client'
import { getFirstAndLatestCheckIn, getMyCheckIns } from './checkInService'
import { getRegionCollections } from './pilgrimageService'

export interface OtakuPassport {
  userId: string
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
  topVisitedSeries: { name: string; count: number; slug: string | null; cover: string | null }[]
  recentVisits: { name: string; slug: string; image: string | null; date: string }[]
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
    .select('shop_id, tags ( name, slug, cover_url )')
    .in('shop_id', shopIds)

  const agg = new Map<string, { name: string; count: number; slug: string | null; cover: string | null }>()
  for (const st of shopTags ?? []) {
    const tag = (st as any).tags
    if (!tag?.name) continue
    const cur = agg.get(tag.name)
    if (cur) cur.count += 1
    else agg.set(tag.name, { name: tag.name, count: 1, slug: tag.slug ?? null, cover: tag.cover_url ?? null })
  }

  return Array.from(agg.values())
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
    .select('nickname, avatar_url, passport_number, created_at, is_profile_public, selected_title_id, equipped')
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
  /* 대표 배지 — user_badge_tiers.is_featured가 아니라 equipped.showcase를 읽는다.
     ⭐ 같은 걸 두 군데 저장하면 프로필과 여권이 서로 달라진다.
        착용 정보는 equipped 한 곳에 모은다. 순서도 배열이라 지켜진다. */
  const showcaseIds: string[] = Array.isArray((profile as any).equipped?.showcase)
    ? (profile as any).equipped.showcase.slice(0, 3)
    : []

  let featuredBadges: { name: string; rarity: string; iconUrl: string | null }[] = []
  if (showcaseIds.length > 0) {
    const { data: tiers } = await supabase
      .from('badge_tiers')
      .select('id, name, rarity, icon_url, badges ( icon_url )')
      .in('id', showcaseIds)

    const byId = new Map(((tiers ?? []) as any[]).map(t => [t.id, t]))
    featuredBadges = showcaseIds
      .map(id => byId.get(id))
      .filter(Boolean)
      .map((t: any) => ({
        name: t.name ?? '배지',
        rarity: t.rarity ?? 'common',
        iconUrl: t.icon_url ?? t.badges?.icon_url ?? null,
      }))
  }

  // 최근 방문 샵 (이미지 포함) — 여권 카드용
  const { data: recentCheckIns } = await supabase
    .from('check_ins')
    .select('shop_id, created_at, shops ( name, slug, shop_images ( image_url, is_cover ) )')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  const seenShop = new Set<string>()
  const recentVisits: { name: string; slug: string; image: string | null; date: string }[] = []
  for (const c of (recentCheckIns ?? []) as any[]) {
    if (!c.shop_id || seenShop.has(c.shop_id)) continue
    seenShop.add(c.shop_id)
    const imgs = c.shops?.shop_images ?? []
    const cover = imgs.find((i: any) => i.is_cover) ?? imgs[0]
    recentVisits.push({
      name: c.shops?.name ?? '알 수 없음',
      slug: c.shops?.slug ?? '',
      image: cover?.image_url ?? null,
      date: c.created_at,
    })
    if (recentVisits.length >= 5) break
  }

  // 가장 많이 방문한 작품
  let topSeries = await getTopVisitedSeries(userId, 3)

  // 유저가 고른 대표 작품(equipped.featuredWork)이 있으면 맨 앞에
  const featuredWorkId = (profile as any).equipped?.featuredWork
  if (typeof featuredWorkId === 'string' && featuredWorkId) {
    const { data: fw } = await supabase
      .from('tags')
      .select('name, slug, cover_url')
      .eq('id', featuredWorkId)
      .maybeSingle()
    if (fw) {
      const existing = topSeries.find(s => s.slug === (fw as any).slug)
      const picked = {
        name: (fw as any).name ?? '작품',
        count: existing?.count ?? 0,
        slug: (fw as any).slug ?? null,
        cover: (fw as any).cover_url ?? null,
      }
      topSeries = [picked, ...topSeries.filter(s => s.slug !== picked.slug)]
    }
  }

  // 가장 많이 방문한 지역
  const regions = await getRegionCollections(userId)
  const topRegion = regions[0]?.region ?? null

  /* 명패(옛 칭호)는 코스메틱 title로 통합됐다.
     칭호     = 내가 고른 이름   (profiles.equipped.title)
     대표 배지 = 내가 자랑할 성취 (profiles.equipped.showcase)
     둘 다 /cosmetic 한 화면에서 관리한다. tagline 호환을 위해 변수만 남긴다. */
  const titleBadgeName: string | null = null

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
    userId,
    titleBadgeName,
    visitedShopCount,
    pilgrimageCount: pilgrimageCount ?? 0,
    totalBadgeCount: totalBadgeCount ?? 0,
    reviewCount: reviewCount ?? 0,
    featuredBadges,
    topVisitedSeries: topSeries,
    recentVisits,
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
    .select('badge_tier_id, badge_tiers ( id, name, rarity, is_active )')
    .eq('user_id', userId)
  return (data ?? []).map((d: any) => d.badge_tiers).filter((b: any) => b && b.is_active !== false)
}
