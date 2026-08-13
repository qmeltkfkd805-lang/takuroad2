import { createClient } from '@/lib/supabase/client'

/* ============================================================
   앱 설정 — profiles.app_settings (jsonb)
   무해한 개인 설정(테마·지역 등). ⭐ equipped 처럼 직접 UPDATE(읽고-병합-쓰기).
   (STEP A에서 authenticated 에 UPDATE(app_settings) 권한 부여됨.)
   ============================================================ */

export type ThemePref = 'system' | 'light' | 'dark'

export interface AppSettings {
  theme: ThemePref
  region: string | null
}

const DEFAULTS: AppSettings = { theme: 'system', region: null }

/** 내 앱 설정 (저장값 + 기본값 병합) */
export async function getMyAppSettings(userId: string): Promise<AppSettings> {
  const supabase = createClient()
  const { data } = await supabase
    .from('profiles').select('app_settings').eq('id', userId).maybeSingle()

  const saved: any = (data as any)?.app_settings ?? {}
  const theme: ThemePref =
    (saved.theme === 'light' || saved.theme === 'dark' || saved.theme === 'system') ? saved.theme : DEFAULTS.theme
  return {
    theme,
    region: typeof saved.region === 'string' ? saved.region : DEFAULTS.region,
  }
}

/** 부분 저장 — 읽고-병합-쓰기 (직접 UPDATE) */
export async function setAppSettings(userId: string, patch: Partial<AppSettings>): Promise<{ ok: boolean }> {
  const supabase = createClient()
  const cur = await getMyAppSettings(userId)
  const merged: AppSettings = { ...cur, ...patch }
  const { error } = await supabase
    .from('profiles').update({ app_settings: merged } as any).eq('id', userId)
  if (error) { console.error('[앱 설정 저장 실패]', error.message); return { ok: false } }
  return { ok: true }
}
