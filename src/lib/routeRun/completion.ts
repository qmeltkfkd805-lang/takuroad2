/* 루트 완주 기록 — 서버 전용.
 *
 *   · 완주 조건은 서버가 직접 대조한다. 클라이언트가 보낸 사용자·검증 상태·EXP 는 믿지 않는다.
 *   · GPS 검증 완주만 EXP 15 와 배지 집계에 들어간다 (snapshot.verified = 'gps').
 *   · 비GPS 완주는 기록만 남는다 (EXP 0, snapshot.verified = 'manual').
 *   · verification_source 는 service_role 만 쓸 수 있다
 *     (authenticated 는 route_completions INSERT 권한 없음, UPDATE 정책 없음).
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface CompletionOutcome {
  recorded: boolean
  rewarded: boolean
  gained: number
}

const EMPTY: CompletionOutcome = { recorded: false, rewarded: false, gained: 0 }
const ROUTE_COMPLETED_XP = 15

/** 루트에 속한 샵 id (필수 방문지) */
export async function loadRouteShopIds(svc: SupabaseClient, routeId: string): Promise<string[]> {
  const { data } = await svc.from('route_shops').select('shop_id').eq('route_id', routeId)
  return [...new Set(((data ?? []) as any[]).map(r => r.shop_id).filter(Boolean))]
}

/** 스냅샷은 서버가 원본 행에서 만든다 */
async function buildSnapshot(svc: SupabaseClient, routeId: string, verified: 'gps' | 'manual') {
  const { data } = await svc.from('routes').select('title, share_token').eq('id', routeId).maybeSingle()
  const r = data as any
  const snap: Record<string, string> = { verified }
  if (r?.title) snap.route_name = r.title
  if (r?.share_token) snap.route_token = r.share_token
  return snap
}

async function findCompletionId(svc: SupabaseClient, userId: string, routeId: string): Promise<string | null> {
  const { data } = await svc.from('route_completions')
    .select('id').eq('route_id', routeId).eq('user_id', userId).maybeSingle()
  return (data as any)?.id ?? null
}

function toOutcome(data: unknown): CompletionOutcome {
  const row = (Array.isArray(data) ? data[0] : data) as any
  if (!row) return EMPTY
  return { recorded: !!row.recorded, rewarded: !!row.rewarded, gained: Number(row.gained) || 0 }
}

/** 비GPS 완주 — route_progress 로 필수 방문지 충족을 서버가 확인한 뒤에만 기록한다. EXP 0. */
export async function recordManualCompletion(
  svc: SupabaseClient, userId: string, routeId: string,
): Promise<CompletionOutcome | { error: string }> {
  const shopIds = await loadRouteShopIds(svc, routeId)
  if (shopIds.length === 0) return { error: 'route_empty' }

  const { data: prog } = await svc.from('route_progress')
    .select('shop_id').eq('route_id', routeId).eq('user_id', userId)
  const visited = new Set(((prog ?? []) as any[]).map(p => p.shop_id))
  if (!shopIds.every(id => visited.has(id))) return { error: 'not_completed' }

  // 완주 행이 이미 있으면 그대로 쓴다. GPS 로 올라간 행을 manual 로 내리지 않는다.
  const existingId = await findCompletionId(svc, userId, routeId)
  let completionId = existingId
  let verified: 'gps' | 'manual' = 'manual'

  if (existingId) {
    const { data: ex } = await svc.from('route_completions')
      .select('verification_source').eq('id', existingId).maybeSingle()
    if ((ex as any)?.verification_source === 'gps_session') verified = 'gps'
  } else {
    const { data: created } = await svc.from('route_completions')
      .insert({ route_id: routeId, user_id: userId } as any).select('id').single()
    completionId = (created as any)?.id ?? await findCompletionId(svc, userId, routeId)
  }
  if (!completionId) return { error: 'completion_failed' }

  const { data, error } = await svc.rpc('record_activity_reward', {
    p_user: userId, p_type: 'route_completed', p_source_id: completionId,
    p_snapshot: await buildSnapshot(svc, routeId, verified), p_title: null, p_work_id: null,
  } as any)
  if (error) {
    console.error('[route completion] rpc', error.code, error.message)
    return { error: 'reward_failed' }
  }
  return toOutcome(data)
}

/** GPS 검증 완주 — 세션 검증은 호출자(endSession)가 끝낸 뒤에만 부른다. */
export async function recordGpsCompletion(
  svc: SupabaseClient, userId: string, routeId: string,
): Promise<CompletionOutcome> {
  const snapshot = await buildSnapshot(svc, routeId, 'gps')

  const { data, error } = await svc.rpc('record_gps_route_completion', {
    p_user: userId, p_route: routeId, p_snapshot: snapshot, p_title: null,
  } as any)
  if (error) {
    console.error('[gps completion] rpc', error.code, error.message)
    return EMPTY
  }
  const out = toOutcome(data)
  if (out.recorded) return out

  /* 이미 활동 기록이 있는 경우 — 버튼으로 먼저 완주해 둔 루트를 나중에 GPS 로 완주했다.
     완주 행은 위 RPC 가 gps_session 으로 올려줬다. 기록의 verified 도 올려 배지 집계에 넣고,
     EXP 는 grant_exp 의 once 키(user, route_completed, route_id)로 한 번만 들어간다. */
  const completionId = await findCompletionId(svc, userId, routeId)
  if (completionId) {
    await svc.from('activity_logs').update({ snapshot } as any)
      .eq('user_id', userId).eq('type', 'route_completed').eq('source_id', completionId)
  }
  const { data: g, error: gErr } = await svc.rpc('grant_exp', {
    p_user_id: userId, p_amount: ROUTE_COMPLETED_XP, p_reason: 'route_completed',
    p_related_type: 'route', p_related_id: routeId, p_once: true, p_daily_cap: null,
  } as any)
  if (gErr) { console.error('[gps completion] grant_exp', gErr.message); return out }
  const row = (Array.isArray(g) ? g[0] : g) as any
  const gained = Number(row?.gained) || 0
  return { recorded: false, rewarded: gained > 0, gained }
}
