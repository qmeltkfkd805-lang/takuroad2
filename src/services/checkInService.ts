import { createClient } from '@/lib/supabase/client'
import { recordActivity } from './activityService'
import { requestBadgeEvaluation } from './badgeService'

// EXP 는 서버(/api/activity)가 정한다. 방문은 현장 증명이 없어 0 이다.

export interface CheckInResult {
  success: boolean
  error?: string
  expEarned?: number
  newTierIds?: string[]
  completedRouteIds?: string[]
}

/** ⛔ 호출부 없음. activity_logs 직접 INSERT 라 2026-09-22 이후 42501 로 실패한다. */
export async function logActivity(
  userId: string,
  type: string,
  title: string,
  link?: string,
  relatedType?: string,
  relatedId?: string
): Promise<void> {
  const supabase = createClient()
  await supabase
    .from('activity_logs')
    .insert({
      user_id: userId,
      type,
      title,
      link: link ?? null,
      related_type: relatedType ?? null,
      related_id: relatedId ?? null,
    } as any)
}

export async function createCheckIn(
  userId: string,
  shopId: string,
  shopLat: number,
  shopLng: number,
  shopName: string,
  userLat?: number | null,
  userLng?: number | null,
  shopSlug?: string
): Promise<CheckInResult> {
  const supabase = createClient()

  // 방문 기록 방식 — GPS 검증 없음. 갔다 와서 눌러도 됨.
  // 좌표가 넘어오면 참고로 저장하지만, 없어도 정상 기록.
  const hasCoords = typeof userLat === 'number' && typeof userLng === 'number'

  // 중복 방지: 같은 샵을 이미 방문 기록했으면 막지 않고 조용히 성공 처리
  const { data: existing } = await supabase
    .from('check_ins')
    .select('id')
    .eq('user_id', userId)
    .eq('shop_id', shopId)
    .maybeSingle()

  if (existing) {
    return { success: true, expEarned: 0 }   // 이미 방문한 곳 — 재기록 안 함
  }

  const { data: created, error } = await supabase
    .from('check_ins')
    .insert({
      user_id: userId,
      shop_id: shopId,
      lat: hasCoords ? userLat : null,
      lng: hasCoords ? userLng : null,
      distance_m: null,
      exp_earned: 0,                                          // 지급은 서버가 결정 — 방문은 0
      check_in_date: new Date().toISOString().slice(0, 10),   // 방문 기록일
    } as any)
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { success: true, expEarned: 0 }   // 이미 방문
    }
    return { success: false, error: '방문 기록에 실패했어요' }
  }

  // ⭐ Activity 시스템 — 기록·스냅샷·EXP 를 서버가 정한다.
  //    스냅샷("그때의 샵 이름")도 서버가 원본 행에서 만들므로 여기서 샵을 다시 읽지 않는다.
  //    현장 증명이 없어 EXP 는 0 이다 (기록만 남는다).
  const act = await recordActivity('shop_visit', created?.id, userId)

  await (supabase as any).rpc('increment_visit_count', { p_shop_id: shopId })

  const newTierIds = await requestBadgeEvaluation()

  const { recordRouteProgressOnCheckIn } = await import('./routeProgressService')
  const completedRouteIds = await recordRouteProgressOnCheckIn(userId, shopId)

  return { success: true, expEarned: act.gained, newTierIds, completedRouteIds }
}

export async function getMyCheckIns(userId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('check_ins')
    .select('id, shop_id, distance_m, created_at, shops ( name, slug, addr )')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getMyCheckInStatus(userId: string, shopId: string) {
  const supabase = createClient()
  // 방문 기록 방식: 하루 단위가 아니라 "한 번이라도 방문했나"
  const { data } = await supabase
    .from('check_ins')
    .select('id')
    .eq('user_id', userId)
    .eq('shop_id', shopId)
    .maybeSingle()
  return { checkedInToday: !!data }   // 필드명은 호환 유지 (= 이미 방문함)
}

export async function getShopCheckInCount(shopId: string): Promise<number> {
  const supabase = createClient()
  const { count } = await supabase
    .from('check_ins')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId)
  return count ?? 0
}

export async function getFirstAndLatestCheckIn(userId: string) {
  const supabase = createClient()

  const { data: first } = await supabase
    .from('check_ins')
    .select('created_at, shops ( name )')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const { data: latest } = await supabase
    .from('check_ins')
    .select('created_at, shops ( name )')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return { first, latest }
}