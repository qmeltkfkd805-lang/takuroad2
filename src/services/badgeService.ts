import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { countActivity } from './growthService'
import { addExpOnce, BADGE_XP_BY_RARITY } from './expService'

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
/** description이 없는 티어를 위해 조건으로 안내 문구를 만든다 */
/** activity_type → [획득함, 아직] 문구. {n}은 목표 수치로 치환된다 */
const ACTIVITY_WORD: Record<string, [string, string]> = {
  shop_visit:      ['샵 {n}곳을 방문했어요', '샵 {n}곳을 방문하면 얻어요'],
  review:          ['후기를 {n}개 남겼어요', '후기를 {n}개 남기면 얻어요'],
  photo_upload:    ['사진을 {n}장 올렸어요', '사진을 {n}장 올리면 얻어요'],
  route_created:   ['루트를 {n}개 만들었어요', '루트를 {n}개 만들면 얻어요'],
  route_completed: ['루트를 {n}개 완주했어요', '루트를 {n}개 완주하면 얻어요'],
  event_visit:     ['이벤트에 {n}번 참여했어요', '이벤트에 {n}번 참여하면 얻어요'],
  shop_added:      ['샵을 {n}곳 등록했어요', '샵을 {n}곳 등록하면 얻어요'],
  contribution:    ['{n}번 기여했어요', '{n}번 기여하면 얻어요'],
}
/** 티어 조건 → 안내 문구. 획득했으면 과거형, 아니면 "~하면 얻어요" */
export function tierHintFromCondition(type: string | null, target: any, earned = false): string | null {
  const n = target?.count ?? null
  const pct = target?.percent ?? null
  let pair: [string, string] | null = null   // [획득함, 아직]

  switch (type) {
    case 'activity_count': {
      if (!n) break
      const w = ACTIVITY_WORD[target?.activity_type ?? '']
      pair = w
        ? [w[0].replace('{n}', String(n)), w[1].replace('{n}', String(n))]
        : [n + '회 활동했어요', n + '회 활동하면 얻어요']
      break
    }
    case 'comment_count':
      if (n) pair = ['댓글을 ' + n + '개 남겼어요', '댓글을 ' + n + '개 남기면 얻어요']
      break
    case 'post_count':
      if (n) pair = ['글을 ' + n + '개 썼어요', '글을 ' + n + '개 쓰면 얻어요']
      break
    case 'likes_received':
      if (n) pair = ['좋아요를 ' + n + '개 받았어요', '좋아요를 ' + n + '개 받으면 얻어요']
      break
    case 'consecutive_days':
      if (n) pair = [n + '일 연속 방문했어요', n + '일 연속 방문하면 얻어요']
      break
    case 'community_starter':
      pair = ['커뮤니티에 첫 글을 남겼어요', '커뮤니티에 첫 글을 남기면 얻어요']
      break
    case 'all_masters':
      pair = ['모든 배지를 마스터했어요', '다른 배지를 모두 마스터하면 얻어요']
      break
    case 'badge_group_master':
      pair = ['이 시리즈를 모두 모았어요', '이 시리즈의 배지를 모두 모으면 얻어요']
      break
    case 'region_visit_count':
      if (target?.region) pair = [target.region + '에서 ' + (n ?? 0) + '곳을 방문했어요', target.region + '에서 ' + (n ?? 0) + '곳을 방문하면 얻어요']
      break
    case 'category_visit_count':
      if (target?.category) pair = [target.category + ' 샵 ' + (n ?? 0) + '곳을 방문했어요', target.category + ' 샵 ' + (n ?? 0) + '곳을 방문하면 얻어요']
      break
    case 'tag_visit_percent':
      if (target?.tag) pair = [target.tag + ' 관련 샵을 ' + (pct ?? 0) + '% 방문했어요', target.tag + ' 관련 샵을 ' + (pct ?? 0) + '% 방문하면 얻어요']
      break
  }

  if (!pair) return null
  return earned ? pair[0] : pair[1]
}

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
    .select('*, badge_tiers (id, name, description, sort_order, condition_type, condition_target)')
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

  return badges.map((b: any) => {
    const tiers = [...(b.badge_tiers ?? [])].sort((x: any, y: any) => (x.sort_order ?? 0) - (y.sort_order ?? 0))
    const owned = tiers.some((t: any) => earnedTierIds.has(t.id))
    // 아직 못 딴 첫 단계를 다음 목표로. 다 땄으면 마지막 단계 설명.
    const nextTier = tiers.find((t: any) => !earnedTierIds.has(t.id)) ?? tiers[tiers.length - 1]
    return {
      id: b.id,
      slug: b.slug,
      name: b.name,
      iconUrl: b.icon_url,
      owned,
      hint: tierHintFromCondition(nextTier?.condition_type ?? null, nextTier?.condition_target, earnedTierIds.has(nextTier?.id)) ?? nextTier?.description ?? null,
      hintTier: nextTier?.name ?? null,
      allDone: tiers.length > 0 && tiers.every((t: any) => earnedTierIds.has(t.id)),
    }
  })
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
async function getMaxCheckInStreak(userId: string, supabase: SupabaseClient<Database>): Promise<number> {
  const { data } = await supabase.from('visit_logs').select('created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(3000)
  if (!data || data.length === 0) return 0
  const days = new Set<string>()
  for (const r of data as any[]) {
    const kst = new Date(new Date(r.created_at).getTime() + 9 * 3600 * 1000)
    days.add(kst.toISOString().slice(0, 10))
  }
  const sorted = [...days].sort()
  let max = 1, cur = 1
  for (let i = 1; i < sorted.length; i++) {
    const diff = (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86400000
    if (diff === 1) { cur++; if (cur > max) max = cur } else { cur = 1 }
  }
  return max
}

async function getPostCount(userId: string, supabase: SupabaseClient<Database>): Promise<number> {
  const { count } = await supabase.from('community_posts').select('id', { count: 'exact', head: true }).eq('author_id', userId)
  return count ?? 0
}

async function getCommentCount(userId: string, supabase: SupabaseClient<Database>): Promise<number> {
  const { count } = await supabase.from('post_comments').select('id', { count: 'exact', head: true }).eq('author_id', userId)
  return count ?? 0
}

async function getLikesReceived(userId: string, supabase: SupabaseClient<Database>): Promise<number> {
  const [{ data: posts }, { data: comments }] = await Promise.all([
    supabase.from('community_posts').select('id').eq('author_id', userId),
    supabase.from('post_comments').select('id').eq('author_id', userId),
  ])
  const postIds = (posts ?? []).map((p: any) => p.id)
  const commentIds = (comments ?? []).map((c: any) => c.id)
  let total = 0
  if (postIds.length > 0) {
    const { count } = await supabase.from('post_likes').select('post_id', { count: 'exact', head: true }).in('post_id', postIds)
    total += count ?? 0
  }
  if (commentIds.length > 0) {
    const { count } = await supabase.from('comment_likes').select('comment_id', { count: 'exact', head: true }).in('comment_id', commentIds)
    total += count ?? 0
  }
  return total
}

async function getTagVisitProgress(userId: string, tag: string, targetPercent: number, client?: SupabaseClient<Database>) {
  const supabase = client ?? createClient()

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

async function getRegionVisitProgress(userId: string, region: string, count: number, client?: SupabaseClient<Database>) {
  const supabase = client ?? createClient()
  const { data } = await supabase
    .from('check_ins')
    .select('shop_id, shops!inner(region)')
    .eq('user_id', userId)
    .eq('shops.region', region)
  const visited = new Set((data ?? []).map((d: any) => d.shop_id)).size
  return { visited, total: count, percent: Math.min(100, Math.round((visited / count) * 100)) }
}

async function getCategoryVisitProgress(userId: string, category: string, count: number, client?: SupabaseClient<Database>) {
  const supabase = client ?? createClient()
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
export async function evaluateBadgeTiersForUser(userId: string, client?: SupabaseClient<Database>): Promise<string[]> {
  const supabase = client ?? createClient()
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
      const qualifies = await checkTierCondition(userId, tier, existingIds, supabase)
      if (qualifies) {
        const { error } = await supabase
          .from('user_badge_tiers')
          .insert({ user_id: userId, badge_tier_id: tier.id } as any)
        if (error) {
          console.error('[배지 지급 실패]', tier.name, error.message)
        } else {
          newlyEarned.push(tier.id)
          console.log('[배지 획득]', tier.name)
          // ⭐ 배지 보너스 XP (tier당 1회) — reward_exp 우선, 없으면 등급 기본값
          const xp = (tier as any).reward_exp ?? BADGE_XP_BY_RARITY[tier.rarity ?? 'common'] ?? 15
          if (xp > 0) {
            try { await addExpOnce(userId, xp, 'badge', 'badge', tier.id) }
            catch (e) { console.error('[배지 XP 실패]', tier.name, e) }
          }
        }
      }
    } catch (e) {
      console.error('[배지 판정 실패]', tier.name, tier.condition_type, e)
    }
  }

  return newlyEarned
}

async function checkTierCondition(userId: string, tier: any, earnedTierIds: Set<string>, supabase: SupabaseClient<Database>): Promise<boolean> {
  const type = tier.condition_type
  const target = tier.condition_target
  // ⭐ 성장 시스템 — 조건 타입은 영원히 이거 하나.
  //    새 활동이 생겨도 activity_type 값만 늘어난다.
  if (type === 'activity_count') {
    const done = await countActivity(userId, target, supabase)
    const need = target?.count ?? 1
    return done >= need
  }

  if (type === 'consecutive_days') {
    const streak = await getMaxCheckInStreak(userId, supabase)
    return streak >= (target?.count ?? 1)
  }

  if (type === 'comment_count') {
    const c = await getCommentCount(userId, supabase)
    return c >= (target?.count ?? 1)
  }

  if (type === 'community_starter') {
    const [posts, comments] = await Promise.all([getPostCount(userId, supabase), getCommentCount(userId, supabase)])
    return posts >= 1 && comments >= 1
  }

  if (type === 'likes_received') {
    const n = await getLikesReceived(userId, supabase)
    return n >= (target?.count ?? 1)
  }

  if (type === 'all_masters') {
    const { data: growthBadges } = await supabase
      .from('badges')
      .select('id, badge_groups!inner(slug)')
      .eq('badge_groups.slug', 'growth')
      .eq('is_active', true)
    const badgeIds = (growthBadges ?? []).map((b: any) => b.id)
    if (badgeIds.length === 0) return false
    const { data: gTiers } = await supabase
      .from('badge_tiers')
      .select('id, badge_id, sort_order')
      .in('badge_id', badgeIds)
      .eq('is_active', true)
      .eq('award_type', 'automatic')
    const topByBadge = new Map<string, { id: string; sort: number }>()
    for (const t of (gTiers ?? []) as any[]) {
      const cur = topByBadge.get(t.badge_id)
      if (!cur || (t.sort_order ?? 0) > cur.sort) topByBadge.set(t.badge_id, { id: t.id, sort: t.sort_order ?? 0 })
    }
    if (topByBadge.size === 0) return false
    for (const v of topByBadge.values()) {
      if (!earnedTierIds.has(v.id)) return false
    }
    return true
  }

  if (type === 'tag_visit_percent') {
    const p = await getTagVisitProgress(userId, target.tag, target.percent, supabase)
    return p.percent >= target.percent
  }

  if (type === 'region_visit_count') {
    const p = await getRegionVisitProgress(userId, target.region, target.count, supabase)
    return p.visited >= target.count
  }

  if (type === 'category_visit_count') {
    const p = await getCategoryVisitProgress(userId, target.category, target.count, supabase)
    return p.visited >= target.count
  }

  if (type === 'requires_combo') {
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