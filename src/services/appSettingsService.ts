import { createClient } from '@/lib/supabase/client'
import { getMySettings } from './mySettingsService'

/* ============================================================
   앱 설정 — profiles.app_settings (jsonb)
   무해한 개인 설정(테마·지역 등).

   ⚠️ 아직 이 서비스를 부르는 화면이 없다. 테마·지역 UI 가 붙을 때 쓴다.

   조회는 get_my_settings, 저장은 update_app_settings RPC 로 한다.
   예전에는 profiles 를 직접 select / update 했다. 그러면
     - app_settings 의 SELECT 권한을 열어둬야 하고(같은 권한으로 남의 것도 읽힌다),
     - 자기 행에 임의의 키·값을 그대로 써넣을 수 있었다.
   공개범위(update_privacy)·알림(update_notif)이 이미 RPC 검증 방식이라 거기에 맞췄다.
   서버가 theme·region 만 받고 나머지 키는 조용히 버린다.
   ============================================================ */

export type ThemePref = 'system' | 'light' | 'dark'

export interface AppSettings {
  theme: ThemePref
  region: string | null
}

const DEFAULTS: AppSettings = { theme: 'system', region: null }

/** 내 앱 설정 (저장값 + 기본값 병합) */
export async function getMyAppSettings(): Promise<AppSettings> {
  const row = await getMySettings()

  const saved: any = row?.app_settings ?? {}
  const theme: ThemePref =
    (saved.theme === 'light' || saved.theme === 'dark' || saved.theme === 'system') ? saved.theme : DEFAULTS.theme
  return {
    theme,
    region: typeof saved.region === 'string' ? saved.region : DEFAULTS.region,
  }
}

/** 부분 저장 — RPC로 서버검증 후 병합 저장.
    서버가 읽고-병합-쓰기를 하므로 클라이언트에서 먼저 읽을 필요가 없다. */
export async function setAppSettings(patch: Partial<AppSettings>): Promise<{ ok: boolean }> {
  const supabase = createClient()
  const { error } = await supabase.rpc('update_app_settings', { patch })
  if (error) { console.error('[앱 설정 저장 실패]', error.message); return { ok: false } }
  return { ok: true }
}
