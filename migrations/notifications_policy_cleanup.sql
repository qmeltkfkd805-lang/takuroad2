-- ============================================================
-- notifications 죽은 정책 정리
--
-- 왜:
--   notifications_insert_system [INSERT] check = true
--   누구든 아무 알림이나 넣을 수 있어 보이는 정책이다. 실제로는 도달할 수 없다 —
--   notifications_write_privileges.sql 에서 INSERT 권한 자체를 anon·authenticated
--   양쪽에서 회수했기 때문이다. 알림은 전부 security definer 트리거가 넣는다
--   (notify_* 함수들, 소유자 권한으로 돈다).
--
--   그래도 남겨두지 않는다. 나중에 누가 "알림 INSERT 가 막히네" 하고 권한만 다시
--   부여하는 순간, 이 정책이 곧바로 아무나 아무 알림이나 넣을 수 있게 열어준다.
--   권한과 정책 중 하나만 막고 있는 상태는 사고가 나기를 기다리는 상태다.
--
-- ✅ 사전 확인 (2026-09-07, 실제 조회 결과)
--   1. 테이블 권한   anon : SELECT / authenticated : SELECT  (INSERT 없음)
--   2. 컬럼 ACL      is_read : authenticated UPDATE 만
--   3. 정책 3개
--        notifications_insert_system [INSERT] check=true            ← 죽은 정책
--        notifications_select_own    [SELECT] user_id = auth.uid()
--        notifications_update_own    [UPDATE] user_id = auth.uid()
--
--   코드에서 알림을 읽는 곳은 notificationService 의
--   getNotifications(userId) / getUnreadCount(userId) 둘뿐이고 전부 userId 를
--   요구한다. TopBar 도 로그인 상태에서만 부른다 => anon 은 읽을 일이 없다.
--
-- 기능 영향: 없다. 회수·삭제하는 것 중 앱이 쓰는 것이 하나도 없다.
-- ============================================================


-- ── 1. 죽은 INSERT 정책 삭제 ────────────────────────────────
-- 알림을 넣는 것은 security definer 트리거뿐이다. 정책이 필요 없다.
-- (definer 함수는 소유자 권한으로 돌고, 소유자 postgres 는 RLS 를 우회한다)
drop policy if exists notifications_insert_system on public.notifications;


-- ── 2. anon 의 SELECT 회수 ──────────────────────────────────
-- 정책이 auth.uid() 를 요구해서 지금도 한 줄도 못 보지만, 쓰지 않는 권한은 남기지 않는다.
revoke select on public.notifications from anon;


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- select '1. 권한' as 구분, (grantee || ' : ' || privilege_type)::text as 값
-- from information_schema.table_privileges
-- where table_schema='public' and table_name='notifications'
--   and grantee in ('anon','authenticated')
-- union all
-- select '2. 정책', (policyname || ' [' || cmd || ']')::text
-- from pg_policies where schemaname='public' and tablename='notifications'
-- order by 1, 2;
--
-- 기대:
--   1. authenticated : SELECT 한 줄만 (anon 은 없어야 한다.
--      is_read UPDATE 는 컬럼 단위라 여기 안 나온다)
--   2. notifications_select_own [SELECT], notifications_update_own [UPDATE] 둘만


-- ============================================================
-- [권한 우회 테스트]
-- ============================================================
-- -- 알림을 직접 넣으려는 시도 — 권한에서 막혀야 한다
-- begin;
-- set local role authenticated;
-- insert into public.notifications (user_id, type, title)
-- values ('00000000-0000-0000-0000-000000000000','x','x');
-- rollback;
--   → 42501 permission denied for table notifications
--
-- -- 비로그인 조회 — 막혀야 한다
-- begin;
-- set local role anon;
-- select count(*) from public.notifications;
-- rollback;
--   → 42501


-- ============================================================
-- [회귀 테스트] — 앱에서 확인
--   1. 상단 종 아이콘의 안 읽은 개수가 뜨는지
--   2. 알림 목록이 열리는지, 눌러서 이동되는지
--   3. 알림 클릭 시 읽음 처리(회색으로 바뀜)가 되는지, '모두 읽음'이 되는지
--   4. 새 알림이 실제로 쌓이는지 — 다른 계정으로 내 글에 댓글을 달아본다
--      (트리거가 definer 라 영향이 없어야 한다)
--   5. 비로그인 상태로 홈·커뮤니티 둘러보기 (콘솔에 42501 이 안 떠야 한다)


-- ============================================================
-- [롤백]
-- ============================================================
-- create policy notifications_insert_system on public.notifications
--   for insert with check (true);
-- grant select on public.notifications to anon;
-- select pg_notify('pgrst', 'reload schema');
-- -- ⚠️ 정책을 되살려도 INSERT 권한이 없어 여전히 못 넣는다.
-- --    알림이 안 쌓이는 문제라면 원인은 트리거 쪽이다(정책이 아니다).
-- ============================================================
