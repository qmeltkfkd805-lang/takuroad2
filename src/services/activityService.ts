import { createClient } from '@/lib/supabase/client'

/* ============================================================
   Activity 시스템 — 타쿠로드의 덕질 연대기 기반
   activity_logs 테이블을 스냅샷 방식으로 진화시킨 것.

   ⭐⭐ 이 파일은 "모든 기록이 흘러들어오는 파이프라인"이다.
   각 서비스(checkInService·eventVisitService·routeProgressService…)는
   activity_logs에 직접 insert 하지 않는다. 반드시 여기를 거친다.
   그래야 snapshot 구조나 Story Builder 규칙이 바뀌어도 한 곳만 고치면 된다.

   원칙:
   - snapshot = 그때의 표시 정보 (불변). 원본 이름이 나중에 바뀌어도 보존
   - occurred_at = 실제 일어난 시각 (created_at과 별개)
   - work_id = 작품별 집계용 (nullable)
   - title(Legacy) = 옛 데이터 fallback 전용. 새 Activity는 snapshot 사용
   - 삭제하지 않음 (리뷰 지워도 "리뷰 20개 달성"은 남음)
   ============================================================ */

export type ActivityType =
  | 'shop_visit'
  | 'event_visit'          // 팝업·콜라보카페·전시·행사 전부 이 하나
  | 'route_completed'      // ⚠️ 'route_complete'가 아님 — 옛 완주 기록이 이 이름으로 이미 쌓여 있다
  | 'work_progress'
  | 'achievement_unlock'

/**
 * 이벤트 종류 — Activity Type이 아니라 snapshot의 값이다.
 * 아이콘·문구는 Story Builder / UI가 이걸 보고 결정한다.
 * (새 이벤트 종류가 생겨도 Activity Type은 안 늘어난다)
 */
export type ActivityEventType = 'popup' | 'collab_cafe' | 'exhibition' | 'official_event'

// 각 타입별 snapshot 형태 (그때의 표시 정보)
export interface ActivitySnapshot {
  shop_name?: string
  shop_slug?: string           // 그때의 slug — 연대기에서 샵으로 이동할 때
  place_name?: string          // 소속 장소 (스타필드 수원 등) — Story 내 그룹핑용
  event_name?: string
  event_type?: ActivityEventType   // popup · collab_cafe · exhibition · official_event
  route_name?: string
  route_token?: string         // ⚠️ 루트 상세는 /route/[token] — id가 아니라 share_token
  work_name?: string
  achievement_name?: string
  reward_name?: string
  pct?: number
  region?: string              // 덕질 지역 (홍대·수원…) — Story 묶는 기준
}

export interface CreateActivityInput {
  userId: string
  type: ActivityType
  snapshot: ActivitySnapshot
  refType?: 'shop' | 'event' | 'route' | 'work' | 'achievement'
  refId?: string
  workId?: string | null
  occurredAt?: string   // 없으면 now
}

/**
 * 스냅샷 기반 Activity 생성 — 새 Activity 시스템의 유일한 진입점.
 * 실패해도 원래 동작을 막지 않도록 조용히 처리(로그만).
 */
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
      // title은 Legacy. 새 Activity는 안 채움(snapshot이 대신).
      // 단, 구버전 피드/크로니클이 title을 직접 읽으므로 최소 호환 문자열만 넣음.
      title: buildLegacyTitle(input.type, input.snapshot),
    } as any)

  if (error) {
    console.error('createActivity error:', error)
  }
}

/** 이벤트 종류별 표시 라벨 — Legacy title 조립용 (UI는 각자 알아서) */
const EVENT_TYPE_WORD: Record<ActivityEventType, string> = {
  popup: '팝업',
  collab_cafe: '콜라보 카페',
  exhibition: '전시',
  official_event: '행사',
}

/**
 * Legacy 호환용 title 생성.
 * 기존 chronicleService·ActivityFeed가 title을 직접 읽으므로,
 * snapshot 기반 UI로 완전히 옮기기 전까지 최소한의 문자열을 채워둔다.
 * (새 타임라인은 이 title이 아니라 type+snapshot으로 문구를 조립한다)
 */
function buildLegacyTitle(type: ActivityType, s: ActivitySnapshot): string {
  switch (type) {
    case 'shop_visit':   return `${s.shop_name ?? '샵'} 방문`
    case 'event_visit': {
      const word = s.event_type ? EVENT_TYPE_WORD[s.event_type] : '이벤트'
      return `${s.event_name ?? word} 참여`
    }
    case 'route_completed': return `${s.route_name ?? '루트'} 완주`
    case 'work_progress':   return `${s.work_name ?? '작품'} ${s.pct ?? 0}% 달성`
    case 'achievement_unlock': return `${s.achievement_name ?? '업적'} 달성`
    default: return '활동'
  }
}

/** 샵 방문 Activity — checkInService에서 호출 */
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
 * 이벤트 참여 Activity — eventVisitService에서 호출.
 * 콜라보 카페도 여기로 온다 (구분은 snapshot.event_type).
 *
 * ⭐ occurredAt은 "기록한 날"이 아니라 "다녀온 날"이다.
 *    작년 팝업을 오늘 기록해도 연대기에는 작년 그 자리에 꽂혀야 한다.
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
 * 루트 완주 Activity — routeProgressService에서 호출.
 *
 * ⚠️ 타입 이름은 'route_completed' 그대로 둔다.
 *    옛 완주 기록이 이 이름으로 이미 쌓여 있어서, 바꾸면 과거가 끊긴다.
 *    ("깨지지 않게 진화한다" — 이름은 유지하고 안을 채운다)
 *
 * ⭐ region = 루트 샵들의 대표 덕질지역.
 *    그래야 그날 그 지역 Story 안에 완주가 함께 들어간다.
 *    (루트만 따로 떨어지면 그날의 기록이 끊긴다)
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

/** 작품 진행률 마일스톤 Activity — 방문 후 진행률이 25/50/75/100 넘으면 */
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

/**
 * 진행률이 마일스톤을 "넘었는지" 판정.
 * 이전 진행률(before)과 현재(after)를 받아, 그 사이에 낀 마일스톤을 반환.
 * 예: before 40, after 55 → [50]. before 0, after 100 → [25,50,75,100]
 */
export function crossedMilestones(before: number, after: number): number[] {
  return MILESTONES.filter(m => before < m && after >= m)
}


/**
 * 작품 진행률 마일스톤 체크 & Activity 생성.
 * 방문/작품선택 직후 호출 — 진행률이 25/50/75/100을 새로 넘었으면 Activity 생성.
 *
 * 중복 방지: 같은 작품의 같은 마일스톤은 한 번만 기록.
 * (이미 그 pct의 work_progress Activity가 있으면 skip)
 *
 * ⚠️ 지금은 "샵" 기준으로만 센다. 이벤트·루트까지 넣는 4축 확장은 6-5.
 */
export async function checkWorkMilestone(userId: string, workId: string): Promise<void> {
  const supabase = createClient()

  // 1) 이 작품을 취급하는 전체 샵
  const { data: tagShops } = await supabase
    .from('shop_tags')
    .select('shop_id')
    .eq('tag_id', workId)

  const totalShopIds = new Set((tagShops ?? []).map((r: any) => r.shop_id))
  const total = totalShopIds.size
  if (total === 0) return

  // 2) 그중 내가 방문한 샵
  const { data: visits } = await supabase
    .from('check_ins')
    .select('shop_id')
    .eq('user_id', userId)

  const visited = (visits ?? []).filter((v: any) => totalShopIds.has(v.shop_id)).length
  const pct = Math.round((visited / total) * 100)

  // 3) 넘어선 마일스톤 중 가장 높은 것
  const reached = MILESTONES.filter(m => pct >= m)
  if (reached.length === 0) return
  const current = reached[reached.length - 1]

  // 4) 이미 기록된 마일스톤인지 확인 (중복 방지)
  const { data: existing } = await supabase
    .from('activity_logs')
    .select('id, snapshot')
    .eq('user_id', userId)
    .eq('type', 'work_progress')
    .eq('work_id', workId)

  const recordedPcts = new Set(
    (existing ?? []).map((r: any) => r.snapshot?.pct).filter((p: any) => typeof p === 'number')
  )
  if (recordedPcts.has(current)) return   // 이미 기록됨

  // 5) 작품 이름 (스냅샷용 — 그때의 이름)
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
