import { createClient } from '@/lib/supabase/client'
import { countActivity } from './growthService'

export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary'

export const RARITY_COLOR: Record<BadgeRarity, string> = {
  common: '#9ca3af',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
}

export const RARITY_LABEL: Record<BadgeRarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
}

// 그룹 목록 + 각 그룹의 도감 진행률
export async function getBadgeGroups(userId: string | null) {
  const supabase = createClient()

  const { data: groups } = await supabase
    .from('badge_groups')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  const result = []
  for (const group of groups ?? []) {
    const { data: badgesInGroup } = await supabase
      .from('badges')
      .select('id')
      .eq('group_id', group.id)
      .eq('is_active', true)

    let owned = 0
    if (userId && badgesInGroup) {
      const badgeIds = badgesInGroup.map(b => b.id)
      const { data: tiers } = await supabase
        .from('badge_tiers')
        .select('id, badge_id')
        .in('badge_id', badgeIds)

      const tierIds = (tiers ?? []).map(t => t.id)
      const { data: earned } = await supabase
        .from('user_badge_tiers')
        .select('badge_tier_id')
        .eq('user_id', userId)
        .in('badge_tier_id', tierIds)

      const earnedTierIds = new Set((earned ?? []).map(e => e.badge_tier_id))
      const ownedBadgeIds = new Set(
        (tiers ?? []).filter(t => earnedTierIds.has(t.id)).map(t => t.badge_id)
      )
      owned = ownedBadgeIds.size
    }

    result.push({
      ...group,
      total: badgesInGroup?.length ?? 0,
      owned,
    })
  }

  return result
}

// 그룹 안의 시리즈 목록 (도감 ☑/□)
export async function getBadgesInGroup(groupSlug: string, userId: string | null) {
  const supabase = createClient()

  const { data: group } = await supabase
    .from('badge_groups')
    .select('id')
    .eq('slug', groupSlug)
    .maybeSingle()

  if (!group) return []

  const { data: badges } = await supabase
    .from('badges')
    .select('*, badge_tiers (id)')
    .eq('group_id', group.id)
    .eq('is_active', true)
    .order('sort_order')

  if (!badges) return []

  let earnedTierIds = new Set<string>()
  if (userId) {
    const { data: earned } = await supabase
      .from('user_badge_tiers')
      .select('badge_tier_id')
      .eq('user_id', userId)
    earnedTierIds = new Set((earned ?? []).map(e => e.badge_tier_id))
  }

  return badges.map((b: any) => ({
    id: b.id,
    slug: b.slug,
    name: b.name,
    iconUrl: b.icon_url,
    owned: (b.badge_tiers ?? []).some((t: any) => earnedTierIds.has(t.id)),
  }))
}

// 특정 시리즈(badge)의 tier 목록 + 진행률
export async function getBadgeTiers(badgeSlug: string, userId: string | null) {
  const supabase = createClient()

  const { data: badge } = await supabase
    .from('badges')
    .select('*')
    .eq('slug', badgeSlug)
    .maybeSingle()

  if (!badge) return null

  const { data: tiers } = await supabase
    .from('badge_tiers')
    .select('*')
    .eq('badge_id', badge.id)
    .eq('is_active', true)
    .order('sort_order')

  let earnedMap = new Map<string, string>()
  if (userId) {
    const { data: earned } = await supabase
      .from('user_badge_tiers')
      .select('badge_tier_id, earned_at')
      .eq('user_id', userId)
    earnedMap = new Map((earned ?? []).map(e => [e.badge_tier_id, e.earned_at]))
  }

  const tiersWithProgress = await Promise.all(
    (tiers ?? []).map(async (tier: any) => {
      const earned = earnedMap.has(tier.id)
      let progress = null

      if (!earned && tier.condition_type === 'tag_visit_percent' && userId) {
        progress = await getTagVisitProgress(userId, tier.condition_target.tag, tier.condition_target.percent)
      } else if (!earned && tier.condition_type === 'region_visit_count' && userId) {
        progress = await getRegionVisitProgress(userId, tier.condition_target.region, tier.condition_target.count)
      } else if (!earned && tier.condition_type === 'category_visit_count' && userId) {
        progress = await getCategoryVisitProgress(userId, tier.condition_target.category, tier.condition_target.count)
      }

      return {
        id: tier.id,
        tierType: tier.tier_type,
        name: tier.name,
        description: tier.description,
        rarity: tier.rarity as BadgeRarity,
        isHidden: tier.is_hidden,
        conditionType: tier.condition_type,
        conditionTarget: tier.condition_target,
        earned,
        earnedAt: earnedMap.get(tier.id) ?? null,
        progress,
      }
    })
  )

  return {
    badge: { id: badge.id, slug: badge.slug, name: badge.name, iconUrl: badge.icon_url },
    tiers: tiersWithProgress,
  }
}

// 태그 기반 방문 진행률 (성지순례)
async function getTagVisitProgress(userId: string, tag: string, targetPercent: number) {
  const supabase = createClient()

  const { data: tagRow } = await supabase.from('tags').select('id').eq('name', tag).maybeSingle()
  if (!tagRow) return { visited: 0, total: 0, percent: 0 }

  const { data: shopIds } = await supabase
    .from('shop_tags')
    .select('shop_id')
    .eq('tag_id', tagRow.id)

  const total = shopIds?.length ?? 0
  if (total === 0) return { visited: 0, total: 0, percent: 0 }

  const { data: checkIns } = await supabase
    .from('check_ins')
    .select('shop_id')
    .eq('user_id', userId)
    .in('shop_id', shopIds!.map(s => s.shop_id))

  const visited = new Set((checkIns ?? []).map(c => c.shop_id)).size
  const percent = Math.min(100, Math.round((visited / total) * 100))

  return { visited, total, percent }
}

async function getRegionVisitProgress(userId: string, region: string, count: number) {
  const supabase = createClient()
  const { data } = await supabase
    .from('check_ins')
    .select('shop_id, shops!inner(region)')
    .eq('user_id', userId)
    .eq('shops.region', region)
  const visited = new Set((data ?? []).map((d: any) => d.shop_id)).size
  return { visited, total: count, percent: Math.min(100, Math.round((visited / count) * 100)) }
}

async function getCategoryVisitProgress(userId: string, category: string, count: number) {
  const supabase = createClient()
  const { data } = await supabase
    .from('check_ins')
    .select('shop_id, shops!inner(shop_categories!inner(categories!inner(name)))')
    .eq('user_id', userId)
  const matching = (data ?? []).filter((d: any) =>
    d.shops?.shop_categories?.some((sc: any) => sc.categories?.name === category)
  )
  const visited = new Set(matching.map((d: any) => d.shop_id)).size
  return { visited, total: count, percent: Math.min(100, Math.round((visited / count) * 100)) }
}

// 미방문 샵 목록 (지도 연결용)
export async function getUnvisitedShopsForTag(userId: string, tag: string) {
  const supabase = createClient()
  const { data: tagRow } = await supabase.from('tags').select('id').eq('name', tag).maybeSingle()
  if (!tagRow) return []

  const { data: allShops } = await supabase
    .from('shop_tags')
    .select('shops ( id, slug, name, lat, lng, addr )')
    .eq('tag_id', tagRow.id)

  const { data: checkIns } = await supabase
    .from('check_ins')
    .select('shop_id')
    .eq('user_id', userId)

  const visitedIds = new Set((checkIns ?? []).map(c => c.shop_id))

  return (allShops ?? [])
    .map((s: any) => s.shops)
    .filter((s: any) => s && !visitedIds.has(s.id))
}

// 자동 배지 평가 (체크인 후 호출)
export async function evaluateBadgeTiersForUser(userId: string): Promise<string[]> {
  const supabase = createClient()
  const newlyEarned: string[] = []

  const { data: tiers } = await supabase
    .from('badge_tiers')
    .select('*')
    .eq('award_type', 'automatic')
    .eq('is_active', true)

  if (!tiers) return []

  const { data: existing } = await supabase
    .from('user_badge_tiers')
    .select('badge_tier_id')
    .eq('user_id', userId)

  const existingIds = new Set((existing ?? []).map(e => e.badge_tier_id))

  for (const tier of tiers) {
    if (existingIds.has(tier.id)) continue

    if (tier.is_limited) {
      const now = new Date()
      if (tier.available_from && now < new Date(tier.available_from)) continue
      if (tier.available_until && now > new Date(tier.available_until)) continue
    }

    // ⚠️ 배지 하나가 터져도 나머지 평가는 계속돼야 한다.
    //    (옛 조건 하나가 에러를 던지면 뒤의 성장 배지가 전부 안 돌던 버그)
    try {
      const qualifies = await checkTierCondition(userId, tier, existingIds)
      if (qualifies) {
        const { error } = await supabase
          .from('user_badge_tiers')
          .insert({ user_id: userId, badge_tier_id: tier.id } as any)
        if (error) {
          console.error('[배지 지급 실패]', tier.name, error.message)
        } else {
          newlyEarned.push(tier.id)
          console.log('[배지 획득]', tier.name)
        }
      }
    } catch (e) {
      console.error('[배지 판정 실패]', tier.name, tier.condition_type, e)
    }
  }

  return newlyEarned
}

async function checkTierCondition(userId: string, tier: any, earnedTierIds: Set<string>): Promise<boolean> {
  const type = tier.condition_type
  const target = tier.condition_target
  // ⭐ 성장 시스템 — 조건 타입은 영원히 이거 하나.
  //    새 활동이 생겨도 activity_type 값만 늘어난다.
  if (type === 'activity_count') {
    const done = await countActivity(userId, target)
    const need = target?.count ?? 1
    return done >= need
  }

  if (type === 'tag_visit_percent') {
    const p = await getTagVisitProgress(userId, target.tag, target.percent)
    return p.percent >= target.percent
  }

  if (type === 'region_visit_count') {
    const p = await getRegionVisitProgress(userId, target.region, target.count)
    return p.visited >= target.count
  }

  if (type === 'category_visit_count') {
    const p = await getCategoryVisitProgress(userId, target.category, target.count)
    return p.visited >= target.count
  }

  if (type === 'requires_combo') {
    const supabase = createClient()
    for (const req of target.requires) {
      if (req.type === 'tier_complete') {
        const { data: siblingTier } = await supabase
          .from('badge_tiers')
          .select('id')
          .eq('badge_id', tier.badge_id)
          .eq('tier_type', req.tier_type)
          .maybeSingle()
        if (!siblingTier || !earnedTierIds.has(siblingTier.id)) return false
      }
      // review_count, like_count 조건은 추후 리뷰/좋아요 데이터 연동 시 구현
      // 지금은 tier_complete 조건만 평가 (review_count, like_count는 항상 미충족으로 처리)
      if (req.type === 'review_count' || req.type === 'like_count') {
        return false
      }
    }
    return true
  }

  return false
}

// 대표 배지 설정
export async function setFeaturedBadgeTiers(userId: string, tierIds: string[]): Promise<boolean> {
  if (tierIds.length > 3) return false
  const supabase = createClient()

  await supabase
    .from('user_badge_tiers')
    .update({ is_featured: false } as any)
    .eq('user_id', userId)

  if (tierIds.length > 0) {
    await supabase
      .from('user_badge_tiers')
      .update({ is_featured: true } as any)
      .eq('user_id', userId)
      .in('badge_tier_id', tierIds)
  }

  return true
}

// 내 대표 배지
export async function getMyFeaturedBadges(userId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('user_badge_tiers')
    .select('badge_tier_id, badge_tiers ( name, rarity )')
    .eq('user_id', userId)
    .eq('is_featured', true)
  return data ?? []
}

// tier 통계 (획득률/획득자 수)
export async function getTierStats(tierId: string) {
  const supabase = createClient()
  const { count: totalUsers } = await supabase.from('profiles').select('id', { count: 'exact', head: true })
  const { count: earnedCount } = await supabase
    .from('user_badge_tiers')
    .select('id', { count: 'exact', head: true })
    .eq('badge_tier_id', tierId)

  return {
    earnedCount: earnedCount ?? 0,
    earnRate: totalUsers ? Math.round(((earnedCount ?? 0) / totalUsers) * 1000) / 10 : 0,
  }
}

// === 관리자 함수 ===
export async function getAllBadgeGroups() {
  const supabase = createClient()
  const { data } = await supabase.from('badge_groups').select('*').order('sort_order')
  return data ?? []
}

export async function getAllBadgesAdmin() {
  const supabase = createClient()
  const { data } = await supabase
    .from('badges')
    .select('*, badge_groups ( name, slug ), badge_tiers ( id, name, rarity, award_type, is_active )')
    .order('sort_order')
  return data ?? []
}

export async function createBadgeAdmin(groupId: string, slug: string, name: string, iconUrl: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('badges')
    .insert({ group_id: groupId, slug, name, icon_url: iconUrl } as any)
  return !error
}

export async function updateBadgeAdmin(badgeId: string, data: any): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('badges').update(data as any).eq('id', badgeId)
  return !error
}

export async function deleteBadgeAdmin(badgeId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('badges').update({ is_active: false } as any).eq('id', badgeId)
  return !error
}

export async function createTierAdmin(data: {
  badgeId: string
  tierType: string
  name: string
  description: string
  rarity: BadgeRarity
  awardType: 'automatic' | 'manual'
  isHidden: boolean
  conditionType: string | null
  conditionTarget: any
}): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('badge_tiers')
    .insert({
      badge_id: data.badgeId,
      tier_type: data.tierType,
      name: data.name,
      description: data.description,
      rarity: data.rarity,
      award_type: data.awardType,
      is_hidden: data.isHidden,
      condition_type: data.conditionType,
      condition_target: data.conditionTarget,
    } as any)
  return !error
}

export async function updateTierAdmin(tierId: string, data: any): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('badge_tiers').update(data as any).eq('id', tierId)
  return !error
}

export async function deleteTierAdmin(tierId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('badge_tiers').update({ is_active: false } as any).eq('id', tierId)
  return !error
}

export async function awardTierManually(userId: string, tierId: string, adminId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('user_badge_tiers')
    .insert({ user_id: userId, badge_tier_id: tierId, awarded_by: adminId } as any)
  return !error
}

export async function searchUsersForAward(query: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, nickname, avatar_url')
    .ilike('nickname', `%${query}%`)
    .limit(10)
  return data ?? []
}
