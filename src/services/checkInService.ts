import { createClient } from '@/lib/supabase/client'
import { recordActivity } from './activityService'
import { requestBadgeEvaluation } from './badgeService'

// EXP 는 서버(/api/activity)가 정한다. 방문은 현장 증명이 없어 0 이다.

/* 방문은 하루 1번까지 기록된다(같은 샵 다른 날 = +1). 날짜는 한국 기준 — DB 트리거도 한국 날짜로 덮어쓴다.
   SQL: migrations/visit_counts.sql */
export function kstToday(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
}

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

  // 중복 방지: 오늘 이미 이 샵을 기록했으면 조용히 성공 처리 (다른 날이면 새로 기록 = 방문 횟수 +1)
  const today = kstToday()
  const { data: existing } = await supabase
    .from('check_ins')
    .select('id')
    .eq('user_id', userId)
    .eq('shop_id', shopId)
    .eq('check_in_date', today)
    .limit(1)

  if (existing && existing.length > 0) {
    return { success: true, expEarned: 0 }   // 오늘 이미 기록 — 재기록 안 함
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
      check_in_date: today,                                   // 방문 기록일(한국). DB 트리거가 다시 정한다
    } as any)
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { success: true, expEarned: 0 }   // 오늘 이미 방문
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

/** 이 샵 내 방문 상태 — 오늘 기록했는지 + 지금까지 몇 번(날) 왔는지 + 마지막 방문일 */
export async function getMyCheckInStatus(userId: string, shopId: string): Promise<{ checkedInToday: boolean; count: number; lastDate: string | null }> {
  const supabase = createClient()
  const { data } = await supabase
    .from('check_ins')
    .select('check_in_date, created_at')
    .eq('user_id', userId)
    .eq('shop_id', shopId)
    .order('check_in_date', { ascending: false })
  const rows = (data ?? []) as any[]
  const days = new Set(rows.map(r => r.check_in_date ?? String(r.created_at ?? '').slice(0, 10)))
  const lastDate = rows[0]?.check_in_date ?? (rows[0]?.created_at ? String(rows[0].created_at).slice(0, 10) : null)
  return { checkedInToday: days.has(kstToday()), count: days.size, lastDate }
}

/** 내가 방문한 샵별 방문 횟수·마지막 방문일 { shopId: { count, lastDate } } */
export async function getMyVisitCounts(userId: string): Promise<Record<string, { count: number; lastDate: string | null }>> {
  const supabase = createClient()
  const { data } = await supabase.from('check_ins').select('shop_id, check_in_date, created_at').eq('user_id', userId)
  const out: Record<string, { days: Set<string>; last: string | null }> = {}
  for (const r of (data ?? []) as any[]) {
    const d = r.check_in_date ?? String(r.created_at ?? '').slice(0, 10)
    const o = (out[r.shop_id] ??= { days: new Set(), last: null })
    o.days.add(d)
    if (!o.last || d > o.last) o.last = d
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { count: v.days.size, lastDate: v.last }]))
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