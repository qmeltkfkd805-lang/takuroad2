/* 루트 완주 기록 — 서버 전용.
 *
 *   · 완주 조건은 서버가 직접 대조한다. 클라이언트가 보낸 사용자·검증 상태·EXP 는 믿지 않는다.
 *   · GPS 검증 완주만 EXP 15 와 배지 집계에 들어간다 (snapshot.verified = 'gps').
 *   · 비GPS 완주는 기록만 남는다 (EXP 0, snapshot.verified = 'manual').
 *   · verification_source 는 service_role 만 쓸 수 있다
 *     (authenticated 는 route_completions INSERT 권한 없음, UPDATE 정책 없음).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { rowStopKey } from '@/lib/route/stopKey'

export interface CompletionOutcome {
  recorded: boolean
  rewarded: boolean
  gained: number
}

const EMPTY: CompletionOutcome = { recorded: false, rewarded: false, gained: 0 }
const ROUTE_COMPLETED_XP = 15

/** 루트의 필수 방문지 id — 샵 id, 같은 샵이 층마다 나뉘면 "샵id@층" (lib/route/stopKey) */
export async function loadRouteShopIds(svc: SupabaseClient, routeId: string): Promise<string[]> {
  const { data } = await svc.from('route_shops').select('*').eq('route_id', routeId)
  return [...new Set(((data ?? []) as any[]).filter(r => r.shop_id).map(r => rowStopKey(r)))]
}

/** 이 루트에서 이 사람이 체크한 방문지 id */
export async function loadProgressStopKeys(svc: SupabaseClient, routeId: string, userId: string): Promise<Set<string>> {
  const { data } = await svc.from('route_progress').select('*').eq('route_id', routeId).eq('user_id', userId)
  return new Set(((data ?? []) as any[]).filter(r => r.shop_id).map(r => rowStopKey(r)))
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

/* 완주 횟수 — 하루 1번까지 한 행 (route_completion_runs, SQL: migrations/visit_counts.sql).
   완주 여부·EXP·배지는 route_completions 가 그대로 맡고, 여기는 "몇 번 완주했나"만 센다.
   같은 날 GPS 로 다시 완주하면 그날 행을 gps 로 올린다(내리지는 않음). 표가 없으면 조용히 넘어간다. */
function kstToday(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
}
export async function recordCompletionRun(svc: SupabaseClient, userId: string, routeId: string, verified: 'gps' | 'manual'): Promise<void> {
  try {
    const run_date = kstToday()
    const { error } = await svc.from('route_completion_runs')
      .upsert({ route_id: routeId, user_id: userId, run_date, verified } as any, { onConflict: 'route_id,user_id,run_date', ignoreDuplicates: true })
    if (error) { console.error('[completion run]', error.code, error.message); return }
    if (verified === 'gps') {
      await svc.from('route_completion_runs').update({ verified: 'gps' } as any)
        .eq('route_id', routeId).eq('user_id', userId).eq('run_date', run_date)
    }
  } catch (e) { console.error('[completion run]', (e as Error)?.message) }
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

  const visited = await loadProgressStopKeys(svc, routeId, userId)
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
  await recordCompletionRun(svc, userId, routeId, verified)

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
  await recordCompletionRun(svc, userId, routeId, 'gps')
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
