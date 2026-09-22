/* 현장 확인 보너스.
   완주 기록과 기본 완주 EXP 는 여기서 빠졌다 — lib/routeRun/completion.ts 가 담당한다.
   (서버가 완주 조건을 대조하고, GPS 검증 완주에만 15 EXP 가 간다) */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { VerifyConfig } from './types'

export async function grantFieldBonus(
  client: SupabaseClient,
  userId: string,
  routeId: string,
  opts: { fieldRatio: number; hasRisk: boolean; cfg: VerifyConfig },
): Promise<{ bonusGranted: boolean }> {
  if (opts.hasRisk) return { bonusGranted: false }
  if (opts.fieldRatio < opts.cfg.fieldBonusRequiredRatio) return { bonusGranted: false }
  if (!(opts.cfg.fieldBonusExp > 0)) return { bonusGranted: false }
  try {
    await client.rpc('grant_exp', {
      p_user_id: userId, p_amount: Math.round(opts.cfg.fieldBonusExp),
      p_reason: 'route_field_verified', p_related_type: 'route', p_related_id: routeId,
      p_once: true, p_daily_cap: null,
    } as never)
  } catch (e) {
    console.error('[grant_exp 실패] route_field_verified', (e as Error)?.message)
    return { bonusGranted: false }
  }
  return { bonusGranted: true }
}
