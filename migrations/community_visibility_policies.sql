-- ============================================================
-- 숨긴 글과 그 댓글이 그대로 읽히던 문제
--
-- 왜:
--   1) cposts_select 가 status 를 보지 않는다.
--        using = (coalesce(visibility,'public') = 'public'
--                 or author_id = auth.uid() or 관리자)
--      관리자가 신고 처리로 글을 숨길 때 바꾸는 건 status = 'hidden' 이다
--      (admin_resolve_post_reports). visibility 는 그대로 'public' 이다.
--      그래서 숨긴 글이 정책을 그대로 통과한다.
--
--      화면에서도 샌다. 목록 조회는 전부 .eq('status','active') 를 걸지만
--      상세 조회 getPost(communityPostService.ts:166)에는 status 필터가 없다.
--      즉 숨긴 글도 주소만 알면 상세 페이지가 열린다.
--
--   2) post_comments_select 가 using = true 다.
--      글이 숨겨졌든 말든 그 글의 댓글은 anon 까지 전부 읽힌다.
--
-- 고치는 방향:
--   글은 "active 이고 public" 일 때만 일반 공개. 작성자와 관리자는 계속 본다
--   (이의제기 흐름에 작성자가 자기 숨긴 글을 봐야 한다. MyPostsPage 도
--    post.status === 'hidden' 으로 표시한다).
--   댓글은 글의 가시성을 따라간다 — 정책 안에서 community_posts 를 참조하면
--   그 테이블의 RLS 가 호출자 기준으로 같이 걸리므로, 안 보이는 글의 댓글은
--   자동으로 안 보인다.
--
-- ✅ 사전 확인 (2026-09-07, 실제 조회 결과)
--
--  1) community_posts_visible / post_comments_visible 둘 다
--     security_invoker=on 이다. 뷰로 읽어도 테이블의 RLS 가 호출자 기준으로
--     그대로 적용된다 => 정책만 고치면 화면까지 같이 막힌다.
--     (뷰는 차단 사용자 필터 is_blocked_between 일 뿐 권한 경계가 아니다)
--
--  2) 정책 식은 호출자 권한으로 평가된다. 댓글 정책이 참조할
--     community_posts 의 id·status·visibility·author_id 에 대해
--     anon 이 SELECT 권한을 갖고 있는 것을 확인했다.
--
--  3) status 값은 active(15) / hidden(1) 두 가지다. 삭제는 하드 삭제라
--     'deleted' 상태가 없다(/api/community/post/[id] DELETE).
--
--  4) 관리자는 cposts_admin / post_comments_admin 이 [ALL] 이라 그대로 다 본다.
--
--  5) 재귀 없음 — community_posts 의 정책은 post_comments 를 참조하지 않는다.
--
-- 영향 (의도한 동작 변화):
--   - 숨긴 글의 상세 페이지가 남에게는 "글을 찾을 수 없어요"로 뜬다
--   - 커뮤니티 검색이 숨긴 글의 댓글을 더 이상 긁지 않는다
--   - 전체 댓글 수 통계(getCommunityStats)가 숨긴 글의 댓글을 빼고 센다
--   전부 원래 그래야 하는 동작이다.
-- ============================================================


-- ── B. 글: status 도 본다 ───────────────────────────────────
-- 기존 식에서 바뀌는 부분은 "status 가 active" 조건 하나뿐이다.
-- 작성자·관리자 분기는 그대로 둔다.
drop policy if exists cposts_select on public.community_posts;

create policy cposts_select on public.community_posts
  for select
  using (
    (coalesce(status, 'active') = 'active' and coalesce(visibility, 'public') = 'public')
    or (author_id = auth.uid())
    or (exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'admin'
    ))
  );


-- ── C. 댓글: 글의 가시성을 따라간다 ─────────────────────────
-- exists 안의 community_posts 조회에도 그 테이블의 RLS 가 걸린다.
-- 그래서 위 B 정책이 가려주는 글이면 여기서 자동으로 false 가 된다.
-- author_id 분기는 '내 댓글' 목록(getAllMyComments)과 성장·배지 집계를 위해 남긴다.
drop policy if exists post_comments_select on public.post_comments;

create policy post_comments_select on public.post_comments
  for select
  using (
    (author_id = auth.uid())
    or (exists (
      select 1 from public.community_posts p
       where p.id = post_id
    ))
  );


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- select '1. 정책' as 구분,
--        (tablename || ' / ' || policyname || ' [' || cmd || '] using=' ||
--         coalesce(qual, '-'))::text as 값
-- from pg_policies
-- where schemaname='public' and tablename in ('community_posts','post_comments')
--   and cmd = 'SELECT'
-- order by 1, 2;
--
-- 기대: 두 정책의 using 식이 위에서 만든 대로 바뀌어 있다


-- ============================================================
-- [권한 우회 테스트]
-- ============================================================
-- -- 숨긴 글이 비로그인에게 안 보여야 한다
-- begin;
-- set local role anon;
-- select count(*) from public.community_posts where status = 'hidden';
-- rollback;
--   → 0
--
-- -- 숨긴 글의 댓글도 안 보여야 한다
-- begin;
-- set local role anon;
-- select count(*) from public.post_comments c
--  where exists (select 1 from public.community_posts p
--                 where p.id = c.post_id and p.status = 'hidden');
-- rollback;
--   → 0  (안쪽 조회부터 막히므로 0 이다)
--
-- -- 공개 글은 그대로 보여야 한다
-- begin;
-- set local role anon;
-- select count(*) from public.community_posts;
-- rollback;
--   → 15 (active 인 것만)
--
-- -- 작성자·관리자는 앱에서 확인한다(SQL 에디터로는 JWT 를 흉내낼 수 없다)


-- ============================================================
-- [회귀 테스트] — 앱에서 확인
--   1. 비로그인으로 커뮤니티 목록·글 상세·댓글 보기
--   2. 로그인 후 글 쓰기, 댓글 쓰기·삭제, 좋아요
--   3. 커뮤니티 검색 (제목·내용·댓글)
--   4. 내 글 목록(/community/my) — 내 숨긴 글이 '숨김'으로 계속 보이는지
--   5. 작성자 계정으로 자기 숨긴 글의 상세 페이지가 열리는지 (이의제기 흐름)
--   6. 다른 계정으로 그 숨긴 글 주소를 열면 "글을 찾을 수 없어요"가 뜨는지  ← 이번 수정의 핵심
--   7. 관리자 > 게시글 신고 > 숨김 글 탭이 그대로 뜨는지
--   8. 프로필의 내 댓글 목록, 활동/배지 숫자


-- ============================================================
-- [롤백]
-- ============================================================
-- drop policy if exists cposts_select on public.community_posts;
-- create policy cposts_select on public.community_posts
--   for select
--   using (
--     (coalesce(visibility, 'public') = 'public')
--     or (author_id = auth.uid())
--     or (exists (select 1 from public.profiles p
--                  where p.id = auth.uid() and p.role = 'admin'))
--   );
--
-- drop policy if exists post_comments_select on public.post_comments;
-- create policy post_comments_select on public.post_comments
--   for select using (true);
--
-- select pg_notify('pgrst', 'reload schema');
-- ============================================================
