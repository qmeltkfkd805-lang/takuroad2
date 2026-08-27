import { createClient } from '@/lib/supabase/client'

/* ============================================================
   공개범위 — profiles.privacy_settings (jsonb)
   대상별 'public' | 'followers' | 'private'.
   ⭐ 저장은 RPC(update_privacy)로만 — 서버에서 키·enum 검증(클라 직접 UPDATE 불가).
   ⭐ 누락 키 기본값 = is_profile_public ? 'public' : 'private'
      (기존 동작 유지. 갑자기 더 공개/덜 공개하지 않는다.)
   ============================================================ */

export type PrivacyTarget =
  | 'follows' | 'activity' | 'visited_shops'
  | 'completed_routes' | 'liked_works' | 'collections' | 'goods'

export type PrivacyLevel = 'public' | 'followers' | 'private'

export const PRIVACY_TARGETS: PrivacyTarget[] = [
  'follows', 'activity', 'visited_shops', 'completed_routes', 'liked_works', 'collections', 'goods',
]
export const PRIVACY_LEVELS: PrivacyLevel[] = ['public', 'followers', 'private']

export type PrivacySettings = Record<PrivacyTarget, PrivacyLevel>

/** 내 공개범위 (저장값 + is_profile_public 기본값 병합) */
export async function getMyPrivacy(userId: string): Promise<PrivacySettings> {
  const supabase = createClient()
  const { data } = await supabase
    .from('profiles')
    .select('privacy_settings, is_profile_public')
    .eq('id', userId)
    .maybeSingle()

  const saved: any = (data as any)?.privacy_settings ?? {}
  const fallback: PrivacyLevel = (data as any)?.is_profile_public === false ? 'private' : 'public'

  const out = {} as PrivacySettings
  for (const t of PRIVACY_TARGETS) {
    const v = saved[t]
    out[t] = (typeof v === 'string' && (PRIVACY_LEVELS as string[]).includes(v)) ? (v as PrivacyLevel) : fallback
  }
  return out
}

/** 부분 저장 — RPC로 서버검증 후 병합 저장 */
export async function setPrivacy(
  patch: Partial<Record<PrivacyTarget, PrivacyLevel>>,
): Promise<{ ok: boolean; message?: string }> {
  const supabase = createClient()
  const { error } = await supabase.rpc('update_privacy', { patch })
  if (error) {
    console.error('[공개범위 저장 실패]', error.message)
    return { ok: false, message: '저장에 실패했어요.' }
  }
  return { ok: true }
}
