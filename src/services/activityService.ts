import { createClient } from '@/lib/supabase/client'

/* ============================================================
   Activity 시스템 — 타쿠로드의 덕질 기록 원장

   ⭐⭐ 이 파일은 "모든 기록이 흘러들어오는 파이프라인"이다.
   각 서비스는 activity_logs에 직접 insert 하지 않는다. 반드시 여기를 거친다.

   ⭐⭐ activity_logs = 덕질 기록의 원장. 댓글·좋아요는 안 들어온다(커뮤니티 활동).
      기준: "내가 덕질한 흔적인가?"

   ⭐⭐ "Activity에 기록한다"와 "업적 조건으로 쓴다"는 분리한다.
      원장은 다 담고, 성장 시스템(badge_tiers)이 그중 골라 쓴다.
      루트 제작을 배지로 안 만들면 그냥 배지 행을 안 만들면 된다 —
      활동은 이미 쌓여 있으니 나중에 행 하나 추가하면 그때부터 소급 계산된다.

   원칙:
   - snapshot = 그때의 표시 정보 (불변). 원본 이름이 바뀌어도 보존
   - occurred_at = 실제 일어난 시각 (created_at과 별개)
   - work_id = 작품별 집계용 (nullable)
   - title(Legacy) = 옛 데이터 fallback 전용
   - 삭제하지 않음 (리뷰 지워도 "리뷰 20개 달성"은 남음)
   ============================================================ */

export type ActivityType =
  // ── 다녀온 기록 (연대기에 뜬다 = storyBuilder의 STORY_TYPES) ──
  | 'shop_visit'
  | 'event_visit'          // 팝업·콜라보카페·전시·행사 전부 이 하나
  | 'route_completed'      // 'route_complete'가 아님 — 옛 완주 기록이 이 이름으로 쌓여 있다
  // ── 남긴 기록 (7-1, 성장 시스템용 — 연대기엔 안 뜬다) ──
  | 'review'               // 샵 리뷰 + 이벤트 후기. ref = 리뷰 "대상"(샵/이벤트)
  | 'photo_upload'         // 리뷰에 사진 첨부
  | 'shop_register'        // 샵 등록 (현재는 등록 즉시 — 승인 시스템 생기면 그때로)
  | 'event_submit'         // 이벤트 제보 (승인될 때 — 채택돼야 성취다)
  | 'route_created'
  | 'work_register'        // 작품(IP) 등록 — ref_id = tag id        // 내가 만든 덕질 코스
  // ── 시스템이 만드는 것 ──
  | 'work_progress'
  | 'achievement_unlock'

export type ActivityEventType = 'popup' | 'collab_cafe' | 'exhibition' | 'official_event'

export interface ActivitySnapshot {
  shop_name?: string
  shop_slug?: string
  place_name?: string
  event_name?: string
  event_type?: ActivityEventType
  route_name?: string
  route_token?: string         // 루트 상세는 /route/[token] — id 아님
  work_name?: string
  achievement_name?: string
  reward_name?: string
  pct?: number
  region?: string
  review_id?: string           // 리뷰 본문 id (ref_id는 "리뷰 대상"이라 따로 둔다)
  photo_count?: number

  /* 작품 등록 */
  work_slug?: string
  ip_type?: string | null
}

export interface CreateActivityInput {
  userId: string
  type: ActivityType
  snapshot: ActivitySnapshot
  refType?: 'shop' | 'event' | 'route' | 'work' | 'achievement'
  refId?: string
  workId?: string | null
  occurredAt?: string
}

/** 스냅샷 기반 Activity 생성 — 유일한 진입점. 실패해도 원래 동작을 막지 않는다. */
export async function createActivity(input: CreateActivityInput): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('activity_logs')
    .insert({
      user_id: input.userId,
      type: input.type,
      snapshot: input.snapshot,
      related_type: input.refType ?? null,
      related_id: input.refId ?? null,
      work_id: input.workId ?? null,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      title: buildLegacyTitle(input.type, input.snapshot),
    } as any)

  if (error) {
    console.error('createActivity error:', error)
    return
  }

  // ⭐ XP 지급 — createActivity가 XP의 중심. 활동 타입별로 한 번만(addExpOnce).
  //    (fire-and-forget: 실패해도 기록·배지에 영향 없음)
  import('./expService')
    .then(async ({ XP_RULES, WORK_PROGRESS_XP, addExp, addExpOnce }) => {
      const rule = XP_RULES[input.type]
      if (!rule) return
      if (input.type === 'work_progress') {
        // 마일스톤별 XP. 마일스톤 활동은 업스트림(checkWorkMilestone)에서 1회만 생성됨 → once 불필요.
        const pct = input.snapshot.pct
        const xp = pct ? WORK_PROGRESS_XP[pct] : undefined
        if (xp && input.workId) {
          await addExp(input.userId, xp, 'work_progress', 'work', input.workId)
        }
        return
      }
      if (rule.baseXp > 0) {
        await addExpOnce(input.userId, rule.baseXp, input.type, input.refType, input.refId)
      }
    })
    .catch(e => console.error('[XP 지급 실패]', e))

  // ⭐⭐ 모든 기록이 여기를 지나간다 → 배지 평가도 여기서 한 번만.
  //    새 활동이 생겨도 평가 호출을 따로 붙일 필요가 없다.
  //    사용자를 기다리게 하지 않는다 (실패해도 기록은 이미 남았다)
  import('./badgeService')
    .then(m => m.evaluateBadgeTiersForUser(input.userId))
    .then(async newTiers => {
      // ⭐ 딴 순간이 가장 기분 좋은 순간이다. 그냥 흘려보내지 않는다.
      if (newTiers && newTiers.length > 0) {
        const { announceUnlock } = await import('./unlockService')
        announceUnlock(newTiers)
      }
    })
    .catch(e => console.error('[배지 평가 실패]', e))
}

const EVENT_TYPE_WORD: Record<ActivityEventType, string> = {
  popup: '팝업',
  collab_cafe: '콜라보 카페',
  exhibition: '전시',
  official_event: '행사',
}

/** Legacy 호환용 title — 옛 화면(마이페이지 활동 피드)이 title을 직접 읽는다 */
function buildLegacyTitle(type: ActivityType, s: ActivitySnapshot): string {
  switch (type) {
    case 'shop_visit': return (s.shop_name ?? '샵') + ' 방문'
    case 'event_visit': {
      const word = s.event_type ? EVENT_TYPE_WORD[s.event_type] : '이벤트'
      return (s.event_name ?? word) + ' 참여'
    }
    case 'route_completed': return (s.route_name ?? '루트') + ' 완주'
    case 'review':          return (s.shop_name ?? s.event_name ?? '') + ' 리뷰 작성'
    case 'photo_upload':    return '사진 ' + (s.photo_count ?? 1) + '장 등록'
    case 'shop_register':   return (s.shop_name ?? '샵') + ' 등록'
    case 'event_submit':    return (s.event_name ?? '이벤트') + ' 제보 채택'
    case 'route_created':   return (s.route_name ?? '루트') + ' 제작'
    case 'work_progress':   return (s.work_name ?? '작품') + ' ' + (s.pct ?? 0) + '% 달성'
    case 'achievement_unlock': return (s.achievement_name ?? '업적') + ' 달성'
    default: return '활동'
  }
}

/* ────────────────────────────────────────────────
   읽기 — 내 최근 활동 (홈 우측 레일 등)
   ──────────────────────────────────────────────── */
export interface RecentActivity {
  id: string
  type: ActivityType
  title: string
  href: string | null
  icon: string
  occurredAt: string
}

const ACT_ICON: Partial<Record<ActivityType, string>> = {
  shop_visit: 'checkin', event_visit: 'event', route_completed: 'route',
  review: 'star', photo_upload: 'star', shop_register: 'shop',
  event_submit: 'event', route_created: 'route', work_register: 'heart',
  work_progress: 'heart', achievement_unlock: 'star',
}

function activityHref(type: ActivityType, s: ActivitySnapshot, relatedId: string | null): string | null {
  switch (type) {
    case 'shop_visit': case 'review': case 'shop_register':
      return s.shop_slug ? `/shop/${s.shop_slug}` : null
    case 'event_visit': case 'event_submit':
      return relatedId ? `/event/${relatedId}` : null
    case 'route_completed': case 'route_created':
      return s.route_token ? `/route/${s.route_token}` : null
    case 'work_register': case 'work_progress':
      return s.work_slug ? `/work/${s.work_slug}` : null
    default: return null
  }
}

/** 내 최근 활동 — activity_logs 원장 기준(방문·완주·리뷰·사진·루트제작·샵/작품등록·업적).
 *  좋아요·댓글은 원장에 없어 제외된다. */
function validDate(v: any): string | null {
  if (!v) return null
  const t = new Date(v).getTime()
  return Number.isNaN(t) ? null : v
}

export async function getMyRecentActivities(userId: string, limit = 5): Promise<RecentActivity[]> {
  const supabase = createClient()
  // created_at 기준(occurred_at은 비어있는 행이 있어 연대기와 동일하게 created_at 사용)
  const { data, error } = await supabase
    .from('activity_logs')
    .select('id, type, snapshot, title, related_id, occurred_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) { console.error('[getMyRecentActivities]', error.message); return [] }
  return (data ?? []).map((r: any) => {
    const s = (r.snapshot ?? {}) as ActivitySnapshot
    const when = validDate(r.created_at) ?? validDate(r.occurred_at)
    return {
      id: r.id,
      type: r.type,
      title: (r.title && String(r.title).trim()) || buildLegacyTitle(r.type, s) || '활동',
      href: activityHref(r.type, s, r.related_id),
      icon: ACT_ICON[r.type as ActivityType] ?? 'star',
      occurredAt: when ?? '',
    }
  })
}

/* ────────────────────────────────────────────────
   다녀온 기록 (연대기에 뜬다)
   ──────────────────────────────────────────────── */

/** 샵 방문 — checkInService에서 호출 */
export async function recordShopVisitActivity(params: {
  userId: string
  shopId: string
  shopName: string
  shopSlug?: string | null
  region?: string | null
  placeName?: string | null
  workId?: string | null
  workName?: string | null
  occurredAt?: string
}): Promise<void> {
  await createActivity({
    userId: params.userId,
    type: 'shop_visit',
    snapshot: {
      shop_name: params.shopName,
      shop_slug: params.shopSlug ?? undefined,
      place_name: params.placeName ?? undefined,
      region: params.region ?? undefined,
      work_name: params.workName ?? undefined,
    },
    refType: 'shop',
    refId: params.shopId,
    workId: params.workId ?? null,
    occurredAt: params.occurredAt,
  })
}

/**
 * 이벤트 참여 — eventVisitService에서 호출. 콜라보 카페도 여기로 온다.
 * ⭐ occurredAt은 "기록한 날"이 아니라 "다녀온 날"이다.
 */
export async function recordEventVisitActivity(params: {
  userId: string
  eventId: string
  eventName: string
  eventType: ActivityEventType
  region?: string | null
  placeName?: string | null
  workId?: string | null
  workName?: string | null
  occurredAt?: string
}): Promise<void> {
  await createActivity({
    userId: params.userId,
    type: 'event_visit',
    snapshot: {
      event_name: params.eventName,
      event_type: params.eventType,
      place_name: params.placeName ?? undefined,
      region: params.region ?? undefined,
      work_name: params.workName ?? undefined,
    },
    refType: 'event',
    refId: params.eventId,
    workId: params.workId ?? null,
    occurredAt: params.occurredAt,
  })
}

/**
 * 루트 완주 — routeProgressService에서 호출.
 * ⚠️ 타입 이름 'route_completed' 유지 (옛 기록이 이 이름으로 쌓여 있다)
 * ⭐ region = 루트 샵들의 대표 덕질지역 → 그날 그 지역 Story에 합류
 */
export async function recordRouteCompleteActivity(params: {
  userId: string
  routeId: string
  routeName: string
  routeToken?: string | null
  region?: string | null
  workId?: string | null
  workName?: string | null
  occurredAt?: string
}): Promise<void> {
  await createActivity({
    userId: params.userId,
    type: 'route_completed',
    snapshot: {
      route_name: params.routeName,
      route_token: params.routeToken ?? undefined,
      region: params.region ?? undefined,
      work_name: params.workName ?? undefined,
    },
    refType: 'route',
    refId: params.routeId,
    workId: params.workId ?? null,
    occurredAt: params.occurredAt,
  })
}

/* ────────────────────────────────────────────────
   남긴 기록 (7-1 — 성장 시스템용, 연대기엔 안 뜬다)

   ⭐⭐ ref_id는 "리뷰 id"가 아니라 "리뷰 대상(샵·이벤트)"이다.
      성장 카운터가 distinct ref_id로 세면
      같은 샵에 리뷰 10개 써도 1개 → 어뷰징이 원천 차단된다.
      "리뷰 20개"의 진짜 의미 = "서로 다른 20곳에 리뷰"
   ──────────────────────────────────────────────── */

/** 리뷰 작성 — 샵 리뷰(reviewService) / 이벤트 후기(eventReviewService) 공용 */
export async function recordReviewActivity(params: {
  userId: string
  targetType: 'shop' | 'event'
  targetId: string
  targetName: string
  targetSlug?: string | null
  reviewId?: string | null
  eventType?: ActivityEventType
  region?: string | null
  workId?: string | null
  workName?: string | null
}): Promise<void> {
  const isShop = params.targetType === 'shop'
  await createActivity({
    userId: params.userId,
    type: 'review',
    snapshot: {
      shop_name: isShop ? params.targetName : undefined,
      shop_slug: isShop ? (params.targetSlug ?? undefined) : undefined,
      event_name: isShop ? undefined : params.targetName,
      event_type: isShop ? undefined : params.eventType,
      review_id: params.reviewId ?? undefined,
      region: params.region ?? undefined,
      work_name: params.workName ?? undefined,
    },
    refType: params.targetType,
    refId: params.targetId,
    workId: params.workId ?? null,
  })
}

/** 사진 등록 — 리뷰에 사진을 붙였을 때. ref = 사진이 붙은 대상(샵) */
export async function recordPhotoActivity(params: {
  userId: string
  shopId: string
  shopName?: string | null
  shopSlug?: string | null
  reviewId?: string | null
  count: number
  region?: string | null
}): Promise<void> {
  if (params.count <= 0) return
  await createActivity({
    userId: params.userId,
    type: 'photo_upload',
    snapshot: {
      shop_name: params.shopName ?? undefined,
      shop_slug: params.shopSlug ?? undefined,
      review_id: params.reviewId ?? undefined,
      photo_count: params.count,
      region: params.region ?? undefined,
    },
    refType: 'shop',
    refId: params.shopId,
  })
}

/**
 * 샵 등록 — shopService.createShop에서 호출.
 * ⚠️ 지금은 등록 즉시 active라 "승인 시점"이 없다. 그래서 등록 시 기록한다.
 *    대신 성장 카운터는 "아직 살아있는(active) 샵"만 센다 →
 *    관리자가 중복·쓰레기 샵을 지우면 카운트도 빠져 어뷰징의 대가가 사라진다.
 *    나중에 검수 시스템이 생기면 승인 시점으로 옮긴다.
 */
export async function recordShopRegisterActivity(params: {
  userId: string
  shopId: string
  shopName: string
  shopSlug?: string | null
  region?: string | null
  placeName?: string | null
}): Promise<void> {
  await createActivity({
    userId: params.userId,
    type: 'shop_register',
    snapshot: {
      shop_name: params.shopName,
      shop_slug: params.shopSlug ?? undefined,
      place_name: params.placeName ?? undefined,
      region: params.region ?? undefined,
    },
    refType: 'shop',
    refId: params.shopId,
  })
}

/**
 * 이벤트 제보 채택 — eventSubmissionService.approveSubmission에서 호출.
 * ⭐ userId = 검수자가 아니라 "제보한 사람". 성취는 제보자의 것이다.
 * ⭐ 승인될 때만 기록 = 채택돼야 성취다 (제출은 그냥 클릭)
 */
export async function recordEventSubmitActivity(params: {
  userId: string
  eventId: string
  eventName: string
  eventType?: ActivityEventType
  region?: string | null
  workId?: string | null
  workName?: string | null
}): Promise<void> {
  await createActivity({
    userId: params.userId,
    type: 'event_submit',
    snapshot: {
      event_name: params.eventName,
      event_type: params.eventType,
      region: params.region ?? undefined,
      work_name: params.workName ?? undefined,
    },
    refType: 'event',
    refId: params.eventId,
    workId: params.workId ?? null,
  })
}

/** 루트 제작 — routeService.createRoute에서 호출. "내가 만든 덕질 코스" */
export async function recordRouteCreatedActivity(params: {
  userId: string
  routeId: string
  routeName: string
  routeToken?: string | null
  region?: string | null
  workId?: string | null
  workName?: string | null
}): Promise<void> {
  await createActivity({
    userId: params.userId,
    type: 'route_created',
    snapshot: {
      route_name: params.routeName,
      route_token: params.routeToken ?? undefined,
      region: params.region ?? undefined,
      work_name: params.workName ?? undefined,
    },
    refType: 'route',
    refId: params.routeId,
    workId: params.workId ?? null,
  })
}

/* ────────────────────────────────────────────────
   시스템이 만드는 것
   ──────────────────────────────────────────────── */

/** 작품 진행률 마일스톤 Activity */
export async function recordWorkMilestoneActivity(params: {
  userId: string
  workId: string
  workName: string
  pct: number
}): Promise<void> {
  await createActivity({
    userId: params.userId,
    type: 'work_progress',
    snapshot: { work_name: params.workName, pct: params.pct },
    refType: 'work',
    refId: params.workId,
    workId: params.workId,
  })
}

const MILESTONES = [25, 50, 75, 100]

/** 진행률이 마일스톤을 "넘었는지" 판정 */
export function crossedMilestones(before: number, after: number): number[] {
  return MILESTONES.filter(m => before < m && after >= m)
}

/**
 * 작품 진행률 마일스톤 체크 & Activity 생성.
 * 중복 방지: 같은 작품의 같은 마일스톤은 한 번만.
 * ⚠️ 지금은 "샵" 기준으로만 센다.
 */
export async function checkWorkMilestone(userId: string, workId: string): Promise<void> {
  const supabase = createClient()

  const { data: tagShops } = await supabase
    .from('shop_tags')
    .select('shop_id')
    .eq('tag_id', workId)

  const totalShopIds = new Set((tagShops ?? []).map((r: any) => r.shop_id))
  const total = totalShopIds.size
  if (total === 0) return

  const { data: visits } = await supabase
    .from('check_ins')
    .select('shop_id')
    .eq('user_id', userId)

  const visited = (visits ?? []).filter((v: any) => totalShopIds.has(v.shop_id)).length
  const pct = Math.round((visited / total) * 100)

  const reached = MILESTONES.filter(m => pct >= m)
  if (reached.length === 0) return
  const current = reached[reached.length - 1]

  const { data: existing } = await supabase
    .from('activity_logs')
    .select('id, snapshot')
    .eq('user_id', userId)
    .eq('type', 'work_progress')
    .eq('work_id', workId)

  const recordedPcts = new Set(
    (existing ?? []).map((r: any) => r.snapshot?.pct).filter((p: any) => typeof p === 'number')
  )
  if (recordedPcts.has(current)) return

  const { data: tag } = await supabase
    .from('tags')
    .select('name')
    .eq('id', workId)
    .maybeSingle()

  await recordWorkMilestoneActivity({
    userId,
    workId,
    workName: (tag as any)?.name ?? '작품',
    pct: current,
  })
}
