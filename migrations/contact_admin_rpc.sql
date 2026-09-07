-- ============================================================
-- 관리자 문의 조회 RPC
--
-- 왜 필요한가:
--   contact_select_own 이 본인 문의를 **전 컬럼** 허용한다. 그래서 문의한 사람이
--   자기 문의에 달린 admin_note(내부 메모 — "재현 불가", "메일 발송 완료" 같은 것)를
--   REST 로 직접 읽을 수 있다.
--   막으려면 admin_note 의 SELECT 권한을 회수해야 하는데, 관리자 화면도
--   getAllContactMessages 가 select('*') 로 authenticated 권한을 쓰기 때문에
--   같이 막힌다. 관리자 조회를 소유자 권한으로 도는 RPC 로 옮기고 나서 회수한다.
--
--   회원 관리 화면이 이미 같은 구조다(get_admin_members, get_member_detail 등
--   전부 security definer). 그 패턴을 따른다.
--
-- 이 파일은 **추가만** 한다. 회수는 화면 배포 후 별도 파일로 진행한다.
--   1) 이 RPC 생성        ← 지금. 기존 화면은 그대로 동작한다
--   2) 화면·서비스 배포    ← RPC 를 쓰도록 교체
--   3) admin_note SELECT 회수
--
-- ✅ 사전 확인 (2026-09-03)
--   contact_messages 12건(general 11, partner 1). 정렬은 기존과 같은 created_at 오름차순.
--   type 필터를 서버에서 건다 — 지금은 select('*') 로 다 받아온 뒤 JS 에서 걸러서,
--   문의 관리 탭이 제휴 문의 행까지 받아 버리고 있었다.
--   status 와 검색은 클라이언트에서 거른다. 탭 전환에 재조회가 없어야 하고
--   건수도 적다.
-- ============================================================

create or replace function public.get_admin_contact_messages(
  p_only_type    text default null,   -- 이 유형만 (제휴 문의 탭)
  p_exclude_type text default null    -- 이 유형 제외 (문의 관리 탭)
)
returns setof public.contact_messages
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $fn$
begin
  -- service_role 로 부르면 auth.uid() 가 null 이라 여기서 걸린다.
  -- 이 함수는 관리자 화면(사용자 클라이언트) 전용이다.
  if not exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception '관리자만 조회할 수 있습니다' using errcode = '42501';
  end if;

  return query
    select c.*
      from public.contact_messages c
     where (p_only_type    is null or c.type =  p_only_type)
       and (p_exclude_type is null or c.type <> p_exclude_type)
     order by c.created_at asc;
end;
$fn$;

revoke all on function public.get_admin_contact_messages(text, text) from public, anon;
grant execute on function public.get_admin_contact_messages(text, text) to authenticated;


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- select '1. 함수' as 구분,
--        (proname || ' definer=' || prosecdef::text ||
--         ' ' || coalesce(array_to_string(proconfig, ','), 'search_path 없음'))::text as 값
-- from pg_proc
-- where pronamespace='public'::regnamespace and proname='get_admin_contact_messages'
-- union all
-- select '2. 실행 권한', (grantee || ' : ' || privilege_type)::text
-- from information_schema.routine_privileges
-- where routine_schema='public' and routine_name='get_admin_contact_messages'
-- order by 1, 2;
--
-- 기대:
--   1. definer=true, search_path=public, extensions, pg_temp
--   2. authenticated : EXECUTE (postgres 도 나온다. anon 은 없어야 한다)


-- ============================================================
-- [권한 우회 테스트]
-- ============================================================
-- -- 비로그인 호출 — 막혀야 한다
-- begin;
-- set local role anon;
-- select * from public.get_admin_contact_messages();
-- rollback;
--   → 42501 permission denied for function get_admin_contact_messages
--
-- -- 로그인했지만 관리자가 아닌 경우는 함수 안에서 걸린다
-- --   (SQL 에디터로는 JWT 를 흉내낼 수 없어 앱에서 확인한다)
-- begin;
-- set local role authenticated;
-- select * from public.get_admin_contact_messages();
-- rollback;
--   → 42501 관리자만 조회할 수 있습니다  (auth.uid() 가 null 이라 관리자가 아니다)


-- ============================================================
-- [회귀 테스트]
--   이 단계에서는 아직 화면이 RPC 를 쓰지 않는다. 깨지는 것이 없어야 한다.
--   1. 관리자 문의 관리 탭 → 목록이 그대로 보이는지
--   2. 관리자 제휴 문의 탭 → 그대로인지
--   3. 사용자 '내 문의' → 그대로인지


-- ============================================================
-- [롤백]
-- ============================================================
-- drop function if exists public.get_admin_contact_messages(text, text);
-- select pg_notify('pgrst', 'reload schema');
-- -- ⚠️ 화면을 배포한 뒤에는 이걸 지우면 문의 관리가 깨진다. 코드를 먼저 되돌릴 것.
-- ============================================================
