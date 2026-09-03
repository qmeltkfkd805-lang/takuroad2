-- ============================================================
-- review_comments 쓰기 권한 좁히기 + UPDATE 정책 구멍 막기
--
-- 이 테이블은 앞의 둘(community_posts, post_comments)과 달리 정책 자체가 틀렸다.
--
--   review_comments_update_own [UPDATE]
--     using      (user_id = auth.uid())
--     with_check true                     ← 여기
--
--   with_check 가 true 면 수정 후의 행에 아무 제약이 없다. user_id 컬럼 UPDATE
--   권한까지 열려 있으므로, 로그인 사용자가 자기 댓글을 쓴 뒤 user_id 를 남의
--   계정으로 바꿔칠 수 있다. 그 댓글은 그때부터 그 사람 닉네임·아바타를 달고
--   표시된다 — 후기 댓글 위조.
--   community_posts / post_comments 는 with_check 가 user_id = auth.uid() 라
--   이게 막혀 있었다. 이 테이블만 뚫려 있다.
--
--   그 밖에 열려 있던 것:
--     content     댓글 수정 기능이 없는데 내용을 나중에 바꿀 수 있다
--     review_id   자기 댓글을 다른 후기로 이동
--     created_at  댓글 순서 조작 (목록이 created_at 오름차순)
--     id          PK 변경 시도
--
-- ✅ 사전 확인 (2026-09-03)
--
--  1) 클라이언트가 쓰는 것 (services/commentService.ts)
--       createComment  INSERT (review_id, user_id, content)
--       deleteComment  UPDATE (is_deleted) ← soft delete. 이것 하나뿐이다
--       getComments / getMyComments / getAllMyComments  SELECT
--     → INSERT 3개, UPDATE 는 is_deleted 하나만 열면 된다.
--
--  2) DELETE 권한은 anon·authenticated 둘 다 갖고 있지만 DELETE 정책이
--     아예 없다. RLS 가 켜져 있고 허용 정책이 없으면 전부 거부되므로
--     이 GRANT 는 죽은 권한이다. 하드 삭제하는 코드도 없다(soft delete 뿐).
--     → 회수한다.
--
--  3) review_comments_select_public 는 using (is_deleted = false) 다.
--     삭제된 댓글이 REST 로 새지 않는다. 이 테이블은 이 부분이 제대로 돼 있다.
--     → 건드리지 않는다.
--
--  4) review_comments_visible 는 security_invoker=on 이다. RLS 우회 없음.
--
--  ⚠️ 5) 트리거 두 개가 prosecdef = false 다.
--        trg_notify_review_comment    -> notify_review_comment
--        trg_notify_shop_owner_comment -> notify_shop_owner_comment
--        호출한 사용자 권한으로 실행된다. 이 트리거들은 notifications 에
--        INSERT 하는데, 댓글 작성이 지금 정상 동작한다는 것은 곧 authenticated
--        가 남을 수신자로 하는 알림을 넣을 수 있다는 뜻이다.
--        → 이번 migration 은 notifications 권한을 건드리지 않으므로 이 트리거들이
--          깨지지 않는다. 다만 별건 취약점이므로 후속 과제로 남긴다.
--
--  6) 관리자 정책이 없다. 이 테이블엔 admin 정책이 하나도 없어서 관리자가
--     후기 댓글을 RLS 상 손댈 방법이 없다. 취약점이 아니라 기능 공백이라
--     이번 범위 밖으로 둔다.
-- ============================================================


-- ── 1) RLS 를 우회하거나 죽은 권한 회수 ─────────────────────
revoke truncate, references, trigger on table public.review_comments from anon, authenticated;
revoke insert, update, delete on table public.review_comments from anon;

-- DELETE 정책이 없어 어차피 전부 거부된다. 하드 삭제하는 코드도 없다.
revoke delete on table public.review_comments from authenticated;


-- ── 2) 쓰기 권한 회수 (테이블 + 컬럼) ───────────────────────
-- REVOKE ... ON TABLE 은 테이블 단위만 걷어내고 컬럼 단위 GRANT 는 남긴다.
-- 6개 컬럼을 명시해 최종 상태를 확정한다.
revoke insert, update on table public.review_comments from authenticated;

revoke insert (
  id, review_id, user_id, content, created_at, is_deleted
), update (
  id, review_id, user_id, content, created_at, is_deleted
) on table public.review_comments from authenticated;


-- ── 3) 실제로 쓰는 컬럼만 다시 부여 ─────────────────────────
-- INSERT — createComment 가 보내는 것뿐.
--   user_id 는 RLS with_check(user_id = auth.uid())가 남의 이름으로 쓰는 걸 막는다.
--   id·created_at·is_deleted 는 컬럼 기본값이 채운다.
grant insert (review_id, user_id, content)
  on table public.review_comments to authenticated;

-- UPDATE — deleteComment 의 soft delete 하나뿐이다.
--   user_id 가 빠지므로 위에서 말한 위조 경로가 컬럼 권한 단계에서 끊긴다.
grant update (is_deleted)
  on table public.review_comments to authenticated;


-- ── 4) UPDATE 정책의 with_check 바로잡기 ────────────────────
-- 컬럼 권한만으로도 user_id 변경은 막히지만, 정책 자체가 틀린 것을 남겨두면
-- 나중에 누가 컬럼을 다시 열었을 때 구멍이 그대로 되살아난다.
-- 방어선을 정책에도 둔다.
--
-- deleteComment 는 user_id 를 건드리지 않으므로(is_deleted 만 보낸다)
-- 새 with_check 를 그대로 통과한다. 동작 변화 없음.
drop policy if exists review_comments_update_own on public.review_comments;
create policy review_comments_update_own on public.review_comments
  for update
  using       (user_id = auth.uid())
  with check  (user_id = auth.uid());


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]  ※ 에디터가 마지막 문장 결과만 보여주므로 한 문장으로 묶었다
-- ============================================================
-- select '1. 테이블 권한' as 구분, (grantee || ' : ' || privilege_type)::text as 값
-- from information_schema.role_table_grants
-- where table_schema='public' and table_name='review_comments'
--   and grantee in ('anon','authenticated')
-- union all
-- select '2. INSERT 허용 컬럼', column_name::text
-- from information_schema.column_privileges
-- where table_schema='public' and table_name='review_comments'
--   and grantee='authenticated' and privilege_type='INSERT'
-- union all
-- select '3. UPDATE 허용 컬럼', column_name::text
-- from information_schema.column_privileges
-- where table_schema='public' and table_name='review_comments'
--   and grantee='authenticated' and privilege_type='UPDATE'
-- union all
-- select '4. 정책', (policyname || ' [' || cmd || '] using=' || coalesce(qual,'-') || ' check=' || coalesce(with_check,'-'))::text
-- from pg_policies
-- where schemaname='public' and tablename='review_comments'
-- order by 1, 2;
--
-- 기대:
--   1. anon : SELECT / authenticated : SELECT   (2줄. DELETE 도 사라진다)
--   2. content, review_id, user_id              (3줄)
--   3. is_deleted                               (1줄)
--   4. review_comments_update_own 의 check 가 (user_id = auth.uid()) 로 바뀜


-- ============================================================
-- [권한 우회 테스트]  각 블록을 한 덩어리로 선택해서 실행
-- ============================================================
-- -- (가) 위조 시도 — 막혀야 한다
-- begin;
-- set local role authenticated;
-- update public.review_comments set user_id = '00000000-0000-0000-0000-000000000001'
--  where id = '00000000-0000-0000-0000-000000000000';
-- rollback;
--   → 42501 permission denied  (성공)
--   ※ Supabase 가 붙이는 HINT(GRANT UPDATE ... TO authenticated)는 따르지 말 것.
--
-- -- (나) content / review_id / created_at 도 같은 결과여야 한다
--
-- -- (다) soft delete 는 통과해야 한다 — 권한 오류 없이 0 rows
-- begin;
-- set local role authenticated;
-- update public.review_comments set is_deleted = true
--  where id = '00000000-0000-0000-0000-000000000000';
-- rollback;
--   → 에러 없이 "0 rows"  (권한 통과 후 RLS 가 행을 거른 것)


-- ============================================================
-- [회귀 테스트] — 사용자 사이트
--   1. 후기에 댓글 작성 → 정상
--   2. 후기 댓글 삭제 → 목록에서 사라짐 (is_deleted=true)
--   3. 댓글 작성 시 후기 작성자·샵 사장님에게 알림 → 정상
--      (notify_* 트리거는 notifications 에 쓰므로 이 변경과 무관)
--   4. 마이페이지 '내 댓글' 에 후기 댓글 표시 → 정상
--   5. 삭제한 댓글이 '내 댓글' 에서 빠지는지 → 정상


-- ============================================================
-- [롤백]
-- ============================================================
-- drop policy if exists review_comments_update_own on public.review_comments;
-- create policy review_comments_update_own on public.review_comments
--   for update using (user_id = auth.uid()) with check (true);   -- ⚠️ 취약한 원래 상태
-- -- grant insert, update, delete on table public.review_comments to authenticated;
-- -- grant insert, update, delete on table public.review_comments to anon;
-- -- grant truncate, references, trigger on table public.review_comments to anon, authenticated;
-- select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [후속 과제]
-- 🔴 notifications — notify_review_comment / notify_shop_owner_comment 가
--    prosecdef = false 다. 호출자 권한으로 notifications 에 INSERT 하므로,
--    댓글 작성이 동작한다는 것은 authenticated 가 "남을 수신자로 하는" 알림 행을
--    넣을 수 있다는 뜻이다. 그렇다면 아무나 임의의 사용자에게 임의의 문구·링크로
--    알림을 보낼 수 있다(피싱·스팸 경로).
--    해법은 둘 중 하나다.
--      (a) 두 함수를 security definer 로 바꾸고 authenticated 의 notifications
--          INSERT 권한을 회수한다  ← 권장
--      (b) notifications INSERT 정책을 user_id = auth.uid() 로 좁힌다
--          (그러면 이 트리거들이 깨지므로 (a)가 사실상 유일한 답이다)
--    적용 전에 notifications 의 권한·정책·다른 트리거를 먼저 조사해야 한다.
-- - review_comments 에 admin 정책이 없다. 관리자가 후기 댓글을 숨기거나 지울
--   방법이 RLS 상 없다. 신고 기능을 만들 때 함께 정해야 한다.
-- - review_comments 에는 status 컬럼이 없고 is_deleted 하나로 관리한다.
--   댓글 신고·숨김을 만들면 post_reports 처럼 축을 나눠야 한다.
-- ============================================================
