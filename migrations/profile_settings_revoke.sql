-- ============================================================
-- profiles 설정 컬럼 권한 회수
--
-- 왜:
--   profiles_select_public 정책이 using = true 라 모든 행이 서로 보인다.
--   그 상태에서 app_settings / notification_settings / privacy_settings 의
--   SELECT 권한이 authenticated 에 열려 있어서, 로그인한 아무나 REST 로
--   남의 마케팅 수신동의 여부·이메일 수신 설정(notification_settings)과
--   무엇을 숨겼는지(privacy_settings)를 읽을 수 있었다.
--   RLS 는 행 단위라 컬럼을 못 가린다. 컬럼 권한을 회수하는 것이 유일한 방법이다.
--
--   본인 조회는 get_my_settings RPC(security definer)로 옮겼고 배포까지 끝냈다.
--   (2026-09-07 실서버에서 공개범위·알림 설정 화면 확인 완료)
--
-- ✅ 사전 확인 (2026-09-07, 실제 조회 결과)
--
--  1) profiles 의 SELECT 는 **컬럼 단위** grant 다 (테이블 단위 grant 없음).
--     => 세 컬럼만 콕 집어 revoke 하면 된다. contact_messages 때처럼
--        테이블 권한을 통째로 회수했다가 다시 부여할 필요가 없다.
--
--  2) profiles_select_public [SELECT] using = true
--     정책 식이 컬럼을 하나도 참조하지 않는다 → 회수해도 정책이 안 깨진다.
--     (profiles 사고 때 role·id 를 남겨야 했던 것과 다른 상황이다)
--
--  3) anon 에는 세 컬럼이 이미 없다. 그래서 authenticated 만 회수한다.
--
--  4) app_settings 는 UPDATE 권한도 회수한다.
--     저장을 update_app_settings RPC 로 옮겼다. 남겨두면 클라이언트가
--     자기 행에 임의의 jsonb 를 그대로 써넣을 수 있다.
--     notification_settings·privacy_settings 는 애초에 UPDATE 권한이 없다
--     (update_notif / update_privacy / set_marketing_consent RPC 전용).
--
--  5) profileEditService 의 한 번의 UPDATE 에는 nickname·bio·equipped 만 들어간다.
--     app_settings 는 payload 에 없다 → 이 회수의 영향을 받지 않는다.
--     (주석에 app_settings 가 적혀 있던 것은 같이 고쳤다)
--
-- ⚠️ 순서: 화면이 먼저 배포돼 있어야 한다. (2026-09-07 배포·확인 완료)
--    옛날 코드가 떠 있으면 설정 화면이 값을 못 읽는다.
-- ============================================================

revoke select (app_settings, notification_settings, privacy_settings)
  on public.profiles from authenticated;

revoke update (app_settings)
  on public.profiles from authenticated;


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- select '1. SELECT' as 구분, (grantee || ' : ' || column_name)::text as 값
-- from information_schema.column_privileges
-- where table_schema='public' and table_name='profiles'
--   and grantee in ('anon','authenticated') and privilege_type='SELECT'
-- union all
-- select '2. UPDATE', (grantee || ' : ' || column_name)::text
-- from information_schema.column_privileges
-- where table_schema='public' and table_name='profiles'
--   and grantee in ('anon','authenticated') and privilege_type='UPDATE'
-- order by 1, 2;
--
-- 기대:
--   1. authenticated 가 12개로 줄어든다 (anon 과 같은 목록)
--      avatar_url, bio, created_at, equipped, id, is_profile_public,
--      nickname, passport_number, role, selected_title_id,
--      selected_title_type, updated_at
--      → app_settings, notification_settings, privacy_settings 가 없어야 한다
--   2. authenticated UPDATE 가 7개로 줄어든다
--      avatar_url, bio, equipped, is_profile_public, nickname,
--      selected_title_id, selected_title_type
--      → app_settings 가 없어야 한다


-- ============================================================
-- [권한 우회 테스트]
-- ============================================================
-- -- 남의 알림 설정을 읽으려는 시도 — 막혀야 한다
-- begin;
-- set local role authenticated;
-- select notification_settings from public.profiles limit 1;
-- rollback;
--   → 42501 permission denied for table profiles
--
-- begin;
-- set local role authenticated;
-- select privacy_settings from public.profiles limit 1;
-- rollback;
--   → 42501
--
-- -- app_settings 직접 쓰기 — 막혀야 한다
-- begin;
-- set local role authenticated;
-- update public.profiles set app_settings = '{"x":1}'::jsonb;
-- rollback;
--   → 42501
--
-- -- 허용 컬럼은 통과해야 한다
-- begin;
-- set local role authenticated;
-- select id, nickname, is_profile_public from public.profiles limit 1;
-- rollback;
--   → 에러 없이 조회됨
--
-- -- ⚠️ role 과 id 는 반드시 남아 있어야 한다.
-- --    DB 전체의 관리자 정책이 profiles.role 을 참조하고,
-- --    정책 식은 호출자 권한으로 평가된다. 여기서 빠지면 전부 42501 이 된다.


-- ============================================================
-- [회귀 테스트] — 앱에서 확인
--   1. /profile/settings/privacy   공개 범위 값이 뜨고 변경·저장되는지
--   2. 알림 설정 화면              값이 뜨고 토글·마케팅 동의가 저장되는지
--   3. 굿즈 목록 공개범위 드롭다운   현재 값이 뜨고 변경되는지
--   4. 프로필 편집                 닉네임·소개·장착 저장이 되는지
--   5. 프로필 공개/비공개 토글      되는지
--   6. 관리자 화면 아무거나         42501 이 안 나는지 (role 참조 확인)


-- ============================================================
-- [롤백]
-- ============================================================
-- grant select (app_settings, notification_settings, privacy_settings)
--   on public.profiles to authenticated;
-- grant update (app_settings) on public.profiles to authenticated;
-- select pg_notify('pgrst', 'reload schema');
-- -- ⚠️ 이러면 남의 설정이 다시 읽힌다. 원인을 찾을 때까지의 임시 조치로만 쓸 것.
-- ============================================================
