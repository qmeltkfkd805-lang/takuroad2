-- ============================================================
-- 커뮤니티 쓰기 권한 정리
--   - post_likes / comment_likes 의 과다 권한 회수
--   - post_comments_visible 뷰를 읽기 전용으로
--   - post_comments_own 정책을 실제로 필요한 DELETE 로 좁힘
--
-- 왜:
--   schema_default_privileges.sql 이전의 전면 부여(grant all) 흔적이 남아 있다.
--   anon 이 좋아요 테이블에 INSERT·UPDATE·DELETE 를, 뷰에도 쓰기 권한을 갖고 있다.
--   정책이 auth.uid() = user_id 라 anon 이 실제로 넣지는 못하지만,
--   정책 하나가 잘못되는 순간 곧바로 뚫리는 상태다. 쓰지 않는 권한은 남기지 않는다.
--
-- ✅ 사전 확인 (2026-09-07)
--
--  1) 코드에서 두 좋아요 테이블을 쓰는 곳 전수 확인
--       likedSetFor / getComments        SELECT (userId 없으면 요청 자체를 안 보냄)
--       togglePostLike/toggleCommentLike SELECT · INSERT · DELETE
--       growthService / badgeService     SELECT (남의 행까지 — 정책이 using=true)
--     UPDATE 를 쓰는 곳은 한 군데도 없다. anon 은 읽지도 쓰지도 않는다.
--     그래도 anon 의 SELECT 는 남긴다 — 좋아요 수는 community_posts.like_count 로
--     보여주지만, 조회는 무해하고 회수 이득이 없다.
--
--  2) INSERT 로 보내는 컬럼
--       post_likes    { post_id, user_id }
--       comment_likes { comment_id, user_id }
--     created_at 은 안 보낸다. 오늘 좋아요가 정상 저장된 것으로 기본값이 확인됐다.
--
--  3) post_comments 의 정책 4개 중
--       post_comments_select [SELECT]  ← 글 가시성을 따라감 (community_visibility_policies.sql)
--       post_comments_insert [INSERT]  check (auth.uid() = author_id)
--       post_comments_own    [ALL]     using (auth.uid() = author_id)   ← 범위가 넓다
--       post_comments_admin  [ALL]     관리자
--     own 이 ALL 이라 SELECT·INSERT 까지 덮는데, 그 둘은 이미 전용 정책이 있다.
--     UPDATE 는 컬럼 권한이 0이라 애초에 불가능하다
--     (post_comments_write_privileges.sql 에서 8→0 으로 회수했다).
--     실제로 own 이 하는 일은 DELETE 하나뿐이다 — deleteComment.
--
--  4) post_comments_visible 은 security_invoker=on 이라 쓰기가 어차피 테이블
--     권한에서 막힌다. 그래도 뷰에 쓰기 권한을 열어둘 이유가 없다.
--     (TRIGGER·TRUNCATE 는 schema_default_privileges.sql 에서 이미 회수했다)
--
-- 기능 영향: 없어야 한다. 회수하는 것 중 앱이 쓰는 권한은 하나도 없다.
-- ============================================================


-- ── 1. 좋아요 테이블: anon 의 쓰기 권한 전부 회수 ───────────
revoke insert, update, delete, references on public.post_likes    from anon;
revoke insert, update, delete, references on public.comment_likes from anon;


-- ── 2. 좋아요 테이블: authenticated 의 안 쓰는 권한 회수 ────
revoke update, references on public.post_likes    from authenticated;
revoke update, references on public.comment_likes from authenticated;


-- ── 3. 좋아요 INSERT 를 필요한 컬럼으로 좁힘 ────────────────
-- 컬럼 단위로는 회수가 안 되므로, 테이블 권한을 걷고 컬럼만 다시 준다.
revoke insert on public.post_likes from authenticated;
grant  insert (post_id, user_id) on public.post_likes to authenticated;

revoke insert on public.comment_likes from authenticated;
grant  insert (comment_id, user_id) on public.comment_likes to authenticated;


-- ── 4. 뷰는 읽기 전용으로 ───────────────────────────────────
revoke insert, update, delete, references
  on public.post_comments_visible from anon, authenticated;


-- ── 5. 댓글 정책: own 을 DELETE 로 좁힘 ─────────────────────
-- SELECT 는 post_comments_select, INSERT 는 post_comments_insert 가 담당한다.
-- UPDATE 는 컬럼 권한이 0이라 불가능하다.
drop policy if exists post_comments_own on public.post_comments;

create policy post_comments_own on public.post_comments
  for delete
  using (auth.uid() = author_id);


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- select '1. 테이블 권한' as 구분,
--        (table_name || ' / ' || grantee || ' : ' || privilege_type)::text as 값
-- from information_schema.table_privileges
-- where table_schema='public'
--   and table_name in ('post_likes','comment_likes','post_comments_visible')
--   and grantee in ('anon','authenticated')
-- union all
-- select '2. 컬럼 INSERT', (table_name || ' / ' || grantee || ' : ' || column_name)::text
-- from information_schema.column_privileges
-- where table_schema='public' and table_name in ('post_likes','comment_likes')
--   and grantee in ('anon','authenticated') and privilege_type='INSERT'
-- union all
-- select '3. 댓글 정책', (policyname || ' [' || cmd || ']')::text
-- from pg_policies where schemaname='public' and tablename='post_comments'
-- order by 1, 2;
--
-- 기대:
--   1. post_likes / comment_likes  → anon 은 SELECT 하나만
--                                    authenticated 는 SELECT, DELETE (INSERT 는 컬럼 단위라 여기 안 나온다)
--      post_comments_visible       → 양쪽 다 SELECT 하나만
--   2. post_likes    / authenticated : post_id, user_id
--      comment_likes / authenticated : comment_id, user_id
--      (anon 은 한 줄도 없어야 한다)
--   3. post_comments_admin [ALL], post_comments_insert [INSERT],
--      post_comments_own [DELETE], post_comments_select [SELECT]


-- ============================================================
-- [권한 우회 테스트]
-- ============================================================
-- -- 비로그인이 좋아요를 넣으려는 시도 — 권한에서 막혀야 한다
-- begin;
-- set local role anon;
-- insert into public.post_likes (post_id, user_id)
-- values ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000');
-- rollback;
--   → 42501 permission denied for table post_likes
--
-- -- 좋아요 행을 고치려는 시도 — 막혀야 한다
-- begin;
-- set local role authenticated;
-- update public.post_likes set user_id = user_id;
-- rollback;
--   → 42501
--
-- -- 뷰로 쓰려는 시도 — 막혀야 한다
-- begin;
-- set local role authenticated;
-- delete from public.post_comments_visible;
-- rollback;
--   → 42501
--
-- -- 읽기는 그대로여야 한다
-- begin;
-- set local role anon;
-- select count(*) from public.post_comments_visible;
-- rollback;
--   → 2


-- ============================================================
-- [회귀 테스트] — 앱에서 확인
--   1. 글 좋아요 눌렀다 취소, 새로고침 후 유지되는지
--   2. 댓글 좋아요 눌렀다 취소
--   3. 댓글 작성 · 답글 작성
--   4. 내 댓글 삭제  ← post_comments_own 을 DELETE 로 좁힌 부분
--   5. 관리자 계정으로 남의 댓글 삭제 (post_comments_admin)
--   6. 비로그인으로 글 상세 열어 댓글이 보이는지
--   7. 프로필의 활동·배지 숫자(받은 좋아요 집계)


-- ============================================================
-- [롤백]
-- ============================================================
-- grant insert, update, delete, references on public.post_likes    to anon, authenticated;
-- grant insert, update, delete, references on public.comment_likes to anon, authenticated;
-- grant insert, update, delete, references on public.post_comments_visible to anon, authenticated;
--
-- drop policy if exists post_comments_own on public.post_comments;
-- create policy post_comments_own on public.post_comments
--   for all using (auth.uid() = author_id);
--
-- select pg_notify('pgrst', 'reload schema');
-- ============================================================
