-- ============================================================
-- profiles — 내부 컬럼 노출 차단 + 중복 SELECT 정책 정리
--
-- 이 테이블은 쓰기 쪽이 이미 잠겨 있다. UPDATE 허용 컬럼이 8개
--   (app_settings, avatar_url, bio, equipped, is_profile_public,
--    nickname, selected_title_id, selected_title_type)
-- 로 제한돼 있어 role·status·suspended_until·admin_note 는 건드릴 수 없다.
-- 자기 계정을 관리자로 승격하는 경로는 없다. 이번 작업은 **읽기**만 다룬다.
--
-- 문제 — 같은 의미의 SELECT 정책이 4개 겹쳐 있고 셋이 using = true 다.
--   profiles_public_read   [SELECT] using = true
--   profiles_select_all    [SELECT] using = true
--   profiles_select_public [SELECT] using = true
--   profiles_select_self   [SELECT] using = (auth.uid() = id)
-- permissive 정책은 OR 로 합쳐지므로 결과는 true —
-- 모든 사용자의 모든 컬럼이 로그인 없이도 읽힌다. 새는 것:
--   admin_note        관리자가 그 사용자에 대해 적은 운영 메모
--   status            제재 상태
--   suspended_until   정지 만료 시각
--   is_beta           베타 참여 여부
--   signup_*  (6개)   가입 유입 경로 — referrer, 랜딩 경로, UTM 파라미터
--
-- RLS 는 행 단위라 컬럼을 가릴 수 없다. 컬럼 단위 GRANT 로 막는다.
-- 행 정책은 public 으로 남긴다 — 글·댓글·후기가 작성자 닉네임을 조인해 쓰기 때문에
-- 행을 가리면 사이트 전체가 깨진다.
--
-- ✅ 사전 확인 (2026-09-03)
--
--  1) 클라이언트가 읽는 컬럼은 15개뿐이다(모든 .select() 목록을 모아 확인).
--       id, nickname, avatar_url, bio, role, created_at, updated_at,
--       equipped, is_profile_public, passport_number, selected_title_id,
--       selected_title_type, app_settings, notification_settings, privacy_settings
--     위의 10개는 한 번도 읽지 않는다. select('*') 로 긁는 곳도 없다.
--
--  2) 관리자 회원 화면은 전부 RPC 다 — get_admin_members, get_member_detail,
--     get_member_signup_source, get_member_items. 쓰기는 /api/admin/upsert
--     (service_role). 관련 함수 7개가 **전부 prosecdef = true** 임을 확인했다.
--     소유자 권한으로 돌기 때문에 이번 회수의 영향을 받지 않는다.
--
--  3) ⚠️ role 과 id 는 회수하면 안 된다.
--     다른 테이블의 관리자 정책들이
--       exists (select 1 from profiles p where p.id = auth.uid() and p.role='admin')
--     형태다. 정책 표현식은 **호출자 권한으로** 평가되므로, role 의 SELECT 권한이
--     없으면 그 정책을 쓰는 모든 테이블이 42501 로 터진다. anon 에게도 남긴다
--     (anon 요청에서도 그 정책이 평가된다).
--
--  4) app_settings / notification_settings / privacy_settings 는 본인 것만
--     읽지만(.eq('id', userId)), 행 정책이 public 이라 컬럼 권한을 주면 남의 것도
--     읽힌다. authenticated 에는 남기고 anon 에서는 뺀다. 근본 해법은 별도 테이블로
--     옮기는 것이라 후속 과제로 남긴다.
--
--  5) profiles 에 DELETE 정책이 없다. authenticated 의 DELETE 권한은 죽은 권한이다.
--     탈퇴(deleteAccount)도 DELETE 가 아니라 nickname UPDATE 로 처리한다.
--
--  6) 이 테이블에 걸린 트리거 3개(profiles_guard_privileged, assign_passport_number,
--     set_updated_at)는 BEFORE 트리거로 NEW 에 대입하는 방식이라 컬럼 권한이
--     필요 없다. profiles 에 INSERT/UPDATE 문을 실행하는 security invoker 함수는
--     없다(권한 회수 전 스윕으로 확인).
-- ============================================================


-- ── 1) 중복 SELECT 정책 정리 ────────────────────────────────
-- 넷 다 사실상 true 라 하나로 합친다. 동작은 그대로다.
drop policy if exists profiles_public_read   on public.profiles;
drop policy if exists profiles_select_all    on public.profiles;
drop policy if exists profiles_select_public on public.profiles;
drop policy if exists profiles_select_self   on public.profiles;

-- 행은 계속 공개다 — 어떤 컬럼을 볼 수 있는지는 아래 컬럼 권한이 정한다.
create policy profiles_select_public on public.profiles
  for select using (true);


-- ── 2) RLS 를 우회하거나 죽은 권한 회수 ─────────────────────
revoke truncate, references, trigger on table public.profiles from anon, authenticated;

-- DELETE 정책이 없어 어차피 전부 거부된다. 탈퇴는 UPDATE 로 처리한다.
revoke delete on table public.profiles from anon, authenticated;


-- ── 3) SELECT 를 컬럼 단위로 확정 ───────────────────────────
-- 테이블 단위와 컬럼 단위를 모두 회수한 뒤 필요한 것만 다시 준다.
-- REVOKE ... ON TABLE 은 테이블 단위만 걷어내고 컬럼 단위 GRANT 는 남기므로
-- 25개 컬럼을 명시해 최종 상태를 확정한다.
revoke select on table public.profiles from anon, authenticated;

revoke select (
  admin_note, app_settings, avatar_url, bio, created_at, equipped, id,
  is_beta, is_profile_public, nickname, notification_settings, passport_number,
  privacy_settings, role, selected_title_id, selected_title_type,
  signup_channel, signup_landing_path, signup_referrer,
  signup_utm_campaign, signup_utm_medium, signup_utm_source,
  status, suspended_until, updated_at
) on table public.profiles from anon, authenticated;


-- 로그인 사용자 — 클라이언트가 실제로 읽는 15개.
grant select (
  id, nickname, avatar_url, bio, role, created_at, updated_at,
  equipped, is_profile_public, passport_number,
  selected_title_id, selected_title_type,
  app_settings, notification_settings, privacy_settings
) on table public.profiles to authenticated;

-- 비로그인 — 공개 표시에 필요한 것만. 개인 설정 3개는 뺀다.
--   role·id 는 다른 테이블의 관리자 정책이 참조하므로 반드시 남긴다(위 3번 참고).
grant select (
  id, nickname, avatar_url, bio, role, created_at, updated_at,
  equipped, is_profile_public, passport_number,
  selected_title_id, selected_title_type
) on table public.profiles to anon;


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]  ※ 에디터가 마지막 문장 결과만 보여주므로 한 문장으로 묶었다
-- ============================================================
-- select '1. 테이블 권한' as 구분, (grantee || ' : ' || privilege_type)::text as 값
-- from information_schema.role_table_grants
-- where table_schema='public' and table_name='profiles'
--   and grantee in ('anon','authenticated')
-- union all
-- select '2. SELECT 허용 (authenticated)', column_name::text
-- from information_schema.column_privileges
-- where table_schema='public' and table_name='profiles'
--   and grantee='authenticated' and privilege_type='SELECT'
-- union all
-- select '3. SELECT 허용 (anon)', column_name::text
-- from information_schema.column_privileges
-- where table_schema='public' and table_name='profiles'
--   and grantee='anon' and privilege_type='SELECT'
-- union all
-- select '4. INSERT 허용 (authenticated)', column_name::text
-- from information_schema.column_privileges
-- where table_schema='public' and table_name='profiles'
--   and grantee='authenticated' and privilege_type='INSERT'
-- union all
-- select '5. 정책', (policyname || ' [' || cmd || ']')::text
-- from pg_policies where schemaname='public' and tablename='profiles'
-- order by 1, 2;
--
-- 기대:
--   1. anon / authenticated 둘 다 REFERENCES·TRIGGER·TRUNCATE·DELETE 가 없어야 한다
--   2. 15개 — admin_note·status·suspended_until·is_beta·signup_* 이 없어야 한다
--   3. 12개 — 위 15개에서 app_settings·notification_settings·privacy_settings 제외
--   4. 참고용. profile/setup 이 넣는 8개(id, nickname, signup_* 6개)가 있어야 한다
--   5. profiles_insert_own [INSERT] / profiles_select_public [SELECT] /
--      profiles_update_own [UPDATE]  — SELECT 정책이 1개로 줄었을 것


-- ============================================================
-- [권한 우회 테스트]  각 블록을 한 덩어리로 선택해서 실행
-- ============================================================
-- -- (가) 운영 메모 훔쳐보기 — 막혀야 한다
-- begin;
-- set local role authenticated;
-- select admin_note from public.profiles limit 1;
-- rollback;
--   → 42501 permission denied
--   ※ Supabase 가 붙이는 HINT(GRANT SELECT ... TO authenticated)는 따르지 말 것.
--
-- -- (나) 제재 상태·유입 경로도 같은 결과여야 한다
-- --      status / suspended_until / signup_referrer 로 바꿔 넣어 확인
--
-- -- (다) 닉네임 조인은 통과해야 한다 — 에러 없이 결과가 나온다
-- begin;
-- set local role anon;
-- select id, nickname, avatar_url from public.profiles limit 3;
-- rollback;
--   → 정상 조회


-- ============================================================
-- [회귀 테스트] — 여기가 제일 중요하다. profiles 는 사이트 전체가 조인해서 쓴다.
--
--   비로그인 상태로:
--    1. 홈 / 커뮤니티 목록 → 글 작성자 닉네임·아바타가 보이는지
--    2. 샵 상세 → 후기 작성자 닉네임이 보이는지
--    3. 공개 프로필 페이지 → 정상 표시되는지
--
--   로그인 상태로:
--    4. 로그인 직후 헤더에 내 닉네임·아바타가 뜨는지 (AuthProvider)
--    5. 프로필 편집 → 닉네임·소개글·아바타 저장
--    6. 설정 → 알림 설정 / 공개범위 설정 화면이 값을 읽어오는지
--    7. 꾸미기(코스메틱) 장착·해제
--    8. 여권 화면에 여권번호가 보이는지
--
--   관리자로:
--    9. 회원 관리 → 목록·상세·유입 경로·제재·베타 토글  ← RPC 경유라 안 깨져야 한다
--   10. 대시보드 통계
--   11. 게시글 신고 / 샵 신고 / 인증 심사 — 관리자 정책이 profiles.role 을 참조하므로
--       이 화면들이 열리는지로 role 권한이 살아있는지 확인된다


-- ============================================================
-- [롤백]
-- ============================================================
-- grant select on table public.profiles to anon, authenticated;
-- drop policy if exists profiles_select_public on public.profiles;
-- create policy profiles_select_public on public.profiles for select using (true);
-- create policy profiles_select_self   on public.profiles for select using (auth.uid() = id);
-- -- ⚠️ 위 grant 는 내부 컬럼이 다시 전체 공개되는 상태다
-- select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [후속 과제]
-- - app_settings / notification_settings / privacy_settings 는 본인만 읽어야 하는
--   값인데 행 정책이 public 이라 로그인 사용자끼리는 서로 읽을 수 있다.
--   RLS 는 행 단위, GRANT 는 컬럼 단위라 "본인 행의 이 컬럼만"을 표현할 수 없다.
--   별도 테이블(user_settings, RLS = 본인만)로 옮기는 것이 근본 해법이다.
-- - profiles 의 INSERT 컬럼 목록은 이번에 손대지 않았다. 검증 4번으로 확인한 뒤,
--   profile/setup 이 넣는 8개보다 넓으면 좁힐 것.
-- - profiles_guard_privileged 트리거가 security invoker 다. NEW 대입 방식이라
--   지금은 문제없지만, 내용을 확인해두면 좋다.
-- ============================================================
