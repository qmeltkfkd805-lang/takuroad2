-- ============================================================
-- shop_suggestions — 신고 내용 전체 공개 차단 + 쓰기 권한 좁히기
--
-- 이 테이블은 샵 신고의 저장소다(전용 신고 테이블이 없다).
--
-- 문제 1 — 신고 내용이 전체 공개다. 이번 건의 핵심.
--   shop_suggestions_select_public [SELECT] using = true
--   anon 에게도 SELECT 권한이 있으므로, 로그인조차 필요 없이
--   모든 신고를 user_id(신고자)와 payload.reason(신고 사유)까지 읽을 수 있다.
--   신고당한 샵의 사장님이 "누가 나를 신고했는지" 조회할 수 있다는 뜻이다.
--   남의 개인정보이므로 이번 시리즈에서 가장 먼저 닫는다.
--
-- 문제 2 — INSERT·UPDATE 가 10개 컬럼 전부 열려 있다.
--   status        사용자가 'approved' 로 넣어 검수 대기열을 건너뛴다
--   reviewed_by   이미 처리된 신고처럼 위장한다
--   reviewed_at   처리 시각 위조
--   id, created_at  PK·접수 시각 조작
--
-- 문제 3 — DELETE 권한이 anon·authenticated 둘 다 있는데 DELETE 정책이 없다.
--   RLS 가 전부 거부하므로 죽은 권한이다.
--
-- ✅ 사전 확인 (2026-09-03)
--
--  1) 클라이언트가 쓰는 것 (services/shopReportService.ts)
--       reportShopIssue   INSERT (shop_id, user_id, suggestion_type, payload, status)
--       resolveSuggestion UPDATE (status, reviewed_by, reviewed_at)   ← 관리자 화면
--       getPendingShopReports / getCompletedShopReports  SELECT       ← 관리자 화면
--       getAdminTodoSummary                              SELECT count ← 관리자 대시보드
--
--  2) **사용자에게 자기 신고를 보여주는 화면이 하나도 없다.**
--     SELECT 를 "본인 것 + 관리자"로 좁혀도 깨지는 화면이 없다.
--     (본인 조회를 허용해 두는 것은 '내 신고 내역' 같은 화면이 생길 때를 위한 것이고,
--      지금 당장 그걸 읽는 코드는 없다.)
--
--  3) reportShopIssue 는 .insert() 뒤에 .select() 를 붙이지 않는다.
--     SELECT 정책을 좁혀도 INSERT 의 반환 단계에서 막히지 않는다.
--
--  4) 이 테이블에 걸린 트리거가 없고, 이 테이블에 쓰는 security invoker 함수도 없다.
--     (오늘 shops 에서 났던 장애 — 다른 테이블의 invoker 트리거가 막히는 문제 — 는
--      여기서는 일어나지 않는다. 권한 회수 전에 확인했다.)
--
--  5) 관리자 처리(resolveSuggestion)는 서버 라우트가 아니라 클라이언트에서 돈다.
--     따라서 status·reviewed_by·reviewed_at 의 UPDATE 권한은 authenticated 에
--     남겨야 하고, "관리자만"은 계속 RLS(shop_suggestions_update_admin)가 담당한다.
--     컬럼 권한은 어떤 컬럼을 건드릴 수 있는지만 제한한다.
-- ============================================================


-- ── 1) SELECT 를 본인 것 + 관리자로 ─────────────────────────
-- 관리자 조건은 이 테이블의 기존 UPDATE 정책과 같은 형태를 그대로 쓴다.
drop policy if exists shop_suggestions_select_public on public.shop_suggestions;

create policy shop_suggestions_select_own_or_admin on public.shop_suggestions
  for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'admin'
    )
  );


-- ── 2) RLS 를 우회하거나 죽은 권한 회수 ─────────────────────
revoke truncate, references, trigger on table public.shop_suggestions from anon, authenticated;

-- DELETE 정책이 없어 어차피 전부 거부된다. 지우는 코드도 없다.
revoke delete on table public.shop_suggestions from anon, authenticated;

-- anon 은 신고를 넣을 수도 없다(insert_own 정책이 auth.uid() 를 요구).
revoke insert, update on table public.shop_suggestions from anon;


-- ── 3) 쓰기 권한 회수 (테이블 + 컬럼) ───────────────────────
-- REVOKE ... ON TABLE 은 테이블 단위만 걷어내고 컬럼 단위 GRANT 는 남긴다.
-- 10개 컬럼을 명시해 최종 상태를 확정한다.
revoke insert, update on table public.shop_suggestions from authenticated;

revoke insert (
  id, shop_id, user_id, suggestion_type, payload, image_url,
  status, reviewed_by, reviewed_at, created_at
), update (
  id, shop_id, user_id, suggestion_type, payload, image_url,
  status, reviewed_by, reviewed_at, created_at
) on table public.shop_suggestions from authenticated;


-- ── 4) 실제로 쓰는 컬럼만 다시 부여 ─────────────────────────
-- INSERT — reportShopIssue 가 보내는 것뿐.
--   user_id 는 RLS with_check(user_id = auth.uid())가 남의 이름으로 넣는 걸 막는다.
--   status 는 클라이언트가 항상 실어 보내므로 회수하면 신고 접수가 통째로 깨진다.
--   → 권한은 남기고 아래 트리거가 관리자가 아니면 'pending' 으로 강제한다.
--   id·created_at 은 기본값이 채운다. image_url 은 쓰는 코드가 없다.
--   reviewed_by·reviewed_at 은 접수 시점에 채울 값이 아니다.
grant insert (shop_id, user_id, suggestion_type, payload, status)
  on table public.shop_suggestions to authenticated;

-- UPDATE — resolveSuggestion(관리자 화면)이 보내는 것뿐.
--   "관리자만"은 계속 RLS 가 담당한다. 여기서는 컬럼만 제한한다.
grant update (status, reviewed_by, reviewed_at)
  on table public.shop_suggestions to authenticated;


-- ── 5) 접수 상태 위조 차단 ──────────────────────────────────
-- status 는 INSERT 권한을 남겨둘 수밖에 없어서 트리거로 막는다.
-- community_posts 의 cposts_guard_notice 와 같은 방식이다.
-- BEFORE 트리거의 NEW 대입은 컬럼 권한 검사를 거치지 않는다 —
-- 권한은 문장이 지정한 대상 컬럼에만 적용되기 때문이다.
create or replace function public.shop_suggestions_guard_on_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $fn$
begin
  if coalesce(new.status, 'pending') <> 'pending' then
    if not exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'admin'
    ) then
      -- 조용히 내린다. 예외를 던지면 신고 접수가 통째로 실패한다.
      new.status := 'pending';
    end if;
  end if;

  -- 접수 시점에는 검수 기록이 있을 수 없다
  new.reviewed_by := null;
  new.reviewed_at := null;

  return new;
end;
$fn$;

revoke all on function public.shop_suggestions_guard_on_insert() from public, anon, authenticated;

drop trigger if exists shop_suggestions_guard_insert on public.shop_suggestions;
create trigger shop_suggestions_guard_insert
  before insert on public.shop_suggestions
  for each row execute function public.shop_suggestions_guard_on_insert();


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]  ※ 에디터가 마지막 문장 결과만 보여주므로 한 문장으로 묶었다
-- ============================================================
-- select '1. 테이블 권한' as 구분, (grantee || ' : ' || privilege_type)::text as 값
-- from information_schema.role_table_grants
-- where table_schema='public' and table_name='shop_suggestions'
--   and grantee in ('anon','authenticated')
-- union all
-- select '2. INSERT 허용 컬럼', column_name::text
-- from information_schema.column_privileges
-- where table_schema='public' and table_name='shop_suggestions'
--   and grantee='authenticated' and privilege_type='INSERT'
-- union all
-- select '3. UPDATE 허용 컬럼', column_name::text
-- from information_schema.column_privileges
-- where table_schema='public' and table_name='shop_suggestions'
--   and grantee='authenticated' and privilege_type='UPDATE'
-- union all
-- select '4. 정책', (policyname || ' [' || cmd || ']')::text
-- from pg_policies where schemaname='public' and tablename='shop_suggestions'
-- union all
-- select '5. 트리거', tgname::text
-- from pg_trigger where tgrelid='public.shop_suggestions'::regclass and not tgisinternal
-- order by 1, 2;
--
-- 기대:
--   1. anon : SELECT / authenticated : SELECT, INSERT, UPDATE   (4줄)
--   2. payload, shop_id, status, suggestion_type, user_id        (5줄)
--   3. reviewed_at, reviewed_by, status                          (3줄)
--   4. shop_suggestions_insert_own [INSERT]
--      shop_suggestions_select_own_or_admin [SELECT]   ← _public 이 사라졌을 것
--      shop_suggestions_update_admin [UPDATE]
--   5. shop_suggestions_guard_insert


-- ============================================================
-- [권한 우회 테스트]  각 블록을 한 덩어리로 선택해서 실행
-- ============================================================
-- -- (가) 남의 신고 읽기 — 이제 0건이어야 한다
-- begin;
-- set local role anon;
-- select count(*) from public.shop_suggestions;
-- rollback;
--   → 0  (예전에는 전체 건수가 나왔다)
--
-- -- (나) 처리 기록 위조 — 막혀야 한다
-- begin;
-- set local role authenticated;
-- update public.shop_suggestions set user_id = '00000000-0000-0000-0000-000000000001'
--  where id = '00000000-0000-0000-0000-000000000000';
-- rollback;
--   → 42501 permission denied
--   ※ Supabase 가 붙이는 HINT(GRANT UPDATE ... TO authenticated)는 따르지 말 것.
--
-- -- (다) 관리자 처리 컬럼은 통과해야 한다 — 권한 오류 없이 0 rows
-- begin;
-- set local role authenticated;
-- update public.shop_suggestions set status = 'approved'
--  where id = '00000000-0000-0000-0000-000000000000';
-- rollback;
--   → 에러 없이 "0 rows" (권한은 통과하고 RLS 의 관리자 조건에서 걸러진 것)


-- ============================================================
-- [회귀 테스트] — 사용자 사이트
--   1. 샵 상세 → 더보기 → 신고하기 → 접수되는지
--   2. 그 신고가 status='pending' 으로 저장되는지 (아래 쿼리)
--        select status, reviewed_by, reviewed_at from public.shop_suggestions
--        order by created_at desc limit 3;
--   3. 관리자 → 샵 신고 → 미처리 목록에 뜨는지
--   4. 처리 완료 / 신고 반려 → 동작하고 처리 완료 탭으로 넘어가는지
--   5. 관리자 대시보드의 샵 신고 배지 숫자가 맞는지
--   6. 일반 사용자 계정으로 개발자도구에서
--        /rest/v1/shop_suggestions?select=*
--      → 빈 배열이어야 한다 (예전에는 전체가 나왔다)


-- ============================================================
-- [롤백]
-- ============================================================
-- drop trigger if exists shop_suggestions_guard_insert on public.shop_suggestions;
-- drop function if exists public.shop_suggestions_guard_on_insert();
-- drop policy if exists shop_suggestions_select_own_or_admin on public.shop_suggestions;
-- create policy shop_suggestions_select_public on public.shop_suggestions
--   for select using (true);          -- ⚠️ 신고 내용이 다시 전체 공개된다
-- -- grant insert, update, delete on table public.shop_suggestions to authenticated;
-- -- grant insert, update, delete on table public.shop_suggestions to anon;
-- select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [후속 과제]
-- - resolveSuggestion 이 reviewed_by 를 클라이언트에서 넘긴다(adminId 인자).
--   RLS 가 관리자만 통과시키므로 외부인은 못 쓰지만, 관리자가 다른 관리자 id 를
--   적어 넣을 수는 있다. BEFORE UPDATE 트리거로 auth.uid() 를 강제하면 깔끔하다.
--   지금은 감사 기록의 정확도 문제일 뿐이라 분리했다.
-- - image_url 컬럼은 쓰는 코드가 없다. 신고에 사진을 붙이는 기능을 만들면
--   INSERT 권한에 추가해야 한다.
-- - payload 가 jsonb 자유 형식이라 구조 검증이 없다. 신고 사유가 payload.reason
--   한 줄에만 들어 있어서 관리자 화면에 '구체 내용'을 못 만든다.
--   신고 전용 테이블로 옮기는 것이 근본 해법이다.
-- ============================================================
