/* 루트 진행 세션 서비스 — 생성/조회/상태전이/수동기록/취소/ping/종료.
   Service Role 클라이언트를 받아 서버에서만 실행. userId는 핸들러가 인증한 값(클라이언트 신뢰 안 함).
   기존 route_progress/route_completions/EXP는 '정상 종료' 시에만 반영. */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { OrderedStop, VerifyConfig } from './types'
import { deriveCheckpoints } from './checkpoints'
import { evaluatePing, type CheckpointState, type PrevVerified } from './verification'
import { grantCompletionRewards } from './rewardService'

const VERIFIED = new Set(['proximity_verified', 'checkpoint_verified', 'qr_verified'])
const ACTIVE = new Set(['active', 'paused'])
const nowIso = () => new Date().toISOString()

interface StoredCheckpoint {
  key: string; kind: 'building' | 'shop'; placeId: string | null; seq: number
  lat: number; lng: number; shopIds: string[]; label?: string
}

async function loadOwned(client: SupabaseClient, sessionId: string, userId: string): Promise<any | null> {
  const { data } = await client.from('route_sessions').select('*').eq('id', sessionId).maybeSingle()
  if (!data || (data as any).user_id !== userId) return null
  return data
}

async function loadVisits(client: SupabaseClient, sessionId: string): Promise<any[]> {
  const { data } = await client.from('route_session_visits').select('*').eq('session_id', sessionId)
  return (data ?? []) as any[]
}

/** 진행 중(active/paused) 세션이 있으면 그걸 이어서, 없으면 새로 생성. 시작 시 체크포인트 확정 저장. */
export async function createOrResumeSession(client: SupabaseClient, routeId: string, userId: string, cfg: VerifyConfig) {
  const { data: existing } = await client.from('route_sessions')
    .select('*').eq('route_id', routeId).eq('user_id', userId).in('status', ['active', 'paused'])
    .order('started_at', { ascending: false }).limit(1).maybeSingle()
  if (existing) {
    if ((existing as any).status === 'paused') await client.from('route_sessions').update({ status: 'active' }).eq('id', (existing as any).id)
    return { session: { ...(existing as any), status: 'active' }, visits: await loadVisits(client, (existing as any).id), resumed: true }
  }

  const { data: route } = await client.from('routes')
    .select('id, route_shops ( sort_order, shops ( id, lat, lng, place_id ) )')
    .eq('id', routeId).maybeSingle()
  if (!route) return { error: 'route_not_found' as const }

  const stops: OrderedStop[] = ((route as any).route_shops ?? [])
    .slice().sort((a: any, b: any) => a.sort_order - b.sort_order)
    .map((rs: any) => rs.shops).filter((s: any) => s && s.lat != null && s.lng != null)
    .map((s: any) => ({ shopId: s.id, lat: s.lat, lng: s.lng, placeId: s.place_id ?? null }))
  if (stops.length === 0) return { error: 'no_coords' as const }

  const cps = deriveCheckpoints(stops, cfg)

  // 라벨(토스트용): 건물=place명, 샵=shop명
  const placeIds = [...new Set(cps.filter(c => c.kind === 'building').map(c => c.placeId).filter(Boolean))] as string[]
  const shopIds = cps.filter(c => c.kind === 'shop').map(c => c.shopIds[0])
  const [{ data: places }, { data: shops }] = await Promise.all([
    placeIds.length ? client.from('places').select('id, name').in('id', placeIds) : Promise.resolve({ data: [] as any[] }),
    shopIds.length ? client.from('shops').select('id, name').in('id', shopIds) : Promise.resolve({ data: [] as any[] }),
  ])
  const placeName = new Map((places ?? []).map((p: any) => [p.id, p.name]))
  const shopName = new Map((shops ?? []).map((s: any) => [s.id, s.name]))
  const stored: StoredCheckpoint[] = cps.map(c => ({
    ...c,
    label: c.kind === 'building' ? (placeName.get(c.placeId as string) ?? '건물') : (shopName.get(c.shopIds[0]) ?? '샵'),
  }))

  const { data: session, error } = await client.from('route_sessions')
    .insert({ route_id: routeId, user_id: userId, status: 'active', checkpoints: stored } as any)
    .select('*').single()
  if (error || !session) return { error: 'create_failed' as const }

  const visitRows = stored.map(c => ({
    session_id: (session as any).id, checkpoint_key: c.key,
    shop_id: c.kind === 'shop' ? c.shopIds[0] : null, status: 'pending',
  }))
  await client.from('route_session_visits').insert(visitRows as any)
  return { session, visits: await loadVisits(client, (session as any).id), resumed: false }
}

export async function getActiveSession(client: SupabaseClient, routeId: string, userId: string) {
  const { data } = await client.from('route_sessions')
    .select('*').eq('route_id', routeId).eq('user_id', userId).in('status', ['active', 'paused'])
    .order('started_at', { ascending: false }).limit(1).maybeSingle()
  if (!data) return null
  return { session: data, visits: await loadVisits(client, (data as any).id) }
}

export async function setSessionStatus(client: SupabaseClient, sessionId: string, userId: string, status: 'active' | 'paused') {
  const s = await loadOwned(client, sessionId, userId)
  if (!s || !ACTIVE.has(s.status)) return { error: 'not_active' as const }
  await client.from('route_sessions').update({ status }).eq('id', sessionId)
  return { ok: true as const, status }
}

export async function recordManual(client: SupabaseClient, sessionId: string, userId: string, shopId: string) {
  const s = await loadOwned(client, sessionId, userId)
  if (!s || !ACTIVE.has(s.status)) return { error: 'not_active' as const }
  await client.from('route_session_visits').upsert({
    session_id: sessionId, checkpoint_key: `shop:${shopId}`, shop_id: shopId,
    status: 'manual_recorded', verification_mode: 'manual', verified_at: nowIso(),
  } as any, { onConflict: 'session_id,checkpoint_key' })
  // 짧은 시간 다수 수동기록 → 위험신호만 남김(강등/제재 아님)
  const since = new Date(Date.now() - 60_000).toISOString()
  const { count } = await client.from('route_session_visits')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId).eq('verification_mode', 'manual').gte('verified_at', since)
  if ((count ?? 0) >= 5) {
    const merged = Array.from(new Set([...(s.risk_flags ?? []), 'rapid_manual']))
    await client.from('route_sessions').update({ risk_flags: merged }).eq('id', sessionId)
  }
  return { ok: true as const }
}

/** 자동 확인 취소 — 세션 방문만 pending으로 되돌림. 기존 route_progress는 건드리지 않음. */
export async function undoAuto(client: SupabaseClient, sessionId: string, userId: string, checkpointKey: string) {
  const s = await loadOwned(client, sessionId, userId)
  if (!s) return { error: 'not_found' as const }
  await client.from('route_session_visits').update({
    status: 'pending', verification_mode: null, verified_at: null, distance_m: null, accuracy_m: null,
    sample_count: 0, in_range_since: null,
  }).eq('session_id', sessionId).eq('checkpoint_key', checkpointKey)
  return { ok: true as const }
}

export async function processPing(client: SupabaseClient, sessionId: string, userId: string, ping: { lat: number; lng: number; accuracy: number }, cfg: VerifyConfig) {
  const s = await loadOwned(client, sessionId, userId)
  if (!s || s.status !== 'active') return { error: 'not_active' as const }
  const at = Date.now()   // 서버 시각 사용(클라이언트 ts 신뢰 안 함)
  const checkpoints = (s.checkpoints ?? []) as StoredCheckpoint[]
  const visits = await loadVisits(client, sessionId)
  const byKey = new Map(visits.map(v => [v.checkpoint_key, v]))

  const states: CheckpointState[] = checkpoints.map(cp => {
    const v = byKey.get(cp.key)
    return { key: cp.key, kind: cp.kind, lat: cp.lat, lng: cp.lng, status: v?.status ?? 'pending', sampleCount: v?.sample_count ?? 0, inRangeSince: v?.in_range_since ? Date.parse(v.in_range_since) : null }
  })

  const verified = visits.filter(v => VERIFIED.has(v.status) && v.verified_at)
  let prevVerified: PrevVerified | null = null
  if (verified.length) {
    const last = verified.reduce((a, b) => Date.parse(a.verified_at) > Date.parse(b.verified_at) ? a : b)
    const cp = checkpoints.find(c => c.key === last.checkpoint_key)
    if (cp) prevVerified = { lat: cp.lat, lng: cp.lng, at: Date.parse(last.verified_at) }
  }

  const dec = evaluatePing({ lat: ping.lat, lng: ping.lng, accuracy: ping.accuracy, at }, states, cfg, prevVerified)

  for (const su of dec.sampleUpdates) {
    await client.from('route_session_visits').update({
      sample_count: su.sampleCount, in_range_since: su.inRangeSince ? new Date(su.inRangeSince).toISOString() : null, last_ping_at: new Date(at).toISOString(),
    }).eq('session_id', sessionId).eq('checkpoint_key', su.key)
  }
  const confirmed: { key: string; label: string; distanceM: number }[] = []
  for (const p of dec.promotions) {
    const cp = checkpoints.find(c => c.key === p.key)
    const status = p.mode === 'building' ? 'checkpoint_verified' : 'proximity_verified'
    await client.from('route_session_visits').update({
      status, verification_mode: p.mode, verified_at: new Date(at).toISOString(), distance_m: p.distanceM, accuracy_m: p.accuracyM,
    }).eq('session_id', sessionId).eq('checkpoint_key', p.key)
    confirmed.push({ key: p.key, label: cp?.label ?? '도착', distanceM: p.distanceM })
  }
  if (dec.riskFlags.length) {
    const merged = Array.from(new Set([...(s.risk_flags ?? []), ...dec.riskFlags]))
    await client.from('route_sessions').update({ risk_flags: merged }).eq('id', sessionId)
  }
  return { ok: true as const, confirmed }
}

async function reflectToProgress(client: SupabaseClient, routeId: string, userId: string, shopIds: string[]) {
  if (!shopIds.length) return
  const { data: ex } = await client.from('route_progress').select('shop_id').eq('route_id', routeId).eq('user_id', userId)
  const have = new Set((ex ?? []).map((r: any) => r.shop_id))
  const rows = shopIds.filter(id => !have.has(id)).map(id => ({ route_id: routeId, shop_id: id, user_id: userId }))
  if (rows.length) await client.from('route_progress').insert(rows as any)
}

/** 종료. mode=later는 세션만 유지(확정 반영 없음). complete/partial만 route_progress 반영, complete만 완주기록/EXP. 멱등. */
export async function endSession(
  client: SupabaseClient, sessionId: string, userId: string,
  mode: 'complete' | 'partial' | 'later', manualShopIds: string[], cfg: VerifyConfig,
) {
  const s = await loadOwned(client, sessionId, userId)
  if (!s) return { error: 'not_found' as const }

  if (mode === 'later') {
    if (ACTIVE.has(s.status)) await client.from('route_sessions').update({ status: 'paused' }).eq('id', sessionId)
    return { ok: true as const, mode, status: 'paused' }
  }

  // 종료 확정 클레임(멱등 가드): finalized_at이 비어있을 때만 상태 전이
  const targetStatus = mode === 'complete' ? 'ended_completed' : 'ended_partial'
  const { data: claimed } = await client.from('route_sessions')
    .update({ status: targetStatus, ended_at: nowIso(), finalized_at: nowIso() })
    .eq('id', sessionId).is('finalized_at', null).select('id').maybeSingle()
  const firstFinalize = !!claimed

  // 수동 기록 반영(upsert = 재요청에도 중복 없음)
  for (const sid of manualShopIds ?? []) {
    await client.from('route_session_visits').upsert({
      session_id: sessionId, checkpoint_key: `shop:${sid}`, shop_id: sid,
      status: 'manual_recorded', verification_mode: 'manual', verified_at: nowIso(),
    } as any, { onConflict: 'session_id,checkpoint_key' })
  }

  const checkpoints = (s.checkpoints ?? []) as StoredCheckpoint[]
  const visits = await loadVisits(client, sessionId)
  const verifiedCps = visits.filter(v => VERIFIED.has(v.status))
  const totalCheckpoints = checkpoints.length
  const fieldRatio = totalCheckpoints ? verifiedCps.length / totalCheckpoints : 0

  // 실제 방문 샵: (a) 확인된 '샵 체크포인트'의 샵  (b) 수동 기록 샵.  건물 도착만으론 내부 샵 자동방문 처리 안 함.
  const visitedShopIds = new Set<string>()
  for (const v of verifiedCps) {
    const cp = checkpoints.find(c => c.key === v.checkpoint_key)
    if (cp?.kind === 'shop') (cp.shopIds ?? []).forEach(id => visitedShopIds.add(id))
  }
  const manualCount = visits.filter(v => v.status === 'manual_recorded').length
  for (const v of visits.filter(x => x.status === 'manual_recorded')) if (v.shop_id) visitedShopIds.add(v.shop_id)

  await reflectToProgress(client, s.route_id, userId, [...visitedShopIds])

  const hasRisk = (s.risk_flags ?? []).length > 0
  const confidence = fieldRatio >= 0.999 ? 'high' : (fieldRatio >= cfg.fieldBonusRequiredRatio ? 'medium' : 'recorded')
  let bonusGranted = false
  if (mode === 'complete') {
    const r = await grantCompletionRewards(client, userId, s.route_id, { fieldRatio, hasRisk, cfg })
    bonusGranted = r.bonusGranted
  }
  await client.from('route_sessions').update({ confidence, field_ratio: fieldRatio }).eq('id', sessionId)

  return {
    ok: true as const, mode, firstFinalize,
    completed: mode === 'complete',
    visitedCount: visitedShopIds.size,
    fieldVerified: verifiedCps.length, totalCheckpoints,
    manualCount, confidence, bonusGranted,
  }
}
