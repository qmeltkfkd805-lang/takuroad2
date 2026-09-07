import { createClient } from '@/lib/supabase/client'
import { getMySettings } from './mySettingsService'

/* ============================================================
   알림 설정 — profiles.notification_settings (jsonb)
   ⭐ 저장은 RPC로만: types/channels 는 update_notif, 마케팅은 set_marketing_consent
      (마케팅 동의/철회 시각은 서버 now()로 기록됨 — 클라 값 신뢰 안 함).
   ⭐ 기본값: 기능 알림(types) 전부 true(현행 유지), push=브라우저 권한, email=false,
      marketing.agreed=false.
   ============================================================ */

export type NotifType = 'favorite' | 'event' | 'follow' | 'comment' | 'like' | 'route' | 'notice'

export const NOTIF_TYPES: NotifType[] = ['favorite', 'event', 'follow', 'comment', 'like', 'route', 'notice']

export interface NotifPrefs {
  types: Record<NotifType, boolean>
  channels: { push: boolean; email: boolean }
  marketing: { agreed: boolean; agreedAt: string | null; revokedAt: string | null; policyVersion: string | null }
}

function browserPushDefault(): boolean {
  try {
    return typeof Notification !== 'undefined' && Notification.permission === 'granted'
  } catch { return false }
}

/** 내 알림 설정 (저장값 + 기본값 병합)
    조회는 get_my_settings RPC 로 한다 — profiles.notification_settings 의 SELECT
    권한을 회수했기 때문이다. 마케팅 수신동의 여부와 이메일 수신 설정이 들어 있어
    로그인한 다른 사용자에게 읽히면 안 된다. 자세한 이유는 mySettingsService 주석 참고.
    RPC 가 본인 행만 돌려주므로 userId 인자는 받지 않는다. */
export async function getMyNotifPrefs(): Promise<NotifPrefs> {
  const row = await getMySettings()

  const saved: any = row?.notification_settings ?? {}
  const st: any = saved.types ?? {}
  const ch: any = saved.channels ?? {}
  const mk: any = saved.marketing ?? {}

  const types = {} as Record<NotifType, boolean>
  for (const t of NOTIF_TYPES) types[t] = typeof st[t] === 'boolean' ? st[t] : true

  return {
    types,
    channels: {
      push: typeof ch.push === 'boolean' ? ch.push : browserPushDefault(),
      email: typeof ch.email === 'boolean' ? ch.email : false,
    },
    marketing: {
      agreed: mk.agreed === true,
      agreedAt: typeof mk.agreed_at === 'string' ? mk.agreed_at : null,
      revokedAt: typeof mk.revoked_at === 'string' ? mk.revoked_at : null,
      policyVersion: typeof mk.policy_version === 'string' ? mk.policy_version : null,
    },
  }
}

/** 기능 알림 on/off (부분) */
export async function setNotifTypes(patch: Partial<Record<NotifType, boolean>>): Promise<{ ok: boolean }> {
  const supabase = createClient()
  const { error } = await supabase.rpc('update_notif', { patch: { types: patch } })
  if (error) { console.error('[알림 유형 저장 실패]', error.message); return { ok: false } }
  return { ok: true }
}

/** 알림 채널 on/off (push/email) */
export async function setNotifChannels(patch: Partial<{ push: boolean; email: boolean }>): Promise<{ ok: boolean }> {
  const supabase = createClient()
  const { error } = await supabase.rpc('update_notif', { patch: { channels: patch } })
  if (error) { console.error('[알림 채널 저장 실패]', error.message); return { ok: false } }
  return { ok: true }
}

/** 마케팅 수신동의 (시각은 서버 기록) */
export async function setMarketingConsent(agree: boolean): Promise<{ ok: boolean }> {
  const supabase = createClient()
  const { error } = await supabase.rpc('set_marketing_consent', { agree })
  if (error) { console.error('[마케팅 동의 저장 실패]', error.message); return { ok: false } }
  return { ok: true }
}
