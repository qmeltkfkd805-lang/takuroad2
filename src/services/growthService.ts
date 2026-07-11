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
    })
  }

  // 가장 가까운 목표가 위로 — "조금만 더 하면 된다"를 먼저 보여준다
  return out.sort((a, b) => b.pct - a.pct)
}
