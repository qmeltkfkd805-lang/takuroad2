-- ============================================================
-- public 스키마 권한 기본값 정리
--   A) 기존 85개 relation 의 TRIGGER·TRUNCATE 회수
--   B) 앞으로 만드는 테이블이 열린 채로 시작하지 않게 기본 권한 회수
--
-- 왜:
--   조사해보니 public 의 85개 relation(테이블 98 + 뷰 4 중)에
--   TRIGGER 와 TRUNCATE 가 anon·authenticated 양쪽에 부여돼 있었다.
--   그리고 그 원인이 pg_default_acl 에 있었다 —
--     postgres / r : anon=arwdDxtm, authenticated=arwdDxtm
--   arwdDxtm = INSERT·SELECT·UPDATE·DELETE·TRUNCATE·REFERENCES·TRIGGER·MAINTAIN.
--   즉 public 에 테이블을 만들 때마다 두 역할에게 전권이 자동으로 붙는다.
--   (Supabase 기본 설정이다)
--
--   그래서 테이블을 하나씩 조여도 새 테이블이 계속 열린 채로 태어난다.
--   지금까지의 작업(shops, community_posts, post_comments, review_comments,
--   notifications, shop_suggestions, profiles, contact_messages)이 새는 구멍이 여기다.
--
-- 위험도에 대해 정확히:
--   TRUNCATE 와 TRIGGER 는 PostgREST 로 직접 호출할 수 없다. REST API 만으로는
--   바로 뚫리지 않는다. 다만 남겨두면 RPC 하나의 SQL 인젝션이
--   "한 테이블 유출"이 아니라 "DB 전체 삭제"가 된다.
--     - TRUNCATE 는 RLS 를 통째로 우회한다
--     - TRIGGER 는 임의 함수를 relation 에 붙일 수 있게 한다
--       (뷰라면 INSTEAD OF 트리거. 소유자가 아니어도 TRIGGER 권한만 있으면 된다)
--   앱이 쓰지 않는 권한이라 회수해도 기능 영향이 0이다.
--
-- ✅ 사전 확인 (2026-09-07, 실제 조회 결과)
--   A. anon/TRIGGER 85, anon/TRUNCATE 85, authenticated 도 각각 85
--   B. pg_default_acl 에 postgres 와 supabase_admin 두 grantor 의 항목이 있다.
--      public 에 실제로 테이블을 만드는 것은 postgres 다.
--      supabase_admin 쪽은 Supabase 내부용이고 소유 역할이 달라 건드리지 않는다.
--
-- ⚠️ 이 파일을 적용한 뒤로는 **새 테이블에 grant 를 직접 써야 한다.**
--    파일 아래쪽 [새 테이블 만들 때] 템플릿을 쓸 것.
--    빠뜨리면 화면이 42501 로 바로 터진다 — 조용히 열려 있는 것보다 낫다.
--
-- 이 파일은 시퀀스와 함수의 기본 권한은 건드리지 않는다.
--   - 시퀀스(S): serial 컬럼 INSERT 에 USAGE 가 필요해서 잘못 건드리면 등록이 깨진다
--   - 함수(f): 새 RPC 가 anon 에게 EXECUTE 로 열린 채 태어나는 문제가 있다.
--     지금은 RPC 마다 `revoke all on function ... from public, anon` 을 직접 쓰고 있다.
--     기본값을 바꿀지는 별도로 판단한다.
-- ============================================================


-- ── A. 기존 relation 에서 회수 ──────────────────────────────
-- ALL TABLES IN SCHEMA 는 테이블과 뷰를 모두 포함한다.
-- (구체화 뷰는 0개라 해당 없음)
revoke trigger, truncate on all tables in schema public from anon, authenticated;


-- ── B. 앞으로 만드는 테이블의 기본 권한 회수 ────────────────
-- 이미 만들어진 테이블에는 영향이 없다. 새로 만드는 것에만 적용된다.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- select 'A. 남은 TRIGGER/TRUNCATE' as 구분,
--        (grantee || ' / ' || privilege_type || ' : ' || count(*)::text || '개')::text as 값
-- from information_schema.table_privileges
-- where table_schema='public' and grantee in ('anon','authenticated')
--   and privilege_type in ('TRIGGER','TRUNCATE')
-- group by grantee, privilege_type
-- union all
-- select 'B. 기본 권한(테이블)',
--        (pg_get_userbyid(d.defaclrole) || ' : ' || d.defaclacl::text)::text
-- from pg_default_acl d
-- where d.defaclnamespace='public'::regnamespace and d.defaclobjtype='r'
-- order by 1, 2;
--
-- 기대:
--   A. 한 줄도 없다
--   B. postgres 항목에서 anon 과 authenticated 가 사라진다
--      (postgres, service_role 은 남는다. supabase_admin 항목은 그대로다)


-- ============================================================
-- [회귀 테스트] — 기존 화면은 아무것도 안 변해야 한다
--   앱 코드가 TRUNCATE 나 CREATE TRIGGER 를 쓰는 곳이 없으므로
--   기존 기능은 전부 그대로여야 한다. 그래도 넓게 한 번 훑는다.
--   1. 비로그인으로 홈·샵 목록·샵 상세·커뮤니티 글 보기
--   2. 로그인 후 후기 작성, 댓글 작성·삭제, 좋아요
--   3. 샵 등록/수정, 굿즈 등록
--   4. 관리자 화면 전체
--   5. 알림이 정상적으로 쌓이는지 (트리거는 postgres 소유라 영향 없음)


-- ============================================================
-- [새 테이블 만들 때] — 이제부터 반드시 같이 쓴다
-- ============================================================
-- -- 조회: 공개 데이터면 anon 까지, 아니면 authenticated 만
-- grant select (id, col_a, col_b) on public.새테이블 to anon, authenticated;
--
-- -- 쓰기: 필요한 컬럼만. 소유권·상태 컬럼(user_id, status, role 등)은 절대 넣지 않는다
-- grant insert (col_a, col_b) on public.새테이블 to authenticated;
-- grant update (col_a)        on public.새테이블 to authenticated;
-- grant delete                on public.새테이블 to authenticated;
--
-- -- RLS 는 별도다. 권한은 "어떤 컬럼을", 정책은 "어떤 행을" 정한다. 둘 다 필요하다
-- alter table public.새테이블 enable row level security;
--
-- ⚠️ RLS 정책 식에 쓰는 컬럼은 SELECT 권한이 있어야 한다.
--    정책 식은 호출자 권한으로 평가된다. 빠뜨리면 그 테이블 조회가 전부 42501 이 된다.
--    (profiles 때 이걸로 한 번 겪었다)


-- ============================================================
-- [롤백]
-- ============================================================
-- grant trigger, truncate on all tables in schema public to anon, authenticated;
-- alter default privileges for role postgres in schema public
--   grant all on tables to anon, authenticated;
-- select pg_notify('pgrst', 'reload schema');
-- -- ⚠️ 되돌리면 새 테이블이 다시 전권으로 태어난다. 원인 파악용 임시 조치로만.
-- ============================================================
