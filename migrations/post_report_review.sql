-- ============================================================
-- 게시글 신고 처리 상태 + 관리자 처리 RPC
--
-- 문제: post_reports 에는 처리 상태가 없어 신고가 쌓이기만 했다. 관리자가
--       "봤고 문제없다"를 기록할 방법이 없어서, 같은 신고를 볼 때마다 다시 판단해야 했다.
--       실제로 존재하는 상태는 community_posts.status(active/hidden) 하나뿐이었다.
--
-- 축을 섞지 않는다:
--   community_posts.status  게시글 공개 여부 (active / hidden)
--   post_reports.status     신고 처리 진행도 (pending / dismissed / resolved)  ← 여기서 추가
--
-- 상태 의미:
--   pending    미처리
--   dismissed  신고를 확인했지만 게시글 조치는 필요 없다고 판단
--   resolved   게시글 숨김 등 실제 조치를 수행
--   게시글을 나중에 복구해도 과거 신고 상태는 pending 으로 되돌리지 않는다.
--
-- ✅ 사전 확인 (2026-09-03)
--    post_reports 0건 → backfill 없음, 잠금 순간. NOT NULL DEFAULT 를 한 번에 줘도 된다.
--    RLS: post_reports 의 UPDATE·DELETE 정책은 post_reports_admin(ALL, admin) 하나뿐이라
--         일반 사용자는 애초에 UPDATE 를 못 한다 → 검수 컬럼에 별도 컬럼 권한이 필요 없다.
--    기존 트리거 trg_post_report_autohide(임계값 10, 같은 reason·신뢰 신고자만) 는 건드리지 않는다.
-- ============================================================


-- ── 1) 검수 컬럼 ────────────────────────────────────────────
alter table public.post_reports
  add column if not exists status text not null default 'pending';

-- 처리한 관리자. 계정이 지워져도 신고와 처리 시각은 남아야 하므로 set null.
alter table public.post_reports
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;

alter table public.post_reports
  add column if not exists reviewed_at timestamptz;

alter table public.post_reports drop constraint if exists post_reports_status_chk;
alter table public.post_reports add constraint post_reports_status_chk
  check (status in ('pending', 'dismissed', 'resolved'));


-- ── 2) 대기열 조회용 부분 인덱스 ────────────────────────────
-- 미처리만 담는다. 대기열이 비면 인덱스도 비어 비용이 거의 없다.
create index if not exists post_reports_pending_idx
  on public.post_reports (post_id, created_at)
  where status = 'pending';


-- ── 3) RLS 를 우회하는 권한 회수 ────────────────────────────
-- TRUNCATE 는 RLS 를 완전히 무시한다. 통과하면 게시글이 통째로 사라지고
-- post_reports 가 FK CASCADE 로 함께 지워진다.
-- TRIGGER 는 이 테이블에 자기 함수를 붙일 수 있는 권한이다.
revoke truncate, references, trigger on table public.post_reports    from anon, authenticated;
revoke truncate, references, trigger on table public.community_posts from anon, authenticated;

-- anon 은 RLS(auth.uid() 기반)로 이미 전부 막혀 있다. 방어선을 하나 더 겹친다.
revoke insert, update, delete on table public.post_reports    from anon;
revoke insert, update, delete on table public.community_posts from anon;

-- ⚠️ authenticated 의 community_posts UPDATE 는 이번에 건드리지 않는다.
--    cposts_author_update 가 컬럼 제한 없이 "작성자는 자기 글 전부 수정" 이라
--    작성자가 자동 숨김된 자기 글을 status='active' 로 되돌릴 수 있다.
--    별도 보안 작업으로 분리한다(컬럼 단위 GRANT + status 전이 트리거).


-- ── 4) 관리자 처리 RPC ──────────────────────────────────────
-- 게시글 상태 변경과 신고 처리를 한 트랜잭션에서 끝낸다.
-- plpgsql 함수 본문은 단일 트랜잭션이라 중간에 실패하면 전부 롤백된다.
-- API 에서 순차 요청 두 번으로 나누면 "글은 숨겨졌는데 신고는 pending" 이 생긴다.
--
-- 실행 권한은 service_role 에만 준다. 서버 라우트(/api/admin/post-report)가
-- 사용자 클라이언트로 admin 을 확인한 뒤 service_role 로 호출한다.
-- service_role 은 JWT 가 없어 auth.uid() 가 null 이므로 is_admin() 을 쓸 수 없다.
-- 대신 p_admin_id 를 받아 함수 안에서 다시 검증한다 — 라우트가 잘못돼도 여기서 걸린다.
create or replace function public.admin_resolve_post_reports(
  p_post_id  uuid,
  p_action   text,   -- 'dismiss' | 'hide_and_resolve' | 'restore'
  p_admin_id uuid
)
returns json
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_status   text;
  v_affected int := 0;
begin
  if not exists (
    select 1 from public.profiles p where p.id = p_admin_id and p.role = 'admin'
  ) then
    raise exception '관리자만 처리할 수 있습니다' using errcode = '42501';
  end if;

  if p_action not in ('dismiss', 'hide_and_resolve', 'restore') then
    raise exception '알 수 없는 동작입니다' using errcode = '22023';
  end if;

  -- 같은 글을 두 관리자가 동시에 처리하는 경우를 막는다
  select status into v_status
    from public.community_posts where id = p_post_id
    for update;
  if not found then
    raise exception '게시글을 찾을 수 없습니다' using errcode = 'P0002';
  end if;

  if p_action = 'dismiss' then
    update public.post_reports
       set status = 'dismissed', reviewed_by = p_admin_id, reviewed_at = now()
     where post_id = p_post_id and status = 'pending';
    get diagnostics v_affected = row_count;

  elsif p_action = 'hide_and_resolve' then
    -- 이미 숨겨진 글(자동 숨김 포함)이면 상태는 그대로 두고 신고만 처리한다
    if v_status <> 'hidden' then
      update public.community_posts
         set status = 'hidden', hidden_by = 'admin', hidden_at = now()
       where id = p_post_id;
    end if;
    update public.post_reports
       set status = 'resolved', reviewed_by = p_admin_id, reviewed_at = now()
     where post_id = p_post_id and status = 'pending';
    get diagnostics v_affected = row_count;

  else  -- restore
    -- 기존 restorePost 와 동일하게 status 만 바꾼다.
    -- 과거 신고의 dismissed/resolved 는 건드리지 않는다.
    update public.community_posts
       set status = 'active'
     where id = p_post_id;
  end if;

  return json_build_object('ok', true, 'action', p_action, 'reports', v_affected, 'post_status', v_status);
end;
$fn$;

revoke all on function public.admin_resolve_post_reports(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_resolve_post_reports(uuid, text, uuid) to service_role;


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- -- 1) 컬럼·제약·인덱스
-- select column_name, data_type, column_default, is_nullable
-- from information_schema.columns
-- where table_schema='public' and table_name='post_reports'
--   and column_name in ('status','reviewed_by','reviewed_at');
--
-- select conname, pg_get_constraintdef(oid) from pg_constraint
-- where conrelid='public.post_reports'::regclass
--   and conname in ('post_reports_status_chk','post_reports_reviewed_by_fkey');
--
-- select indexname from pg_indexes
-- where schemaname='public' and tablename='post_reports' and indexname='post_reports_pending_idx';
--
-- -- 2) 위험 권한이 걷혔는가 (TRUNCATE/REFERENCES/TRIGGER 가 없어야 한다)
-- select table_name, grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema='public' and table_name in ('post_reports','community_posts')
--   and grantee in ('anon','authenticated')
-- order by table_name, grantee, privilege_type;
--
-- -- 3) RPC 가 생겼는가 + 실행 권한이 service_role 뿐인가
-- select proname, prosecdef from pg_proc
-- where pronamespace='public'::regnamespace and proname='admin_resolve_post_reports';
--
-- select grantee, privilege_type from information_schema.routine_privileges
-- where routine_schema='public' and routine_name='admin_resolve_post_reports';


-- ============================================================
-- [권한 우회 테스트] 일반 사용자 액세스 토큰으로 (curl/Postman)
--   PATCH /rest/v1/post_reports?id=eq.<신고> {"status":"dismissed"}
--        → RLS 위반. UPDATE 정책이 admin 전용뿐이라 0건 갱신 또는 거부
--   POST  /rest/v1/rpc/admin_resolve_post_reports {"p_post_id":..,"p_action":"dismiss","p_admin_id":<내 id>}
--        → 실행 권한 없음(service_role 전용)
--   같은 글에 두 번 신고 → 23505 (post_id, reporter_id UNIQUE)
--
-- [회귀 테스트]
--   1. 일반 사용자 게시글 신고 → 정상 접수, status='pending' 기본값
--   2. 같은 글 재신고 → duplicate 처리(기존 동작 그대로)
--   3. 관리자 신고 반려 → 그 글의 pending 이 전부 dismissed, 게시글 상태 변화 없음
--   4. 관리자 글 숨김 → 게시글 hidden(hidden_by='admin'), pending 이 전부 resolved
--   5. 이미 자동 숨김된 글에 숨김 처리 → 상태는 그대로, 신고만 resolved
--   6. 숨김 글 다시 공개 → status='active', 과거 신고 상태는 그대로
--   7. 자동 숨김 트리거(임계값 10) 동작 변화 없음
--   8. 작성자 이의제기 접수·조회 변화 없음


-- ============================================================
-- [롤백]
-- ============================================================
-- drop function if exists public.admin_resolve_post_reports(uuid, text, uuid);
-- drop index if exists public.post_reports_pending_idx;
-- alter table public.post_reports drop constraint if exists post_reports_status_chk;
-- alter table public.post_reports drop column if exists reviewed_at;
-- alter table public.post_reports drop column if exists reviewed_by;
-- alter table public.post_reports drop column if exists status;
-- -- ⚠️ 아래 권한 롤백은 취약한 상태로 되돌리는 것이다
-- -- grant truncate, references, trigger on table public.post_reports    to anon, authenticated;
-- -- grant truncate, references, trigger on table public.community_posts to anon, authenticated;
-- -- grant insert, update, delete on table public.post_reports    to anon;
-- -- grant insert, update, delete on table public.community_posts to anon;
-- select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [후속 과제]
-- 🔴 cposts_author_update 가 컬럼 제한 없이 "작성자는 자기 글 전부 수정" 이다.
--    작성자가 신고로 자동 숨김된 자기 글을 status='active' 로 되돌릴 수 있고,
--    is_notice=true 로 공지 행세도 가능하다. shops 와 같은 방식으로
--    컬럼 단위 GRANT + status 전이 트리거가 필요하다.
-- - cposts_author_update / cposts_update_own, cposts_author_delete / cposts_delete_own
--   이 각각 같은 의미로 중복돼 있다. 정리 대상.
-- - 관리자가 직접 숨길 때는 hidden_reason 을 채우지 않는다(신고 사유가 여러 개일 수 있어
--   하나로 단정하지 않는다). 자동 숨김만 hidden_reason 이 남는다.
-- ============================================================
