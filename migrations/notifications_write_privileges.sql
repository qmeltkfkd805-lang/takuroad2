-- ============================================================
-- notifications 쓰기 권한 잠그기
--
-- 🔴 이번 시리즈에서 가장 심각한 건이다. 앞의 셋(community_posts, post_comments,
--    review_comments)은 "자기 콘텐츠 조작" 수준이었지만 이건 다른 사용자에게
--    직접 도달하는 경로다.
--
-- 문제:
--   notifications_insert_system [INSERT] with_check = true
--   authenticated : INSERT  (10개 컬럼 전부)
--   anon          : INSERT  (10개 컬럼 전부)
--
--   with_check 가 true 라 삽입되는 행에 아무 제약이 없다. 누구든
--     user_id = <아무 사용자>, title/body = <아무 문구>, link = <아무 주소>
--   로 알림을 만들어 넣을 수 있다. 받는 쪽에서는 서비스가 보낸 정상 알림과
--   구분되지 않는다. 피싱·스팸 경로.
--
--   UPDATE 도 10개 컬럼이 전부 열려 있다. notifications_update_own 이 행을
--   본인 것으로 제한하고 with_check 도 user_id 를 고정해서 남의 알림을 고치거나
--   자기 알림을 남에게 넘기지는 못한다. 다만 클라이언트가 실제로 쓰는 건
--   is_read 하나뿐이므로 나머지는 회수한다.
--
--   DELETE 권한이 anon·authenticated 둘 다 있는데 DELETE 정책이 없다.
--   RLS 가 전부 거부하므로 죽은 권한이다.
--
-- ✅ 사전 확인 (2026-09-03)
--
--  1) 클라이언트는 notifications 에 INSERT 하지 않는다.
--     services/notificationService.ts 전체가
--       getNotifications  SELECT (자기 것)
--       getUnreadCount    SELECT (자기 것)
--       markAsRead        UPDATE (is_read)
--       markAllAsRead     UPDATE (is_read)
--     뿐이다. INSERT/DELETE 하는 코드가 한 줄도 없다.
--     → INSERT 권한이 열려 있는 유일한 이유는 아래 4번의 트리거 함수들이다.
--
--  2) notifications 에 쓰는 함수 12개 중 8개는 이미 security definer 다.
--       grant_exp, notify_favorite_tag_on_event, notify_feature_suggestion,
--       notify_followers_on_post, notify_followers_on_route, notify_route_saved,
--       post_report_autohide, run_fanart_selection
--     → 소유자 권한으로 돌기 때문에 이번 회수의 영향을 받지 않는다.
--
--  3) 남은 4개가 security invoker(definer=false) 다. 호출한 사용자 권한으로
--     실행되므로, 이들이 동작한다는 사실 자체가 authenticated 에게 INSERT 권한이
--     있다는 증거였다.
--       notify_review_comment       후기 댓글 → 후기 작성자에게
--       notify_shop_owner_comment   후기 댓글 → 샵 사장님에게
--       notify_shop_owner_review    후기 작성  → 샵 사장님에게
--       notify_verify_status_change 인증 심사  → 신청자에게
--     → 이 넷을 definer 로 바꾼 뒤에야 INSERT 를 회수할 수 있다.
--       하나라도 빠뜨리면 그 알림이 조용히 안 가기 시작한다.
--
--  4) 순서가 중요하다. 함수를 먼저 definer 로 바꾸고, 그다음 권한을 회수한다.
--     반대로 하면 그사이에 발생한 후기·댓글·인증 심사에서 트리거가 실패해
--     원래 INSERT/UPDATE 까지 롤백된다(트리거 예외는 문장 전체를 되돌린다).
-- ============================================================


-- ── 1) 트리거 함수 4개를 security definer 로 ────────────────
-- 본문은 건드리지 않는다. 실행 권한 맥락만 바꾼다.
-- search_path 를 고정하는 것은 definer 함수의 필수 조건이다 —
-- 고정하지 않으면 호출자가 search_path 를 바꿔 함수 안의 이름 해석을
-- 가로챌 수 있다.
--
-- auth.uid() 는 definer 로 바뀌어도 그대로 동작한다. 실행 롤이 아니라
-- 요청의 JWT 설정값을 읽기 때문이다.
alter function public.notify_review_comment()       security definer;
alter function public.notify_review_comment()       set search_path to 'public', 'extensions', 'pg_temp';

alter function public.notify_shop_owner_comment()   security definer;
alter function public.notify_shop_owner_comment()   set search_path to 'public', 'extensions', 'pg_temp';

alter function public.notify_shop_owner_review()    security definer;
alter function public.notify_shop_owner_review()    set search_path to 'public', 'extensions', 'pg_temp';

alter function public.notify_verify_status_change() security definer;
alter function public.notify_verify_status_change() set search_path to 'public', 'extensions', 'pg_temp';


-- ── 2) RLS 를 우회하거나 죽은 권한 회수 ─────────────────────
revoke truncate, references, trigger on table public.notifications from anon, authenticated;

-- DELETE 정책이 없어 어차피 전부 거부된다. 지우는 코드도 없다.
revoke delete on table public.notifications from anon, authenticated;

-- anon 은 남의 알림을 읽을 수도 없다(notifications_select_own).
-- SELECT 도 사실상 무의미하지만 로그아웃 상태에서 헤더가 조회를 시도할 수 있어
-- 남겨둔다 — 정책이 0건을 돌려준다.
revoke insert, update on table public.notifications from anon;


-- ── 3) INSERT 권한 완전 회수 ────────────────────────────────
-- 이것이 이번 migration 의 핵심이다.
-- 이제 알림을 만들 수 있는 것은 definer 트리거 함수(소유자 권한)와
-- service_role 뿐이다.
revoke insert on table public.notifications from authenticated;
revoke insert (
  id, user_id, type, title, body, link, related_type, related_id, is_read, created_at
) on table public.notifications from authenticated;

revoke insert (
  id, user_id, type, title, body, link, related_type, related_id, is_read, created_at
) on table public.notifications from anon;


-- ── 4) UPDATE 는 is_read 하나만 ─────────────────────────────
revoke update on table public.notifications from authenticated;
revoke update (
  id, user_id, type, title, body, link, related_type, related_id, is_read, created_at
) on table public.notifications from authenticated;

-- markAsRead / markAllAsRead 가 보내는 것은 is_read 뿐이다.
-- 행 제한은 notifications_update_own(user_id = auth.uid())이 계속 담당한다.
grant update (is_read) on table public.notifications to authenticated;


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]  ※ 에디터가 마지막 문장 결과만 보여주므로 한 문장으로 묶었다
-- ============================================================
-- select '1. 테이블 권한' as 구분, (grantee || ' : ' || privilege_type)::text as 값
-- from information_schema.role_table_grants
-- where table_schema='public' and table_name='notifications'
--   and grantee in ('anon','authenticated')
-- union all
-- select '2. INSERT 허용 컬럼', column_name::text
-- from information_schema.column_privileges
-- where table_schema='public' and table_name='notifications'
--   and grantee in ('anon','authenticated') and privilege_type='INSERT'
-- union all
-- select '3. UPDATE 허용 컬럼', column_name::text
-- from information_schema.column_privileges
-- where table_schema='public' and table_name='notifications'
--   and grantee='authenticated' and privilege_type='UPDATE'
-- union all
-- select '4. 함수 definer', (proname || ' definer=' || prosecdef::text)::text
-- from pg_proc
-- where pronamespace='public'::regnamespace and prosrc ilike '%notifications%'
-- order by 1, 2;
--
-- 기대:
--   1. anon : SELECT / authenticated : SELECT, UPDATE   (3줄)
--   2. 한 줄도 없음        ← 핵심
--   3. is_read             (1줄)
--   4. 12개 전부 definer=true


-- ============================================================
-- [권한 우회 테스트]  각 블록을 한 덩어리로 선택해서 실행
-- ============================================================
-- -- (가) 알림 위조 시도 — 막혀야 한다
-- begin;
-- set local role authenticated;
-- insert into public.notifications (user_id, type, title, body, link)
-- values ('00000000-0000-0000-0000-000000000001', 'system',
--         '계정 확인이 필요합니다', '아래를 눌러 확인하세요', 'https://example.com');
-- rollback;
--   → 42501 permission denied  (성공)
--   ※ Supabase 가 붙이는 HINT(GRANT INSERT ... TO authenticated)는 따르지 말 것.
--
-- -- (나) anon 으로도 같은 시도
-- begin;
-- set local role anon;
-- insert into public.notifications (user_id, type, title)
-- values ('00000000-0000-0000-0000-000000000001', 'system', 'x');
-- rollback;
--   → 42501 permission denied
--
-- -- (다) 읽음 처리는 통과해야 한다 — 권한 오류 없이 0 rows
-- begin;
-- set local role authenticated;
-- update public.notifications set is_read = true
--  where id = '00000000-0000-0000-0000-000000000000';
-- rollback;
--   → 에러 없이 "0 rows"
--
-- -- (라) 제목 조작은 막혀야 한다
-- begin;
-- set local role authenticated;
-- update public.notifications set title = 'x'
--  where id = '00000000-0000-0000-0000-000000000000';
-- rollback;
--   → 42501 permission denied


-- ============================================================
-- [회귀 테스트] — 알림이 실제로 도착하는지가 전부다.
--   definer 로 바꾼 4개를 하나씩 확인한다. 하나라도 빠지면 그 알림만
--   조용히 안 간다(트리거가 예외를 던지면 원래 작업까지 롤백되므로,
--   "후기 작성이 실패한다" 같은 형태로도 나타날 수 있다).
--
--   1. 후기 작성  → 샵 사장님 계정에 알림  (notify_shop_owner_review)
--   2. 후기 댓글  → 후기 작성자에게 알림    (notify_review_comment)
--   3. 후기 댓글  → 샵 사장님에게 알림      (notify_shop_owner_comment)
--   4. 사장님 인증 승인/거절 → 신청자에게 알림 (notify_verify_status_change)
--
--   이미 definer 였던 것들도 한 번씩:
--   5. 팔로우한 사람이 글 작성 → 알림 (notify_followers_on_post)
--   6. 게시글 신고 10건 누적 → 작성자에게 자동 숨김 알림 (post_report_autohide)
--
--   그리고 사용자 화면:
--   7. 헤더 알림 뱃지 개수 → 정상 (SELECT)
--   8. 알림 하나 클릭해서 읽음 처리 → 정상 (is_read UPDATE)
--   9. '모두 읽음' → 정상


-- ============================================================
-- [롤백]
-- ============================================================
-- -- 함수는 되돌리지 않아도 된다(definer 가 더 안전하다). 굳이 되돌리려면:
-- -- alter function public.notify_review_comment()       security invoker;
-- -- alter function public.notify_shop_owner_comment()   security invoker;
-- -- alter function public.notify_shop_owner_review()    security invoker;
-- -- alter function public.notify_verify_status_change() security invoker;
-- -- ⚠️ 아래 권한 롤백은 알림 위조가 가능한 상태로 되돌리는 것이다
-- -- grant insert, update, delete on table public.notifications to authenticated;
-- -- grant insert, update, delete on table public.notifications to anon;
-- select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [후속 과제 — 이번에 일부러 미룬 것]
--
-- notifications_insert_system 정책의 with_check 가 여전히 true 다.
-- 권한 검사가 RLS 보다 먼저이므로 INSERT GRANT 를 걷어낸 지금은 뚫리지 않는다.
-- 그래도 정책 자체가 틀린 것을 남겨두면, 나중에 누가 INSERT 를 다시 부여하는
-- 순간 구멍이 그대로 되살아난다. review_comments 때와 같은 이유로 고치는 게 맞다.
--
-- 다만 그러려면 먼저 확인할 것이 있다:
--
--   select relname, relrowsecurity, relforcerowsecurity
--   from pg_class where relnamespace='public'::regnamespace and relname='notifications';
--
-- relforcerowsecurity = false 라면 소유자(postgres)는 RLS 를 우회하므로,
-- 정책을 with_check(false)로 바꿔도 definer 트리거들의 INSERT 는 그대로 통과한다.
-- 이 경우 안전하게 좁힐 수 있다.
--
-- relforcerowsecurity = true 라면 소유자에게도 정책이 적용된다.
-- 정책을 false 로 바꾸는 순간 **모든 알림 생성이 멈춘다.** 절대 그렇게 하면 안 되고,
-- 그때는 GRANT 회수만으로 방어하고 정책은 그대로 두어야 한다.
--
-- 확인 결과를 보고 별도 migration 으로 처리한다.
-- ============================================================
