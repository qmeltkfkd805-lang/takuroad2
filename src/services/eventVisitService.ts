import { createClient } from '@/lib/supabase/client'
import { recordEventVisitActivity, ActivityEventType } from './activityService'
import { geekAreaFromAddr } from '@/lib/utils/geekArea'

/* ============================================================
   이벤트 참여 기록 (event_visits)

   check_ins와 같은 역할 = "정확한 집계를 담당하는 원본".
   Activity는 여기서 흘러나가는 피드일 뿐이고,
   Activity 생성은 반드시 activityService를 거친다 (직접 insert 금지).

   원칙:
   - GPS 없음 / 종료 여부 안 봄 (연대기의 목적은 "그때 갔던 기억")
   - 중복은 DB가 막음 (unique user_id, event_id)
   - 이미 기록돼 있으면 조용히 성공 — Activity를 두 번 만들지 않는다
   ============================================================ */

export type EventVisitSource = 'button' | 'review'

export interface EventVisitResult {
  success: boolean
  already?: boolean      // 이미 기록돼 있었음 (Activity 재생성 안 함)
  error?: string
}

/**
 * "다녀온 날"을 정한다.
 *
 * ⭐ 기록한 날(오늘)이 아니라 다녀온 날이 연대기에 꽂혀야 한다.
 *    작년 팝업을 오늘 기록해도 연대기에서는 작년 그 자리에 있어야 하니까.
 *    정확한 날짜를 물어보진 않으므로, 오늘을 이벤트 기간 안으로 끌어당긴다.
 *      · 이미 끝난 이벤트  → 종료일
 *      · 아직 시작 전      → 시작일
 *      · 진행 중          → 오늘
 */
function resolveVisitedOn(startDate: string | null, endDate: string | null): string {
  const today = new Date().toISOString().slice(0, 10)
  if (endDate && today > endDate) return endDate
  if (startDate && today < startDate) return startDate
  return today
}

/** 날짜(YYYY-MM-DD) → occurred_at. 정오로 박아 시간대 때문에 하루 밀리는 걸 막는다 */
function toOccurredAt(day: string): string {
  return `${day}T12:00:00.000Z`
}

/**
 * 이벤트 참여 기록.
 * source='button' → 사용자가 "다녀왔어요"를 누름
 * source='review' → 후기를 썼으므로 자동 (이미 기록이 있으면 아무 일도 안 일어남)
 */
export async function recordEventVisit(
  userId: string,
  eventId: string,
  source: EventVisitSource = 'button',
): Promise<EventVisitResult> {
  const supabase = createClient()

  // 1) 이미 기록했나 — 중복 방지 (후기 자동 생성이 버튼과 겹쳐도 안전)
  const { data: existing } = await supabase
    .from('event_visits')
    .select('id')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .maybeSingle()

  if (existing) return { success: true, already: true }

  // 2) 이벤트 정보 — 스냅샷("그때의 이름")과 덕질 지역을 뽑기 위해
  const { data: ev, error: evErr } = await supabase
    .from('events')
    .select('id, title, type, tag_id, start_date, end_date, place_name, place_addr, shops ( name, addr, region, places ( name ) )')
    .eq('id', eventId)
    .maybeSingle()

  if (evErr || !ev) {
    console.error('recordEventVisit: 이벤트를 못 찾음', evErr)
    return { success: false, error: '이벤트를 찾을 수 없어요' }
  }
  const e = ev as any
  const visitedOn = resolveVisitedOn(e.start_date ?? null, e.end_date ?? null)

  // 3) 원본 기록
  const { error } = await supabase
    .from('event_visits')
    .insert({
      user_id: userId,
      event_id: eventId,
      visited_on: visitedOn,
      source,
    } as any)

  if (error) {
    if (error.code === '23505') return { success: true, already: true }   // 동시에 눌림
    console.error('recordEventVisit insert error:', error)
    return { success: false, error: '기록에 실패했어요' }
  }

  // 4) 스냅샷 재료
  //    샵에 붙은 이벤트면 샵 주소·소속 장소를, 아니면 이벤트 자체 장소를 쓴다
  const shop = e.shops ?? null
  const addr: string | null = shop?.addr ?? e.place_addr ?? null

  // ⭐ 덕질 지역 — "마포구"가 아니라 "홍대". DB region이 비어도 주소에서 뽑는다
  const region: string | null = shop?.region?.trim() || geekAreaFromAddr(addr)

  // Story 안에서 한 번 더 묶이는 장소.
  // 샵이면 그 샵이 속한 Place(스타필드 수원…), 샵이 없으면 이벤트 장소명
  const placeName: string | null = shop?.places?.name ?? e.place_name ?? null

  // 작품 이름 (그때의 이름)
  let workName: string | null = null
  if (e.tag_id) {
    const { data: tag } = await supabase
      .from('tags')
      .select('name')
      .eq('id', e.tag_id)
      .maybeSingle()
    workName = (tag as any)?.name ?? null
  }

  // 5) ⭐ Activity 파이프라인 — 직접 insert 하지 않고 activityService를 통해서만
  await recordEventVisitActivity({
    userId,
    eventId,
    eventName: e.title,
    eventType: (e.type ?? 'popup') as ActivityEventType,
    region,
    placeName,
    workId: e.tag_id ?? null,
    workName,
    occurredAt: toOccurredAt(visitedOn),
  })

  return { success: true }
}

/** 기록 취소 — 원본만 지운다. Activity는 남는다 (원칙 ② "그때 일어난 일") */
export async function removeEventVisit(userId: string, eventId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('event_visits')
    .delete()
    .eq('user_id', userId)
    .eq('event_id', eventId)
  if (error) console.error('removeEventVisit error:', error)
  return !error
}

/** 내가 이 이벤트에 다녀왔나 */
export async function getMyEventVisit(userId: string, eventId: string): Promise<boolean> {
  const supabase = createClient()
  const { data } = await supabase
    .from('event_visits')
    .select('id')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .maybeSingle()
  return !!data
}

/** 이 이벤트에 다녀간 사람 수 */
export async function getEventVisitCount(eventId: string): Promise<number> {
  const supabase = createClient()
  const { count, error } = await supabase
    .from('event_visits')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
  if (error) { console.error('getEventVisitCount error:', error); return 0 }
  return count ?? 0
}

/** 내가 다녀온 이벤트 전체 (작품별 진행률 4축 확장(6-5)에서 쓴다) */
export async function getMyEventVisits(userId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('event_visits')
    .select('event_id, visited_on, events ( id, title, type, tag_id )')
    .eq('user_id', userId)
    .order('visited_on', { ascending: false })
  if (error) { console.error('getMyEventVisits error:', error); return [] }
  return data ?? []
}
