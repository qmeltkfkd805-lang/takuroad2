-- ============================================================
-- post_comments 쓰기 권한 좁히기
--
-- community_posts_write_privileges.sql 과 같은 문제, 더 단순한 해법.
--
-- 문제:
--   1) authenticated 가 8개 컬럼 전부 UPDATE 가능하고 RLS(post_comments_own)는
--      auth.uid() = author_id 만 본다. 자기 댓글이면 무엇이든 고칠 수 있다.
--        like_count  자기 댓글 좋아요 수 조작 (getComments 가 그대로 표시한다)
--        post_id     자기 댓글을 다른 글로 이동
--        parent_id   아무 댓글의 대댓글로 재배치
--        created_at  댓글 순서 조작 (목록이 created_at 오름차순이다)
--        status      상태 조작
--        id          PK 변경 시도
--   2) anon 에 INSERT·UPDATE·DELETE·TRUNCATE·REFERENCES·TRIGGER 가 남아 있다.
--      community_posts·post_reports 는 post_report_review.sql 에서 걷어냈는데
--      이 테이블만 빠졌다.
--
-- ✅ 사전 확인 (2026-09-03)
--
--  1) 클라이언트가 post_comments 에 쓰는 것은 둘뿐이다.
--       addComment      INSERT (post_id, author_id, content, parent_id)
--       deleteComment   DELETE
--     UPDATE 하는 코드가 **하나도 없다**. 댓글 수정 기능이 아예 없고
--     삭제는 soft delete 가 아니라 진짜 DELETE 다.
--     나머지 참조(commentService, growthService, badgeService,
--     communityPostService 의 검색·카운트)는 전부 SELECT 다.
--     → UPDATE 권한은 통째로 회수한다. 컬럼 GRANT 도 주지 않는다.
--
--  2) 트리거는 trg_post_comment_count → sync_post_comment_count 하나뿐이고
--     prosecdef = true 다. 소유자 권한으로 돌기 때문에 authenticated 의 컬럼
--     권한과 무관하다. community_posts.comment_count 집계는 영향받지 않는다.
--
--  3) post_comments_visible 는 security_invoker=on 이다. RLS 를 우회하지 않는다.
--
--  4) anon 의 INSERT/UPDATE/DELETE 는 RLS 가 이미 막고 있다
--     (auth.uid() 가 null 이라 auth.uid() = author_id 가 NULL → false).
--     TRUNCATE 는 PostgREST 에 엔드포인트가 없어 REST 로 직접 부를 수 없다.
--     둘 다 지금 뚫리는 건 아니지만, 다른 테이블에서 같은 이유로 이미 걷어낸
--     권한이라 맞춘다. TRUNCATE 는 통과하면 RLS 를 완전히 무시한다.
-- ============================================================


-- ── 1) RLS 를 우회하거나 불필요한 권한 회수 ─────────────────
revoke truncate, references, trigger on table public.post_comments from anon, authenticated;
revoke insert, update, delete on table public.post_comments from anon;


-- ── 2) 쓰기 권한 회수 (테이블 + 컬럼) ───────────────────────
-- REVOKE ... ON TABLE 은 테이블 단위 권한만 걷어내고 컬럼 단위 GRANT 는 남긴다.
-- 컬럼 ACL 이 따로 있는지 불확실하므로 8개 컬럼을 명시해 최종 상태를 확정한다.
revoke insert, update on table public.post_comments from authenticated;

revoke insert (
  id, post_id, author_id, parent_id, content, status, like_count, created_at
), update (
  id, post_id, author_id, parent_id, content, status, like_count, created_at
) on table public.post_comments from authenticated;


-- ── 3) addComment 가 쓰는 4개 컬럼만 INSERT 허용 ────────────
-- author_id 는 RLS with_check(auth.uid() = author_id)가 남의 이름으로 쓰는 걸 막는다.
-- id·status·like_count·created_at 은 컬럼 기본값이 채운다. 보낼 필요가 없다.
grant insert (post_id, author_id, content, parent_id)
  on table public.post_comments to authenticated;

-- UPDATE 는 아무 컬럼도 주지 않는다. 쓰는 코드가 없다.
-- 댓글 수정 기능이 생기면 그때 content 하나만 열면 된다.

-- DELETE 는 그대로 둔다. RLS(post_comments_own / post_comments_admin)가
-- 본인 댓글과 관리자로 제한한다.


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]  ※ 에디터가 마지막 문장 결과만 보여주므로 한 문장으로 묶었다
-- ============================================================
-- select '1. 테이블 권한' as 구분, (grantee || ' : ' || privilege_type)::text as 값
-- from information_schema.role_table_grants
-- where table_schema='public' and table_name='post_comments'
--   and grantee in ('anon','authenticated')
-- union all
-- select '2. INSERT 허용 컬럼', column_name::text
-- from information_schema.column_privileges
-- where table_schema='public' and table_name='post_comments'
--   and grantee='authenticated' and privilege_type='INSERT'
-- union all
-- select '3. UPDATE 허용 컬럼', column_name::text
-- from information_schema.column_privileges
-- where table_schema='public' and table_name='post_comments'
--   and grantee='authenticated' and privilege_type='UPDATE'
-- order by 1, 2;
--
-- 기대:
--   1. anon : SELECT           (1줄만)
--      authenticated : SELECT, DELETE  (2줄)
--   2. author_id, content, parent_id, post_id  (4줄)
--   3. 한 줄도 없음


-- ============================================================
-- [권한 우회 테스트]  한 덩어리로 선택해서 실행
-- ============================================================
-- begin;
-- set local role authenticated;
-- update public.post_comments set like_count = 9999
--  where id = '00000000-0000-0000-0000-000000000000';
-- rollback;
--   → 42501 permission denied  (성공)
--   ※ Supabase 가 붙이는 HINT(GRANT UPDATE ... TO authenticated)는 따르지 말 것.
--      이번 변경을 통째로 되돌린다.
--
-- content, post_id, created_at, status 로 바꿔 넣어도 전부 42501 이어야 한다.


-- ============================================================
-- [회귀 테스트] — 사용자 사이트
--   1. 댓글 작성 → 정상
--   2. 대댓글 작성 → parent_id 정상
--   3. 댓글 삭제 → 정상
--   4. 글의 댓글 수(comment_count) 증감 → 정상 (트리거가 definer)
--   5. 댓글 좋아요 토글 → 정상 (comment_likes 테이블, 이 변경과 무관)
--   6. 마이페이지 '내 댓글' 목록 → 정상 (SELECT)
--   7. 커뮤니티 검색 '댓글' 필터 → 정상 (SELECT)


-- ============================================================
-- [롤백]
-- ============================================================
-- -- ⚠️ 취약한 상태로 되돌리는 것이다
-- -- grant insert, update on table public.post_comments to authenticated;
-- -- grant insert, update, delete on table public.post_comments to anon;
-- -- grant truncate, references, trigger on table public.post_comments to anon, authenticated;
-- select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [후속 과제]
-- - post_comments_select 가 using=true 다. 모든 댓글이 status 와 무관하게
--   누구에게나 조회된다. 지금은 status 를 'active' 아닌 값으로 바꾸는 코드가
--   없어서 새는 것이 없지만, 댓글 숨김/신고 기능을 만들면 그날부터
--   숨긴 댓글이 REST 로 그대로 노출된다. 그 기능과 함께 정책을 좁혀야 한다.
-- - post_comments_own 이 cmd=ALL 이다. UPDATE 권한을 회수한 지금 그 정책의
--   UPDATE 갈래는 도달 불가능하다. SELECT/INSERT/DELETE 로 쪼갤 수 있지만
--   동작 변화가 없어 이번에는 두었다.
-- - review_comments 도 같은 구조인지 아직 보지 않았다. is_deleted 를 쓰는 걸로
--   보아 soft delete 라 status 계열 컬럼이 더 있을 수 있다.
-- ============================================================
