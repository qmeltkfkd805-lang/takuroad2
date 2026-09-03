-- ============================================================
-- community_posts 쓰기 권한 좁히기
--
-- 문제: authenticated 가 community_posts 의 모든 컬럼에 UPDATE 권한을 갖고,
--       RLS(cposts_author_update)는 author_id = auth.uid() 만 본다.
--       즉 작성자는 자기 글의 아무 컬럼이나 고칠 수 있다.
--
--   status        신고 누적으로 자동 숨김된 글을 'active' 로 되살린다 → 이의제기 절차 무력화
--   is_notice     자기 글을 공지로 승격 (notice_all 이면 전체 공지)
--   like_count    getPopularPosts 가 이 값으로 정렬한다. 대표 팬아트 선정에도 쓰인다
--   view_count    increment_post_view RPC 를 거치지 않고 직접 증가
--   comment_count 실제 댓글 수와 무관하게 조작
--   created_at    최신순 목록 상단 고정
--   hidden_by     심사 기록 위조 (누가 왜 숨겼는지)
--   author_id, id RLS with_check 가 막고 있지만 같이 회수한다
--
-- 해법: 컬럼 단위 GRANT. UPDATE 트리거는 만들지 않는다 —
--       status 를 아예 쓸 수 없게 하면 전이 규칙을 검사할 트리거가 도달 불가능한
--       코드가 된다. 권한으로 막을 수 있는 것을 트리거로 막지 않는다.
--
-- ✅ 사전 확인 (2026-09-03)
--
--  1) 클라이언트가 실제로 쓰는 컬럼 (communityPostService.ts)
--     createPost         board, tag_id, tag_ids, author_id, title, content, images,
--                        show_on_work, is_notice, notice_all, is_spoiler, flair
--     updatePost         board, tag_id, tag_ids, title, content, images,
--                        show_on_work, is_spoiler, flair
--     setPostVisibility  visibility
--     deletePost         DELETE (컬럼 권한과 무관)
--     → 아래 GRANT 목록이 이걸 전부 덮는다.
--
--  2) hidePost / setNotice 는 죽은 코드다.
--     hidePost 의 유일한 호출부인 PostUI.tsx 의 onHide 는 정의만 있고 JSX 어디에서도
--     쓰이지 않는다(작성자 케밥 메뉴는 수정하기/나만보기/삭제하기 셋뿐).
--     setNotice 는 호출부가 아예 없다. 공지 지정은 PostWritePage 의 작성 시점
--     체크박스(isAdmin && isNotice)로만 이뤄지고 그건 INSERT 다.
--     → status·hidden_*·is_notice 의 UPDATE 권한을 회수해도 깨지는 화면이 없다.
--
--  3) createPost 는 일반 사용자 글에도 is_notice/notice_all 을 항상 실어 보낸다.
--     회수하면 글 작성 전체가 깨진다 → INSERT 에는 남기고 트리거로 강제한다.
--
--  4) community_posts 를 건드리는 트리거 함수는 전부 prosecdef = true 다.
--     sync_post_like_count, sync_post_comment_count, increment_post_view,
--     post_report_autohide, invalidate_featured_on_post_change,
--     notify_followers_on_post
--     → 소유자 권한으로 실행되므로 authenticated 의 컬럼 권한과 무관하다.
--       카운터 갱신과 자동 숨김은 이 변경의 영향을 받지 않는다.
--
--  5) community_posts_visible 는 security_invoker=on 이다. RLS 를 우회하지 않는다.
-- ============================================================


-- ── 1) 기존 쓰기 권한 회수 ──────────────────────────────────
-- 테이블 단위와 컬럼 단위를 모두 회수한다.
-- REVOKE ... ON TABLE 은 테이블 단위 권한만 걷어내고 컬럼 단위 GRANT 는 남긴다.
-- 지금 컬럼 ACL 이 따로 있는지 불확실하므로 양쪽 다 명시해 최종 상태를 확정한다.
revoke insert, update on table public.community_posts from authenticated;

revoke insert (
  id, board, tag_id, author_id, title, content, images, show_on_work,
  status, hidden_reason, hidden_at, hidden_by,
  view_count, like_count, comment_count, created_at,
  is_notice, notice_all, visibility, is_spoiler, flair, tag_ids
), update (
  id, board, tag_id, author_id, title, content, images, show_on_work,
  status, hidden_reason, hidden_at, hidden_by,
  view_count, like_count, comment_count, created_at,
  is_notice, notice_all, visibility, is_spoiler, flair, tag_ids
) on table public.community_posts from authenticated;

-- anon 은 지난 migration(post_report_review.sql)에서 이미 SELECT 만 남았다.
-- 방어선을 하나 더 겹친다.
revoke insert, update, delete on table public.community_posts from anon;


-- ── 2) 작성자가 실제로 쓰는 컬럼만 다시 부여 ────────────────
-- INSERT — createPost 가 보내는 것 + visibility.
--   author_id 는 RLS with_check(auth.uid() = author_id)가 남의 이름으로 쓰는 걸 막는다.
--   is_notice / notice_all 은 아래 트리거가 관리자가 아니면 false 로 강제한다.
--   id·created_at·status·counters 는 컬럼 기본값이 채운다. 보낼 필요가 없다.
grant insert (
  board, tag_id, tag_ids, author_id, title, content, images,
  show_on_work, visibility, is_spoiler, flair, is_notice, notice_all
) on table public.community_posts to authenticated;

-- UPDATE — updatePost + setPostVisibility 가 보내는 것뿐.
--   status·hidden_*·is_notice·notice_all·counters·created_at·author_id·id 는 없다.
grant update (
  board, tag_id, tag_ids, title, content, images,
  show_on_work, visibility, is_spoiler, flair
) on table public.community_posts to authenticated;


-- ── 3) 공지 승격 차단 (INSERT) ──────────────────────────────
-- is_notice / notice_all 은 INSERT 권한을 남겨둘 수밖에 없어서 트리거로 막는다.
-- BEFORE 트리거의 NEW 대입은 컬럼 권한 검사를 거치지 않는다 —
-- 권한은 문장이 지정한 대상 컬럼에만 적용되기 때문이다.
create or replace function public.cposts_guard_notice_on_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
begin
  if coalesce(new.is_notice, false) or coalesce(new.notice_all, false) then
    if not exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'admin'
    ) then
      -- 조용히 내린다. 예외를 던지면 createPost 가 통째로 실패해서
      -- 정상 글 작성까지 막힌다(클라이언트가 항상 이 두 값을 실어 보낸다).
      new.is_notice  := false;
      new.notice_all := false;
    end if;
  end if;
  return new;
end;
$fn$;

revoke all on function public.cposts_guard_notice_on_insert() from public, anon, authenticated;

drop trigger if exists cposts_guard_notice on public.community_posts;
create trigger cposts_guard_notice
  before insert on public.community_posts
  for each row execute function public.cposts_guard_notice_on_insert();


-- ── 4) 중복 정책 정리 ───────────────────────────────────────
-- cposts_update_own 은 cposts_author_update 와, cposts_delete_own 은
-- cposts_author_delete 와 완전히 같은 조건이다(author_id = auth.uid()).
-- permissive 정책은 OR 로 합쳐지므로 하나를 지워도 동작이 같다.
drop policy if exists cposts_update_own on public.community_posts;
drop policy if exists cposts_delete_own on public.community_posts;


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- -- 1) 테이블 단위에 INSERT/UPDATE 가 남아있지 않아야 한다
-- --    (authenticated 는 SELECT, DELETE 만 / anon 은 SELECT 만)
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema='public' and table_name='community_posts'
--   and grantee in ('anon','authenticated')
-- order by grantee, privilege_type;
--
-- -- 2) 진짜 컬럼 ACL 확인 (information_schema.column_privileges 는 테이블 권한을
-- --    펼쳐서 보여주므로 구분이 안 된다. pg_attribute.attacl 이 실제 컬럼 ACL 이다)
-- select a.attname, a.attacl
-- from pg_attribute a
-- where a.attrelid='public.community_posts'::regclass
--   and a.attnum > 0 and not a.attisdropped
-- order by a.attnum;
--
-- -- 3) UPDATE 가 허용된 컬럼이 정확히 10개인가
-- select grantee, column_name, privilege_type
-- from information_schema.column_privileges
-- where table_schema='public' and table_name='community_posts'
--   and grantee='authenticated' and privilege_type='UPDATE'
-- order by column_name;
-- -- 기대: board, content, flair, images, is_spoiler, show_on_work,
-- --       tag_id, tag_ids, title, visibility  (10개)
--
-- -- 4) 트리거와 정책
-- select tgname from pg_trigger
-- where tgrelid='public.community_posts'::regclass and not tgisinternal;
-- -- 기대: cposts_guard_notice, trg_invalidate_featured_delete,
-- --       trg_invalidate_featured_update, trg_notify_followers_on_post
--
-- select policyname, cmd from pg_policies
-- where schemaname='public' and tablename='community_posts' order by cmd, policyname;
-- -- 기대: cposts_admin(ALL), cposts_author_delete(DELETE), cposts_insert(INSERT),
-- --       cposts_select(SELECT), cposts_author_update(UPDATE)  ← _own 둘은 사라짐


-- ============================================================
-- [권한 우회 테스트] 일반 사용자 액세스 토큰으로 (curl/Postman)
--   자기 글 id 를 넣고:
--   PATCH /rest/v1/community_posts?id=eq.<내글> {"status":"active"}
--        → 42501 permission denied for column status
--   PATCH /rest/v1/community_posts?id=eq.<내글> {"like_count":9999}
--        → 42501 permission denied for column like_count
--   PATCH /rest/v1/community_posts?id=eq.<내글> {"is_notice":true}
--        → 42501 permission denied for column is_notice
--   PATCH /rest/v1/community_posts?id=eq.<내글> {"title":"수정"}
--        → 200 (정상 수정은 그대로 된다)
--   POST  /rest/v1/community_posts {"board":"free","author_id":"<나>","is_notice":true,...}
--        → 201 이지만 저장된 행은 is_notice=false (트리거가 내린다)
--
-- [회귀 테스트] — 사용자 사이트
--   1. 글 작성 (일반 사용자) → 정상, is_notice=false
--   2. 글 작성 (관리자, 공지 체크) → is_notice=true, notice_all 은 선택대로
--   3. 글 수정 (제목·본문·이미지·게시판·작품태그·말머리·스포일러) → 정상
--   4. 나만보기 / 전체 공개 토글 → 정상
--   5. 글 삭제 (굿즈 자랑 포함) → 정상
--   6. 좋아요 토글 → like_count 증감 정상 (트리거가 definer 라 영향 없음)
--   7. 댓글 작성·삭제 → comment_count 증감 정상
--   8. 글 열람 → view_count 증가 정상 (increment_post_view RPC)
--   9. 신고 10건 누적 → 자동 숨김 동작 정상 (post_report_autohide 가 definer)
--  10. 관리자 게시글 신고 화면 → 반려·숨김·다시 공개 정상 (service_role RPC)
--
-- [핵심 회귀] 자동 숨김된 글의 작성자가 status 를 되돌릴 수 없어야 한다.
--   숨김 글의 작성자 토큰으로 PATCH {"status":"active"} → 42501


-- ============================================================
-- [롤백]
-- ============================================================
-- drop trigger if exists cposts_guard_notice on public.community_posts;
-- drop function if exists public.cposts_guard_notice_on_insert();
-- create policy cposts_update_own on public.community_posts
--   for update using (auth.uid() = author_id);
-- create policy cposts_delete_own on public.community_posts
--   for delete using (auth.uid() = author_id);
-- -- ⚠️ 아래는 취약한 상태로 되돌리는 것이다
-- -- grant insert, update on table public.community_posts to authenticated;
-- select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [후속 과제]
-- - post_comments 가 같은 구조일 가능성이 높다. 작성자가 자기 댓글의
--   status·like_count 를 직접 고칠 수 있는지 확인이 필요하다.
-- - PostUI.tsx 의 onHide, communityPostService 의 hidePost·setNotice 는
--   호출부가 없는 죽은 코드다. 이 migration 이후로는 실행되면 권한 오류가 난다.
--   지우는 편이 안전하다.
-- - community_posts.status 에 check 제약이 없다. 값은 active/hidden 둘뿐이지만
--   DB 가 강제하지 않는다. 지금은 authenticated 가 쓸 수 없어 급하지 않다.
-- ============================================================
