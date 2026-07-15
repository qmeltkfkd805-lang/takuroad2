import { createClient } from '@/lib/supabase/client'
import { Challenge, GrowthSeries, getGrowthChallenges, getGrowthSeries, getRecentBadges, EarnedBadge } from '@/services/growthService'
import { Cosmetic, getMyCosmetics } from '@/services/cosmeticService'

/* 성장 센터 (/growth) — 한 화면이 필요한 모든 것

   ⭐ 화면이 쿼리를 여러 번 날리지 않게 여기서 묶는다.
      컴포넌트는 데이터를 모으는 곳이 아니라 그리는 곳이다.

   ⭐ 시안에서 뺀 것 둘:
      - LV/XP 바 → 사이드바에 이미 항상 보인다. 같은 걸 두 번 보여주지 않는다.
      - "커뮤니티" 카테고리 → 타쿠로드의 정체성은 덕질 활동이지 커뮤니티 활동이 아니다. */

/** 꾸미기 보상 진행도 — "프레임 2/7" */
export interface CosmeticProgress {
  type: string
  label: string
  got: number
  total: number
}

/** 업적 카테고리 — "탐험 3/9" */
export interface CategoryProgress {
  slug: string
  name: string
  icon: string | null
  got: number
  total: number
}

export interface GrowthCenter {
  /** 지금 도전 중 (진행률 높은 순) */
  challenges: Challenge[]
  /** 최근 해금한 배지 */
  recent: EarnedBadge[]
  /** 이번 보상 미리보기 — 지금 가장 가까운 도전이 주는 것 */
  nextReward: { cosmetic: Cosmetic; tierName: string } | null
  /** 꾸미기 보상 진행도 */
  cosmetics: CosmeticProgress[]
  /** 업적 카테고리 */
  categories: CategoryProgress[]
  /** 전체 해금 단계 */
  totalEarned: number
  totalSteps: number
}

const COSMETIC_LABEL: Record<string, string> = {
  frame: '프레임',
  background: '프로필 배경',
  title: '칭호',
  effect: '프로필 효과',
  theme: '프로필 테마',
}

const COSMETIC_ORDER = ['frame', 'background', 'title', 'effect', 'theme']

export async function getGrowthCenter(userId: string): Promise<GrowthCenter> {
  const supabase = createClient()

  const [challenges, series, recent, myCosmetics, catRes] = await Promise.all([
    getGrowthChallenges(userId),
    getGrowthSeries(userId),
    getRecentBadges(userId, 8),
    getMyCosmetics(userId),
    // 카테고리(그룹)별 배지 단계 수
    /* ⭐ 카테고리는 '그룹'이 아니라 growth 그룹 안의 '배지'다.
       탐험·이벤트·루트… 8개 시리즈가 카테고리다.
       그룹으로 가져오면 작품·카테고리 배지까지 섞인다. */
    supabase
      .from('badges')
      .select('slug, name, icon_url, sort_order, badge_tiers!inner ( id ), badge_groups!inner ( slug )')
      .eq('badge_groups.slug', 'growth')
      .eq('is_active', true)
      .eq('badge_tiers.is_active', true)
      .order('sort_order'),
  ])

  /* ── 이번 보상 미리보기 ──
     지금 가장 가까운 도전(challenges[0])이 주는 코스메틱.
     ⭐ 이게 시안의 진짜 발명이다 — 뭘 주는지 크게 보여줘야 갖고 싶어진다. */
  let nextReward: GrowthCenter['nextReward'] = null
  const top = challenges[0]
  if (top) {
    const { data: tier } = await supabase
      .from('badge_tiers')
      .select('name, reward_cosmetic_id')
      .eq('id', top.tierId)
      .maybeSingle()

    const cosId = (tier as any)?.reward_cosmetic_id
    if (cosId) {
      const c = myCosmetics.find(x => x.id === cosId)
      if (c) nextReward = { cosmetic: c, tierName: (tier as any).name ?? top.tierName }
    }
  }

  /* ── 꾸미기 보상 진행도 ── */
  const cosmetics: CosmeticProgress[] = COSMETIC_ORDER
    .map(type => {
      const all = myCosmetics.filter(c => c.type === type)
      return {
        type,
        label: COSMETIC_LABEL[type] ?? type,
        got: all.filter(c => c.unlocked).length,
        total: all.length,
      }
    })
    .filter(c => c.total > 0)

  /* ── 업적 카테고리 ── */
  const { data: earnedRows } = await supabase
    .from('user_badge_tiers')
    .select('badge_tier_id')
    .eq('user_id', userId)
  const earned = new Set((earnedRows ?? []).map((e: any) => e.badge_tier_id))

  /* 카테고리 = growth 그룹 안의 배지(탐험·이벤트…). 각 배지가 badge_tiers를 직접 가진다 */
  const categories: CategoryProgress[] = ((catRes.data ?? []) as any[])
    .map(b => {
      const tierIds: string[] = (b.badge_tiers ?? []).map((t: any) => t.id)
      return {
        slug: b.slug,
        name: b.name,
        icon: b.icon_url ?? null,
        got: tierIds.filter(id => earned.has(id)).length,
        total: tierIds.length,
      }
    })
    .filter(c => c.total > 0)

  const totalEarned = series.reduce((a, s) => a + s.earnedCount, 0)
  const totalSteps = series.reduce((a, s) => a + s.steps.length, 0)

  return { challenges, recent, nextReward, cosmetics, categories, totalEarned, totalSteps }
}
