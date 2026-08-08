/* 보상 — 기존 EXP 정책과 현장 확인 보너스 연동.
   · 기본 완주 EXP(route_completed)는 현장확인 여부와 무관하게 기존 정책대로 지급(멱등, grant_exp p_once).
   · 현장 확인 보너스(route_field_verified)는 체크포인트 확인 비율이 기준 이상이고 위험신호가 없을 때만, 루트당 1회. */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { VerifyConfig } from './types'

const ROUTE_COMPLETED_XP = 15   // 기존 XP_RULES.route_completed.baseXp 와 동일

async function grantExpOnce(client: SupabaseClient, userId: string, amount: number, reason: string, routeId: string) {
  try {
    await client.rpc('grant_exp', {
      p_user_id: userId, p_amount: Math.round(amount), p_reason: reason,
      p_related_type: 'route', p_related_id: routeId, p_once: true, p_daily_cap: null,
    } as any)
  } catch (e) { console.error('[grant_exp 실패]', reason, (e as Error)?.message) }
}

/** 완주 확정 시 보상. 멱등(재요청해도 중복 지급 없음: route_completions 존재확인 + grant_exp once). */
export async function grantCompletionRewards(
  client: SupabaseClient,
  userId: string,
  routeId: string,
  opts: { fieldRatio: number; hasRisk: boolean; cfg: VerifyConfig },
): Promise<{ baseGranted: boolean; bonusGranted: boolean }> {
  // 완주 기록(1회)
  const { data: ex } = await client.from('route_completions').select('id').eq('route_id', routeId).eq('user_id', userId).maybeSingle()
  if (!ex) await client.from('route_completions').insert({ route_id: routeId, user_id: userId } as any)

  // 기본 완주 EXP (현장확인 무관)
  await grantExpOnce(client, userId, ROUTE_COMPLETED_XP, 'route_completed', routeId)

  // 현장 확인 보너스 — 체크포인트 비율 기준 + 위험신호 없을 때만
  let bonusGranted = false
  if (!opts.hasRisk && opts.fieldRatio >= opts.cfg.fieldBonusRequiredRatio && opts.cfg.fieldBonusExp > 0) {
    await grantExpOnce(client, userId, opts.cfg.fieldBonusExp, 'route_field_verified', routeId)
    bonusGranted = true
  }
  return { baseGranted: true, bonusGranted }
}
