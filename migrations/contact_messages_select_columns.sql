-- ============================================================
-- contact_messages 조회 권한 회수 — 내부 메모(admin_note) 가리기
--
-- 왜:
--   contact_select_own 이 본인 문의를 **전 컬럼** 허용한다. 그래서 문의한 사람이
--   자기 문의에 달린 admin_note(내부 메모 — "재현 불가", "메일 발송 완료" 같은 것)와
--   answered_by(처리한 관리자 id)를 REST 로 직접 읽을 수 있었다.
--   화면에는 안 나오지만 권한이 열려 있으면 읽힌다.
--
--   회수가 지금까지 불가능했던 이유는 관리자 화면이 select('*') 로 테이블을
--   직접 읽었기 때문이다. 회수하면 관리자 화면도 같이 막혔다.
--   조회를 get_admin_contact_messages RPC(security definer)로 옮기고
--   배포까지 끝냈으므로(2026-09-07 확인) 이제 회수할 수 있다.
--
-- ✅ 사전 확인 (2026-09-07, 실제 조회 결과)
--
--  1) SELECT 는 **테이블 단위 grant** 다. anon, authenticated 둘 다.
--     컬럼레벨 ACL 에는 a(INSERT)/w(UPDATE) 만 있고 r(SELECT) 이 하나도 없다.
--     => `revoke select (admin_note) ...` 는 통하지 않는다.
--        ("no privileges could be revoked for column" 경고만 나고 아무 일도 안 일어난다)
--        테이블 SELECT 를 통째로 회수하고 필요한 컬럼만 다시 grant 한다.
--
--  2) 정책 식이 참조하는 컬럼
--       contact_select_own [SELECT] using (auth.uid() = user_id)   ← user_id
--       contact_admin_all  [ALL]    using (profiles 서브쿼리)       ← 이 테이블 컬럼 없음
--       contact_insert_own [INSERT] check (user_id = auth.uid())
--     RLS 정책 식은 **호출자 권한으로 평가**된다. user_id 의 SELECT 를 회수하면
--     contact_messages 조회가 전부 42501 로 죽는다. 반드시 남긴다.
--     (profiles 사고 때 배운 것과 같은 함정이다)
--
--  3) 코드에서 실제로 읽는 컬럼 — 전수 확인함
--     contactService.getMyContactMessages
--       id, type, title, content, status, created_at, answered_at, answer,
--       attachment_urls  (+ .eq('user_id', ...) 로 user_id)
--     adminDashboardService.getAdminBadgeCounts
--       select('id') + .neq('status',...) .neq/.eq('type',...)  → id, status, type
--     그 외에 contact_messages 를 직접 읽는 코드는 없다(RPC 경유).
--     => authenticated 에 남길 컬럼 10개:
--        id, user_id, type, title, content, status, created_at,
--        answered_at, answer, attachment_urls
--     => 빼는 컬럼 7개:
--        admin_note, answered_by, extra, email, page_url, page_label, updated_at
--        (extra·email·page_url·page_label 은 본인이 낸 내용이라 유출은 아니지만
--         화면 어디에서도 안 읽는다. 안 쓰는 건 열어두지 않는다)
--
--  4) anon 은 SELECT 를 통째로 회수한다.
--     문의는 이제 로그인 사용자만 접수한다(contact_messages_login_required.sql).
--     contact_select_own 이 auth.uid() = user_id 라 anon 은 지금도 한 행도 못 본다.
--     권한만 남아 있던 것이라 회수해도 깨지는 것이 없다.
--
--  5) RPC 는 이 회수의 영향을 받지 않는다.
--     get_admin_contact_messages 는 security definer 라 소유자(postgres) 권한으로
--     테이블을 읽는다. 함수가 돌려주는 composite 값에는 컬럼 권한 검사가 없다.
--     회원 관리 화면(get_admin_members)이 이미 같은 구조로 돌고 있다.
--
-- ⚠️ 순서: 화면이 먼저 배포돼 있어야 한다. (2026-09-07 배포·확인 완료)
--    옛날 코드가 떠 있는 상태에서 이걸 적용하면 관리자 문의 화면이 42501 로 죽는다.
-- ============================================================

-- 1) 테이블 단위 SELECT 회수. 컬럼 단위로는 회수가 안 되므로 이 순서여야 한다.
revoke select on table public.contact_messages from anon, authenticated;

-- 2) authenticated 에 필요한 컬럼만 다시 부여
grant select (
  id,
  user_id,          -- contact_select_own 정책 식이 참조한다. 빼면 전부 42501
  type,             -- 관리자 배지 집계 필터
  title,
  content,
  status,           -- 관리자 배지 집계 필터
  created_at,
  answered_at,
  answer,
  attachment_urls
) on public.contact_messages to authenticated;

-- 3) anon 에는 아무것도 주지 않는다 (1번에서 회수된 상태 그대로)


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- select '1. 테이블 SELECT' as 구분, (grantee || ' : ' || privilege_type)::text as 값
-- from information_schema.table_privileges
-- where table_schema='public' and table_name='contact_messages'
--   and grantee in ('anon','authenticated') and privilege_type='SELECT'
-- union all
-- select '2. 컬럼 SELECT', (grantee || ' : ' || column_name)::text
-- from information_schema.column_privileges
-- where table_schema='public' and table_name='contact_messages'
--   and grantee in ('anon','authenticated') and privilege_type='SELECT'
-- order by 1, 2;
--
-- 기대:
--   1. 아무 행도 없어야 한다 (테이블 단위 SELECT 가 사라졌으므로)
--   2. authenticated 에 정확히 10개:
--      answer, answered_at, attachment_urls, content, created_at,
--      id, status, title, type, user_id
--      → admin_note, answered_by, email, extra, page_label, page_url,
--        updated_at 이 없어야 한다. anon 은 한 줄도 없어야 한다.


-- ============================================================
-- [권한 우회 테스트]
-- ============================================================
-- -- 내부 메모를 직접 읽으려는 시도 — 막혀야 한다
-- begin;
-- set local role authenticated;
-- select admin_note from public.contact_messages limit 1;
-- rollback;
--   → 42501 permission denied for table contact_messages
--
-- begin;
-- set local role authenticated;
-- select answered_by from public.contact_messages limit 1;
-- rollback;
--   → 42501
--
-- -- 허용 컬럼은 통과해야 한다 (행은 0건 — auth.uid() 가 null 이라 정책에서 걸린다)
-- begin;
-- set local role authenticated;
-- select id, status from public.contact_messages limit 1;
-- rollback;
--   → 에러 없이 0건
--
-- -- anon 은 어떤 컬럼도 못 읽는다
-- begin;
-- set local role anon;
-- select id from public.contact_messages limit 1;
-- rollback;
--   → 42501


-- ============================================================
-- [회귀 테스트] — 앱에서 확인
--   1. 관리자 > 문의 관리 탭     목록·상세·내부 메모가 그대로 보이는지 (RPC 경유)
--   2. 관리자 > 제휴 문의 탭     그대로인지
--   3. 사이드바 문의/제휴 배지    숫자가 그대로 뜨는지 (여기만 테이블 직접 조회다)
--   4. 사용자 /support/contact   '내 문의 내역'이 뜨고 답변이 보이는지
--   5. 문의 접수                 새 문의가 정상 접수되는지 (INSERT 권한은 안 건드렸다)
--   6. 답변 완료 → 알림 → 클릭   해당 문의가 펼쳐지는지


-- ============================================================
-- [롤백]
-- ============================================================
-- grant select on public.contact_messages to anon, authenticated;
-- select pg_notify('pgrst', 'reload schema');
-- -- ⚠️ 이러면 admin_note 가 다시 열린다. 원인을 찾을 때까지의 임시 조치로만 쓸 것.
-- ============================================================
