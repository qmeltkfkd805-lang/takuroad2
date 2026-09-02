-- ============================================================
-- profiles 컬럼 권한 정리 — 두 가지를 고친다
--   (1) 내부 컬럼(admin_note, signup_*)이 비로그인에게까지 읽히는 문제
--   (2) 가입 시 INSERT로 스스로 관리자가 될 수 있는 문제
--
-- ⚠️ 반드시 AuthProvider의 select('*') → 컬럼 명시 변경을 **먼저 배포**한 뒤 적용할 것.
--    순서를 바꾸면 로그인한 사용자의 프로필 조회가 통째로 실패한다.
--    (SELECT는 요청 컬럼 중 하나라도 권한이 없으면 쿼리 전체가 거부된다)
--
-- 적용 전 실측 (2026-09-02):
--   테이블 권한  anon: SELECT / authenticated: SELECT, INSERT, DELETE
--                (authenticated에 테이블 단위 UPDATE는 없다 — UPDATE는 컬럼 단위로만)
--   컬럼 권한    authenticated: 전 컬럼 SELECT·INSERT,
--                UPDATE는 8개만(app_settings, avatar_url, bio, equipped,
--                is_profile_public, nickname, selected_title_id, selected_title_type)
--   PUBLIC grantee 없음 / authenticator는 SELECT 불가(상속 우회 없음)
--   소유자 postgres → SECURITY DEFINER RPC는 이 변경의 영향을 받지 않는다
--   service_role은 테이블 전 권한 보유 → 관리자 API 영향 없음
--
-- 이번에 하지 않는 것:
--   - 중복 SELECT 정책 3개 정리 (별도 작업)
--   - UPDATE 권한 (지금 상태가 이미 적절하다 — 손대지 않는다)
--   - DELETE 권한 (테이블 권한은 있으나 DELETE 정책이 없어 RLS가 막는다)
-- ============================================================


-- ── 1) SELECT: 테이블 권한을 걷고 안전한 컬럼만 다시 준다 ────
-- 컬럼 권한은 테이블 권한 위에 "더해지는" 구조라, 테이블 SELECT가 남아 있으면
-- 컬럼 단위 REVOKE는 아무 효과가 없다. 그래서 테이블 권한부터 회수한다.
revoke select on table public.profiles from anon, authenticated;

-- 다시 허용하는 컬럼 = 전체에서 admin_note와 signup_* 7개를 뺀 나머지.
-- 지금 클라이언트가 실제로 읽는 컬럼은 전부 여기 들어 있다.
grant select (
  id,                     -- 작성자 식별 (커뮤니티·후기·루트 조인)
  nickname,               -- 전역 표시명
  avatar_url,             -- 프로필 사진
  bio,                    -- 공개 소개글
  role,                   -- 관리자 UI 게이팅 (AuthProvider)
  created_at,             -- 가입일 (여권·프로필)
  updated_at,
  is_profile_public,      -- 공개 여부 판정
  selected_title_id,      -- 착용 칭호
  selected_title_type,
  equipped,               -- 착용 코스메틱
  passport_number,        -- 여권 화면
  privacy_settings,       -- 본인 설정 화면
  notification_settings,  -- 본인 설정 화면
  app_settings,           -- 본인 설정 화면
  status,                 -- 계정 상태
  suspended_until,        -- 정지 만료
  is_beta                 -- 베타 기능 노출
) on public.profiles to anon, authenticated;

-- 결과적으로 아래 7개는 anon·authenticated가 읽을 수 없게 된다:
--   admin_note, signup_channel, signup_referrer, signup_landing_path,
--   signup_utm_source, signup_utm_medium, signup_utm_campaign
-- 관리자는 SECURITY DEFINER RPC(get_member_detail, get_member_signup_source,
-- get_signup_sources)로 읽으므로 그대로 동작한다.


-- ── 2) INSERT: 권한·제재 컬럼을 심지 못하게 한다 ────────────
-- authenticated가 전 컬럼 INSERT 권한을 갖고 있었고, 정책은
--   profiles_insert_own | with check (id = auth.uid())
-- 뿐이라 신규 가입자가 프로필 생성 시점에 이렇게 관리자가 될 수 있었다:
--   supabase.from('profiles').insert({ id: <자기 id>, nickname: 'x', role: 'admin' })
-- UPDATE 쪽은 이미 컬럼 권한으로 막혀 있었는데(role에 UPDATE 없음) INSERT만 열려 있었다.
revoke insert (
  role,
  admin_note,
  status,
  suspended_until,
  is_beta,
  passport_number
) on public.profiles from authenticated, anon;

-- passport_number는 trg_assign_passport_number(BEFORE INSERT)가 채운다.
-- 컬럼 INSERT 권한은 "문장에 나열된 컬럼"에만 검사되고 트리거가 NEW에 넣는 값은
-- 검사 대상이 아니므로, 권한을 걷어도 여권번호 부여는 그대로 동작한다.
--
-- /profile/setup 의 insert가 쓰는 컬럼은 id, nickname, signup_* 여섯 개다.
-- signup_*는 INSERT 권한을 남겨두었고(위 목록에 없음), 그 insert는 .select()로
-- 값을 되받지 않으므로 SELECT 권한을 걷어도 영향이 없다.


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- -- (1) 권한이 의도대로 바뀌었는지
-- select column_name,
--        bool_or(privilege_type='SELECT') as sel,
--        bool_or(privilege_type='INSERT') as ins,
--        bool_or(privilege_type='UPDATE') as upd
-- from information_schema.column_privileges
-- where table_schema='public' and table_name='profiles' and grantee='authenticated'
-- group by column_name order by column_name;
--   기대: admin_note / signup_* 6개 → sel=false
--         role, admin_note, status, suspended_until, is_beta, passport_number → ins=false
--         UPDATE 열은 적용 전과 동일(8개 컬럼만 true)
--
-- -- (2) 테이블 단위 SELECT가 사라졌는지
-- select grantee, privilege_type from information_schema.role_table_grants
-- where table_schema='public' and table_name='profiles' and privilege_type='SELECT';
--   기대: postgres, service_role 만 남는다
--
-- -- (3) anon으로 민감 컬럼 읽기 → 거부되어야 한다
-- begin;
--   set local role anon;
--   select admin_note from public.profiles limit 1;   -- 42501 기대
-- rollback;
--
-- -- (4) anon으로 공개 컬럼 읽기 → 되어야 한다
-- begin;
--   set local role anon;
--   select id, nickname, avatar_url from public.profiles limit 1;   -- 정상
-- rollback;
--
-- -- (5) authenticated로 관리자 심기 → 거부되어야 한다
-- begin;
--   set local role authenticated;
--   insert into public.profiles (id, nickname, role)
--   values (gen_random_uuid(), 'x', 'admin');   -- 42501 기대
-- rollback;
--
-- -- (6) service_role은 전부 그대로여야 한다
-- begin;
--   set local role service_role;
--   select admin_note, signup_channel from public.profiles limit 1;   -- 정상
-- rollback;
--
-- -- (7) 앱에서: 로그인 / 로그아웃 / 새로고침 / 프로필 편집 저장 /
-- --     관리자 회원 상세의 '유입 경로' 카드가 그대로 보이는지


-- ============================================================
-- [롤백] Supabase 기본 상태(테이블 단위 전체 허용)로 되돌린다
-- ============================================================
-- grant select on table public.profiles to anon, authenticated;
-- grant insert (role, admin_note, status, suspended_until, is_beta, passport_number)
--   on public.profiles to authenticated, anon;
-- select pg_notify('pgrst', 'reload schema');
--
-- ⚠️ 롤백하면 (1) 내부 컬럼 노출과 (2) 가입 시 권한 상승이 함께 되살아난다.
--    문제가 생기면 통째로 되돌리기보다, 어느 컬럼에서 막혔는지 확인해
--    그 컬럼만 grant select (…) 로 다시 여는 편이 낫다.


-- ============================================================
-- [남은 과제]
-- ============================================================
-- (1) 본인 전용 정보가 여전히 전체 공개다.
--     passport_number / privacy_settings / notification_settings / app_settings /
--     status / suspended_until 은 본인만 봐야 할 값인데, RLS가 qual=true라
--     남의 행도 읽힌다. 컬럼 권한은 역할 단위라 "본인 것만"을 표현할 수 없다.
--     제대로 하려면 셋 중 하나가 필요하다:
--       a. SELECT 정책을 좁히고 공개용 컬럼만 담은 뷰를 따로 두기
--       b. 본인 전용 컬럼을 별도 테이블로 분리
--       c. 본인 전용 값을 SECURITY DEFINER RPC로만 읽기
--     조인(커뮤니티 작성자 등)이 nickname·avatar_url을 필요로 하므로 a가 유력하다.
--
-- (2) 중복 SELECT 정책 3개(profiles_public_read / _select_all / _select_public)
--     정리 — 참조 여부 확인 후 별도 작업.
