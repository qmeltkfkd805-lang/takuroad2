/* 가입 동의 — 버전 · 기록 · 상태 조회 (SQL: migrations/signup_consents.sql)
 *
 *   · 약관이나 동의 내용이 바뀌면 CONSENT_VERSION 을 올린다 → 기존 회원도 다음 접속 때 다시 동의 화면을 거친다.
 *   · 동의 시각은 서버가 찍는다. 브라우저는 record_my_consents() 만 부른다.
 */
import { createClient } from '@/lib/supabase/client'

export const CONSENT_VERSION = '2026-10-01'

/** 필수 4개 + 선택(이벤트·새 소식 알림) 동의 남기기 */
export async function recordConsents(marketing: boolean): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.rpc('record_my_consents', { p_version: CONSENT_VERSION, p_marketing: marketing } as any)
  if (error) console.error('[동의 기록 실패]', error.code, error.message)
  return !error
}

/** 지금 버전에 동의했는지. 조회가 안 되면(SQL 실행 전 등) null → 막지 않는다 */
export async function getConsentStatus(): Promise<{ current: boolean; marketing: boolean } | null> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('my_consent_status')
  if (error) { console.warn('[동의 상태 조회 실패]', error.code, error.message); return null }
  const d = (data ?? {}) as { version?: string | null; marketing?: boolean }
  return { current: d.version === CONSENT_VERSION, marketing: !!d.marketing }
}
