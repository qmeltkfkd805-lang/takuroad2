import { createClient } from '@/lib/supabase/client'

/* ============================================================
   성장 시스템 — activity_logs를 세서 "다음 목표"를 만든다

   ⭐⭐ 조건 타입은 영원히 하나: activity_count
      새 활동이 생겨도 조건 타입은 안 늘어난다. activity_type 값만 늘어난다.

   condition_target (jsonb):
   {
     "activity_type": "review",
     "count": 20,
     "distinct": "ref_id",              // 어뷰징 방지 (없으면 전체 건수)
     "where": { "region": "홍대" }       // 선택: region | work_id | event_type
   }

   ⭐⭐ distinct: 'ref_id' 가 핵심이다.
      ref_id는 "리뷰 id"가 아니라 "리뷰 대상(샵·이벤트)"이므로,
      같은 샵에 리뷰 10개를 써도 1개로 센다.
      "리뷰 20개"의 진짜 의미 = "서로 다른 20곳에 리뷰"
   ============================================================ */

export interface ActivityCountTarget {
  activity_type: string
  count: number
  distinct?: 'ref_id'
  where?: {
    region?: string
    work_id?: string
    event_type?: string
  }
}

/**
 * 조건 하나를 실제로 센다.
 *
 * ⚠️ shop_register만 예외: "아직 살아있는(active) 샵"만 센다.
 *    샵 등록은 승인 개념이 없어서, 관리자가 쓰레기 샵을 지우면
 *    카운트도 같이 빠져야 어뷰징의 대가가 사라진다.
 */
export async function countActivity(userId: string, target: ActivityCountTarget): Promise<number> {
  const supabase = createClient()

  let q = supabase
    .from('activity_logs')
    .select('related_id, snapshot, work_id')
    .eq('user_id', userId)
    .eq('type', target.activity_type)

  // work_id는 컬럼이라 DB에서 거른다
  if (target.where?.work_id) q = q.eq('work_id', target.where.work_id)

  const { data, error } = await q
  if (error) {
    console.error('[countActivity]', error.message)
    return 0
  }

  let rows = (data ?? []) as any[]

  // region·event_type은 snapshot(jsonb) 안에 있다
  if (target.where?.region) {
    rows = rows.filter(r => r.snapshot?.region === target.where!.region)
  }
  if (target.where?.event_type) {
    rows = rows.filter(r => r.snapshot?.event_type === target.where!.event_type)
  }

  // 샵 등록 — 살아있는 샵만
  if (target.activity_type === 'shop_register' && rows.length > 0) {
    const ids = [...new Set(rows.map(r => r.related_id).filter(Boolean))]
    const { data: alive } = await supabase
      .from('shops').select('id').in('id', ids).eq('status', 'active')
    const aliveSet = new Set((alive ?? []).map((s: any) => s.id))
    rows = rows.filter(r => aliveSet.has(r.related_id))
  }

  if (target.distinct === 'ref_id') {
    return new Set(rows.map(r => r.related_id).filter(Boolean)).size
  }
  return rows.length
}

/* ────────────────────────────────────────────────
   배틀패스 — "지금 도전 중인 것"
   ──────────────────────────────────────────────── */

export interface Challenge {
  badgeId: string
  badgeName: string
  tierId: string
  tierName: string
  tierIcon: string | null
  rarity: string | null
  /** 이 단계가 요구하는 행동 (리뷰 작성 · 샵 방문…) */
  verb: string
  done: number
  target: number
  pct: number
  /** 달성하면 열리는 것 — 지금은 배지. 7-4에서 코스메틱이 들어온다 */
  rewardName: string
  /** 이 시리즈에서 이미 딴 단계 수 */
  earnedCount: number
  totalTiers: number
  /** ⭐ 다음 행동 — 타쿠로드의 핵심은 사용자를 다시 밖으로 내보내는 것 */
  ctaLabel: string
  ctaHref: string
}

const VERB: Record<string, string> = {
  review: '리뷰 작성',
  photo_upload: '사진 등록',
  shop_visit: '샵 방문',
  event_visit: '이벤트 참여',
  route_completed: '루트 완주',
  route_created: '루트 제작',
  shop_register: '샵 등록',
  event_submit: '제보 채택',
}

/**
 * 다음 행동 — 목표를 보여주고 끝나면 안 된다.
 * 바로 나갈 문을 같이 열어준다.
 */
const CTA: Record<string, { label: string; href: string }> = {
  review:          { label: '다녀온 샵에 리뷰 쓰기', href: '/collection' },
  photo_upload:    { label: '사진 남길 샵 찾기',     href: '/map' },
  shop_visit:      { label: '지도에서 샵 찾기',       href: '/map' },
  event_visit:     { label: '이벤트 보러가기',        href: '/events' },
  route_completed: { label: '루트 둘러보기',          href: '/routes' },
  route_created:   { label: '내 루트 만들기',         href: '/routes' },
  shop_register:   { label: '새 샵 등록하기',         href: '/shop/new' },
  event_submit:    { label: '이벤트 제보하기',        href: '/events' },
}

/**
 * 지금 도전 중인 목표들.
 *
 * ⭐ 화면의 주인공은 배지가 아니라 "다음 목표"다.
 *    각 시리즈에서 아직 못 딴 가장 낮은 단계 하나만 꺼낸다.
 *    (Lv1·Lv2·Lv3를 다 늘어놓으면 무슨 행동을 해야 하는지가 안 보인다)
 *
 * ⭐ 이미 다 깬 시리즈는 안 보여준다. 할 일이 없는 카드는 자리만 차지한다.
 */
export async function getGrowthChallenges(userId: string): Promise<Challenge[]> {
  const supabase = createClient()

  const [tierRes, earnedRes] = await Promise.all([
    supabase
      .from('badge_tiers')
      .select('*, badges ( id, name, icon_url )')
      .eq('condition_type', 'activity_count')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('user_badge_tiers')
      .select('badge_tier_id')
      .eq('user_id', userId),
  ])

  const tiers = (tierRes.data ?? []) as any[]
  const earned = new Set((earnedRes.data ?? []).map((e: any) => e.badge_tier_id))

  // 시리즈(badge)별로 묶는다
  const byBadge = new Map<string, any[]>()
  for (const t of tiers) {
    const list = byBadge.get(t.badge_id) ?? []
    list.push(t)
    byBadge.set(t.badge_id, list)
  }

  const out: Challenge[] = []

  for (const [badgeId, list] of byBadge) {
    const sorted = [...list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const earnedCount = sorted.filter(t => earned.has(t.id)).length

    // 아직 못 딴 가장 낮은 단계 = 지금 도전 중
    const current = sorted.find(t => !earned.has(t.id))
    if (!current) continue   // 다 깼으면 안 보여준다

    const target = (current.condition_target ?? {}) as ActivityCountTarget
    const done = await countActivity(userId, target)
    const need = target.count ?? 1

    out.push({
      badgeId,
      badgeName: current.badges?.name ?? '도전',
      tierId: current.id,
      tierName: current.name ?? '',
      tierIcon: current.badges?.icon_url ?? null,
      rarity: current.rarity ?? null,
      verb: VERB[target.activity_type] ?? '활동',
      done: Math.min(done, need),
      target: need,
      pct: need > 0 ? Math.min(100, Math.round((done / need) * 100)) : 0,
      rewardName: current.name ?? '배지',
      earnedCount,
      totalTiers: sorted.length,
      ctaLabel: CTA[target.activity_type]?.label ?? '둘러보기',
      ctaHref: CTA[target.activity_type]?.href ?? '/map',
    })
  }

  // 가장 가까운 목표가 위로 — "조금만 더 하면 된다"를 먼저 보여준다
  return out.sort((a, b) => b.pct - a.pct)
}

/* ────────────────────────────────────────────────
   최근 해금한 배지 — 결과는 작게. 주인공은 "다음 목표"
   ──────────────────────────────────────────────── */

export interface EarnedBadge {
  id: string
  name: string
  icon: string | null
  rarity: string | null
  earnedAt: string
}

export async function getRecentBadges(userId: string, limit = 6): Promise<EarnedBadge[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('user_badge_tiers')
    .select('badge_tier_id, earned_at, badge_tiers ( name, rarity, badges ( icon_url ) )')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false })
    .limit(limit)

  return ((data ?? []) as any[]).map(r => ({
    id: r.badge_tier_id,
    name: r.badge_tiers?.name ?? '배지',
    icon: r.badge_tiers?.badges?.icon_url ?? null,
    rarity: r.badge_tiers?.rarity ?? null,
    earnedAt: r.earned_at,
  }))
}
/* ────────────────────────────────────────────────
   배틀패스 — 시리즈별 전체 계단

   ⭐ 컬렉션 홈이 "다음 한 걸음"이라면, 여기는 "길 전체"다.
      Lv1을 땄으면 Lv2가 열리고, Lv2를 땄으면 Lv3가 열린다.
   ──────────────────────────────────────────────── */

export interface GrowthStep {
  tierId: string
  name: string
  rarity: string | null
  target: number
  earned: boolean
  /** 지금 도전 중인 단계인가 (아직 못 딴 가장 낮은 것) */
  current: boolean
}

export interface GrowthSeries {
  badgeId: string
  badgeName: string
  icon: string | null
  verb: string
  /** 지금까지 한 횟수 (시리즈 전체가 같은 activity_type을 본다) */
  done: number
  steps: GrowthStep[]
  earnedCount: number
  ctaLabel: string
  ctaHref: string
  /** 이 시리즈를 다 깼나 */
  complete: boolean
}

export async function getGrowthSeries(userId: string): Promise<GrowthSeries[]> {
  const supabase = createClient()

  const [tierRes, earnedRes] = await Promise.all([
    supabase
      .from('badge_tiers')
      .select('*, badges ( id, name, icon_url, sort_order )')
      .eq('condition_type', 'activity_count')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('user_badge_tiers')
      .select('badge_tier_id')
      .eq('user_id', userId),
  ])

  const tiers = (tierRes.data ?? []) as any[]
  const earned = new Set((earnedRes.data ?? []).map((e: any) => e.badge_tier_id))

  const byBadge = new Map<string, any[]>()
  for (const t of tiers) {
    const list = byBadge.get(t.badge_id) ?? []
    list.push(t)
    byBadge.set(t.badge_id, list)
  }

  const out: GrowthSeries[] = []

  for (const [badgeId, list] of byBadge) {
    const sorted = [...list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const first = (sorted[0]?.condition_target ?? {}) as ActivityCountTarget

    // 시리즈 안의 계단은 전부 같은 activity_type을 본다 → 한 번만 센다
    const done = await countActivity(userId, first)

    const currentId = sorted.find(t => !earned.has(t.id))?.id ?? null

    const steps: GrowthStep[] = sorted.map(t => {
      const tg = (t.condition_target ?? {}) as ActivityCountTarget
      return {
        tierId: t.id,
        name: t.name ?? '',
        rarity: t.rarity ?? null,
        target: tg.count ?? 1,
        earned: earned.has(t.id),
        current: t.id === currentId,
      }
    })

    out.push({
      badgeId,
      badgeName: sorted[0]?.badges?.name ?? '도전',
      icon: sorted[0]?.badges?.icon_url ?? null,
      verb: VERB[first.activity_type] ?? '활동',
      done,
      steps,
      earnedCount: steps.filter(s => s.earned).length,
      ctaLabel: CTA[first.activity_type]?.label ?? '둘러보기',
      ctaHref: CTA[first.activity_type]?.href ?? '/map',
      complete: currentId === null,
    })
  }

  // 진행 중인 것 먼저, 다 깬 건 아래로
  return out.sort((a, b) => {
    if (a.complete !== b.complete) return a.complete ? 1 : -1
    return b.earnedCount - a.earnedCount
  })
}