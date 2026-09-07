-- ============================================================
-- 내 설정 조회·저장 RPC
--
-- 왜 필요한가:
--   profiles 의 app_settings / notification_settings / privacy_settings 가
--   authenticated 에게 SELECT 로 열려 있고, profiles_select_public 정책이
--   using = true 라 **로그인한 아무나 남의 설정을 REST 로 읽을 수 있다**.
--   notification_settings 에는 마케팅 수신동의 여부와 이메일 수신 설정이,
--   privacy_settings 에는 그 사람이 무엇을 숨겼는지가 들어 있다.
--
--   RLS 는 행 단위라 컬럼을 못 가린다. 컬럼 SELECT 권한을 회수해야 하는데,
--   그러면 본인도 자기 설정을 못 읽는다. 그래서 본인 조회를 definer RPC 로 옮긴다.
--   저장 RPC(update_privacy, update_notif, set_marketing_consent)는 이미 definer 다.
--   같은 자리에 조회용 하나를 맞춰 넣는 셈이다.
--
-- ✅ 사전 확인 (2026-09-07, 실제 조회 결과)
--
--  1) profiles 의 SELECT 는 **컬럼 단위** grant 다 (테이블 단위 grant 없음).
--     => 세 컬럼만 콕 집어 revoke 할 수 있다. contact_messages 와 달리
--        테이블 권한을 통째로 회수했다가 다시 부여할 필요가 없다.
--
--  2) profiles_select_public [SELECT] using = true
--     정책 식이 **컬럼을 하나도 참조하지 않는다**. 회수해도 정책이 안 깨진다.
--     (profiles 사고 때 role·id 를 남겨야 했던 것과 다른 상황이다)
--
--  3) anon 에는 세 컬럼이 **이미 없다**. 노출은 로그인 사용자끼리만이다.
--
--  4) 세 컬럼 전부 jsonb, is_profile_public 은 boolean. 전부 null 허용.
--
--  5) 코드에서 이 세 컬럼을 읽는 곳은 서비스 3개뿐이고 전부 자기 행만 읽는다.
--       privacyService.getMyPrivacy          privacy_settings, is_profile_public
--       appSettingsService.getMyAppSettings  app_settings
--       notificationPrefService.getMyNotifPrefs  notification_settings
--     남의 설정을 읽는 코드는 없다.
--
-- 이 파일은 **추가만** 한다. 회수는 화면 배포 후 별도 파일로 진행한다.
--   1) 이 RPC 2개 생성    ← 지금. 기존 화면은 그대로 동작한다
--   2) 서비스 3개 교체·배포
--   3) 컬럼 권한 회수      ← profile_settings_revoke.sql
-- ============================================================


-- ── 1. 내 설정 조회 ─────────────────────────────────────────
-- is_profile_public 도 같이 돌려준다. getMyPrivacy 가 누락 키의 기본값을
-- is_profile_public 으로 정하기 때문에 한 번에 받아야 왕복이 줄어든다.
-- (is_profile_public 자체는 남이 봐야 하는 값이라 회수 대상이 아니다)
create or replace function public.get_my_settings()
returns table (
  app_settings          jsonb,
  notification_settings jsonb,
  privacy_settings      jsonb,
  is_profile_public     boolean
)
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $fn$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;

  -- 반드시 본인 행만. 파라미터로 id 를 받지 않는다(받으면 남의 설정을 읽을 수 있다)
  return query
    select p.app_settings, p.notification_settings, p.privacy_settings, p.is_profile_public
      from public.profiles p
     where p.id = auth.uid();
end;
$fn$;

revoke all on function public.get_my_settings() from public, anon;
grant execute on function public.get_my_settings() to authenticated;


-- ── 2. 앱 설정 저장 ─────────────────────────────────────────
-- 예전에는 클라이언트가 profiles.app_settings 를 직접 UPDATE 했다
-- (읽고-병합-쓰기). 자기 행이긴 하지만 임의의 jsonb 를 그대로 써넣을 수 있었다.
-- privacy·notification 과 같은 방식으로 맞춘다 — 서버에서 키와 값을 검증하고,
-- 정의되지 않은 키는 **조용히 버린다**.
create or replace function public.update_app_settings(patch jsonb)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $fn$
declare
  v_uid   uuid := auth.uid();
  v_cur   jsonb;
  v_next  jsonb;
  v_theme text;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;

  if patch is null or jsonb_typeof(patch) <> 'object' then
    raise exception 'patch 는 object 여야 합니다' using errcode = '22023';
  end if;

  select coalesce(p.app_settings, '{}'::jsonb) into v_cur
    from public.profiles p
   where p.id = v_uid;

  if not found then
    raise exception '프로필이 없습니다' using errcode = 'P0002';
  end if;

  v_next := v_cur;

  -- theme: 'system' | 'light' | 'dark'
  if patch ? 'theme' then
    v_theme := patch ->> 'theme';
    if v_theme is null or v_theme not in ('system', 'light', 'dark') then
      raise exception 'theme 값이 올바르지 않습니다' using errcode = '22023';
    end if;
    v_next := jsonb_set(v_next, '{theme}', to_jsonb(v_theme));
  end if;

  -- region: 문자열(50자 이내) 또는 null
  if patch ? 'region' then
    if jsonb_typeof(patch -> 'region') = 'null' then
      v_next := jsonb_set(v_next, '{region}', 'null'::jsonb);
    elsif jsonb_typeof(patch -> 'region') = 'string'
      and char_length(patch ->> 'region') between 1 and 50 then
      v_next := jsonb_set(v_next, '{region}', to_jsonb(patch ->> 'region'));
    else
      raise exception 'region 값이 올바르지 않습니다' using errcode = '22023';
    end if;
  end if;

  -- theme·region 외의 키는 여기까지 오면서 그냥 무시된다
  update public.profiles set app_settings = v_next where id = v_uid;
end;
$fn$;

revoke all on function public.update_app_settings(jsonb) from public, anon;
grant execute on function public.update_app_settings(jsonb) to authenticated;


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- select '1. 함수' as 구분,
--        (p.proname || ' definer=' || p.prosecdef::text || ' / ' ||
--         coalesce(array_to_string(p.proconfig, ','), 'search_path 없음'))::text as 값
-- from pg_proc p
-- where p.pronamespace = 'public'::regnamespace
--   and p.proname in ('get_my_settings', 'update_app_settings')
-- union all
-- select '2. 실행 권한', (grantee || ' : ' || routine_name)::text
-- from information_schema.routine_privileges
-- where routine_schema = 'public'
--   and routine_name in ('get_my_settings', 'update_app_settings')
-- order by 1, 2;
--
-- 기대:
--   1. 둘 다 definer=true, search_path=public, extensions, pg_temp
--   2. authenticated 가 둘 다 EXECUTE (postgres 도 나온다. anon 은 없어야 한다)


-- ============================================================
-- [권한 우회 테스트]
-- ============================================================
-- -- 비로그인 호출 — 실행 권한 자체가 없다
-- begin;
-- set local role anon;
-- select * from public.get_my_settings();
-- rollback;
--   → 42501 permission denied for function get_my_settings
--
-- -- 로그인 역할이지만 JWT 가 없으면 함수 안에서 걸린다
-- begin;
-- set local role authenticated;
-- select * from public.get_my_settings();
-- rollback;
--   → 42501 로그인이 필요합니다
--
-- -- 남의 설정을 읽을 인자가 아예 없다(파라미터 없음). 앱에서 본인 것만 나오는지 확인한다.


-- ============================================================
-- [회귀 테스트]
--   이 단계에서는 아직 화면이 RPC 를 쓰지 않는다. 깨지는 것이 없어야 한다.
--   1. /profile/settings/privacy   공개 범위 화면이 그대로 뜨는지
--   2. 알림 설정 화면              그대로인지
--   3. 테마·지역(앱 설정)          그대로 저장되는지
--   4. 굿즈 목록의 공개범위 드롭다운  그대로인지


-- ============================================================
-- [롤백]
-- ============================================================
-- drop function if exists public.get_my_settings();
-- drop function if exists public.update_app_settings(jsonb);
-- select pg_notify('pgrst', 'reload schema');
-- -- ⚠️ 화면을 배포한 뒤에는 이걸 지우면 설정 화면이 깨진다. 코드를 먼저 되돌릴 것.
-- ============================================================
