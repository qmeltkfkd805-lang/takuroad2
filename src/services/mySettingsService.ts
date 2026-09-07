import { createClient } from '@/lib/supabase/client'

/* ============================================================
   내 설정 조회 — get_my_settings RPC (security definer)

   왜 RPC 인가:
     profiles 의 app_settings / notification_settings / privacy_settings 는
     profiles_select_public 정책이 using = true 라, 컬럼 SELECT 권한이 열려 있으면
     로그인한 아무나 남의 설정을 REST 로 읽을 수 있었다.
     (notification_settings 에는 마케팅 수신동의 여부와 이메일 수신 설정이,
      privacy_settings 에는 그 사람이 무엇을 숨겼는지가 들어 있다)
     RLS 는 행 단위라 컬럼을 못 가린다. 컬럼 권한을 회수하고 본인 조회만
     소유자 권한으로 도는 RPC 로 옮겼다.

   RPC 는 파라미터가 없다 — auth.uid() 본인 행만 돌려준다.
   사용자 id 를 인자로 받게 만들면 남의 설정을 읽을 구멍이 생긴다.

   privacyService 와 notificationPrefService 가 이 한 곳만 부른다.
   화면이 서로 다른 페이지라 한 번에 하나만 뜬다 — 중복 호출 걱정은 없다.

   app_settings(테마·지역)는 읽는 쪽이 없다. 다크모드 팔레트도, 기본 지역을
   쓰는 필터도 아직 없어서 appSettingsService 는 지웠다.
   컬럼과 update_app_settings RPC 는 남겨둔다 — 그때 UI 만 붙이면 된다.
   ============================================================ */

export interface MySettingsRow {
  /** 아직 쓰는 곳이 없다. RPC 반환 모양을 그대로 적어둔 것 */
  app_settings: Record<string, unknown> | null
  notification_settings: Record<string, unknown> | null
  privacy_settings: Record<string, unknown> | null
  is_profile_public: boolean | null
}

/** 내 설정 한 행. 실패하거나 프로필이 없으면 null (각 서비스가 기본값으로 채운다) */
export async function getMySettings(): Promise<MySettingsRow | null> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_my_settings')
  if (error) {
    console.error('[내 설정 조회 실패]', error.message)
    return null
  }
  // returns table(...) 이라 배열로 온다
  const row = Array.isArray(data) ? data[0] : data
  return (row ?? null) as MySettingsRow | null
}
