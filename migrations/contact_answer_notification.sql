-- ============================================================
-- 문의에 답변이 달리면 문의자에게 알림
--
-- 문제: 관리자가 답변을 써도 문의자는 알 방법이 없었다.
--   answer 컬럼은 '내 문의 내역'(MyContacts)에 그대로 표시되지만,
--   사용자가 직접 /support/contact 에 다시 들어와 행을 눌러야 보인다.
--   알림 트리거가 12개나 있는데 문의 답변만 빠져 있었다.
--
-- ✅ 사전 확인 (2026-09-03)
--
--  1) 문의는 이제 로그인 사용자만 접수한다
--     (contact_messages_login_required.sql). user_id 가 항상 차 있으므로
--     알림 대상이 언제나 존재한다. 그래도 방어적으로 null 을 걸러낸다.
--
--  2) 알림이 언제 가야 하는가
--     관리자 화면은 상태·답변·메모를 한 번에 저장한다. 그래서
--     "처리중 + 초안 답변" 같은 중간 저장에 알림이 날아가면 안 된다.
--     조건: status = 'done' 이고 answer 가 비어 있지 않을 때, 그리고
--           직전에 이미 그 상태가 아니었을 때만. 답변을 나중에 고쳐도 다시 안 간다.
--
--  3) link 는 /support/contact?inquiry=<id> 다.
--     MyContacts 에 그 문의를 자동으로 펼치고 스크롤하는 코드를 넣었다.
--     (없으면 목록에서 직접 찾아야 한다)
--     문의 폼과 '내 문의 내역'이 같은 페이지에 있어 별도 화면이 없다.
--
--  4) security definer 로 만든다. notifications 의 INSERT 권한은
--     notifications_write_privileges.sql 에서 anon·authenticated 모두 회수했다.
--     소유자(postgres) 권한으로 돌아야 알림을 넣을 수 있다.
--     search_path 고정은 definer 함수의 필수 조건이다.
--
-- ⚠️ 코드를 먼저 배포하고 이 SQL 을 적용한다.
--    링크의 ?inquiry= 를 처리하는 코드가 없으면 알림을 눌러도 그냥 페이지 맨 위로 간다.
--    (깨지지는 않는다. 순서가 반대여도 안전하다)
-- ============================================================

create or replace function public.notify_contact_answered()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $fn$
begin
  -- 비로그인 문의(과거 데이터)는 보낼 곳이 없다
  if new.user_id is null then return new; end if;

  -- 답변 완료 + 실제 답변이 있을 때만
  if new.status <> 'done' then return new; end if;
  if coalesce(btrim(new.answer), '') = '' then return new; end if;

  -- 직전에 이미 '답변 완료 + 답변 있음' 이었다면 다시 알리지 않는다(답변 수정)
  if old.status = 'done' and coalesce(btrim(old.answer), '') <> '' then return new; end if;

  insert into notifications (user_id, type, title, body, link, related_type, related_id)
  values (
    new.user_id,
    'contact_answered',
    '문의에 답변이 달렸어요',
    coalesce(nullif(btrim(new.title), ''), '문의') || ' 에 답변이 등록됐어요',
    '/support/contact?inquiry=' || new.id,
    'contact', new.id
  );
  return new;
end;
$fn$;

revoke all on function public.notify_contact_answered() from public, anon, authenticated;

drop trigger if exists trg_notify_contact_answered on public.contact_messages;
create trigger trg_notify_contact_answered
  after update on public.contact_messages
  for each row execute function public.notify_contact_answered();


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- select '1. 함수' as 구분,
--        (proname || ' definer=' || prosecdef::text ||
--         ' ' || coalesce(array_to_string(proconfig, ','), 'search_path 없음'))::text as 값
-- from pg_proc
-- where pronamespace='public'::regnamespace and proname='notify_contact_answered'
-- union all
-- select '2. 트리거', tgname::text
-- from pg_trigger
-- where tgrelid='public.contact_messages'::regclass and not tgisinternal
-- order by 1, 2;
--
-- 기대:
--   1. definer=true, search_path=public, extensions, pg_temp
--   2. trg_notify_contact_answered


-- ============================================================
-- [회귀 테스트]
--   1. 관리자 문의 관리 → 대기 중인 문의 하나에
--      답변을 쓰고 상태를 '완료' 로 바꿔 저장
--      → **저장이 되는지** (트리거가 터지면 저장 자체가 롤백된다)
--   2. 문의한 계정에 '문의에 답변이 달렸어요' 알림이 오는지
--   3. 그 알림을 누르면 /support/contact 로 가서 해당 문의가 펼쳐지는지
--   4. 같은 문의의 답변을 고쳐서 다시 저장 → 알림이 **또 가지 않는지**
--   5. 상태만 '처리중' 으로 바꿔 저장 → 알림이 가지 않는지
--   6. 내부 메모만 저장 → 알림이 가지 않는지


-- ============================================================
-- [롤백]
-- ============================================================
-- drop trigger if exists trg_notify_contact_answered on public.contact_messages;
-- drop function if exists public.notify_contact_answered();
-- select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [후속 과제]
-- - NOTI_ICON 맵이 TopBar.tsx 와 NotificationsPage.tsx 에 각각 복사돼 있다.
--   알림 종류를 추가할 때마다 두 곳을 고쳐야 한다. 한 곳으로 모을 것.
-- - 답변 알림은 앱 안에서만 간다. 메일은 여전히 발송되지 않는다.
--   사용자가 앱에 안 들어오면 답변을 못 본다.
-- ============================================================
