-- ============================================================
-- contact_messages — 가짜 문의·가짜 답변 삽입 차단 + 쓰기 권한 좁히기
--
-- 문제 1 — 삽입에 제약이 없다.
--   contact_insert_any [INSERT] with_check = true
--   anon·authenticated 가 17개 컬럼 전부에 INSERT 권한을 갖고 있다.
--   즉 누구든
--     user_id = <남의 계정>, answer = <운영진이 답한 것 같은 문구>, status = 'done'
--   으로 행을 넣을 수 있다. 그 사람의 '내 문의' 목록(getMyContactMessages 는
--   answer 를 그대로 보여준다)에 **운영진이 답변한 것처럼 보이는 가짜 문의**가 생긴다.
--   notifications 때와 같은 부류의 경로다.
--
-- 문제 2 — UPDATE 도 17개 컬럼이 전부 열려 있다.
--   RLS(UPDATE 정책이 contact_admin_all 하나뿐)가 막고 있어 지금 뚫리지는 않지만,
--   관리자가 실제로 쓰는 5개만 남긴다.
--
-- 문제 3 — anon·authenticated 에 DELETE·TRUNCATE·TRIGGER·REFERENCES 가 있다.
--   DELETE 정책이 없어 삭제는 전부 거부된다. 죽은 권한이다.
--
-- ✅ 사전 확인 (2026-09-03)
--
--  1) 클라이언트가 쓰는 것 (services/contactService.ts)
--       createContactMessage  INSERT (type, title, content, extra, email,
--                                     user_id, page_url, page_label, attachment_urls)
--       updateContactMessage  UPDATE (status, answer, answered_at, answered_by, admin_note)
--                             ← 관리자 화면. RLS 가 관리자만 통과시킨다
--       getMyContactMessages  SELECT (본인 것)
--       getAllContactMessages SELECT (관리자, select('*'))
--
--  2) status 는 INSERT 목록에 없다. 접수는 항상 컬럼 기본값(pending)으로 시작한다.
--     answer·admin_note·answered_* 도 INSERT 에서 빼면, 정책과 무관하게
--     "가짜 답변이 달린 문의"를 만들 수 없다. 방어선이 둘이 된다.
--
--  3) anon 도 문의를 넣을 수 있어야 한다(비로그인 문의 폼). 그래서 INSERT 권한은
--     anon 에도 준다. 대신 정책이 user_id 를 강제한다 —
--     비로그인은 null 만, 로그인은 자기 id 만.
--
--  4) 이 테이블에 걸린 트리거가 없고, 이 테이블에 쓰는 security invoker 함수도 없다
--     (권한 회수 전 스윕으로 확인). 오늘 shops 에서 났던 종류의 장애는 없다.
--
--  ⚠️ 5) SELECT 는 이번에 손대지 않는다.
--     contact_select_own 이 본인 문의를 **전 컬럼** 볼 수 있게 하고 있어서,
--     문의한 사람이 자기 문의의 admin_note(내부 메모)를 읽을 수 있다.
--     막으려면 admin_note 의 SELECT 권한을 회수해야 하는데, 관리자 화면도
--     authenticated 로 select('*') 를 하고 있어 같이 막힌다.
--     관리자 조회를 security definer RPC 로 옮기는 것과 묶어서,
--     문의 관리 화면 재작업 때 함께 처리한다.
-- ============================================================


-- ── 1) 삽입 정책에 제약 걸기 ────────────────────────────────
-- 비로그인 문의는 user_id 가 null 이어야 하고, 로그인 문의는 자기 id 여야 한다.
-- 남의 이름으로 문의를 넣을 수 없다.
drop policy if exists contact_insert_any on public.contact_messages;

create policy contact_insert_any on public.contact_messages
  for insert
  with check (user_id is null or user_id = auth.uid());


-- ── 2) RLS 를 우회하거나 죽은 권한 회수 ─────────────────────
revoke truncate, references, trigger on table public.contact_messages from anon, authenticated;

-- DELETE 정책이 없어 어차피 전부 거부된다. 지우는 코드도 없다.
revoke delete on table public.contact_messages from anon, authenticated;


-- ── 3) 쓰기 권한 회수 (테이블 + 컬럼) ───────────────────────
-- REVOKE ... ON TABLE 은 테이블 단위만 걷어내고 컬럼 단위 GRANT 는 남기므로
-- 17개 컬럼을 명시해 최종 상태를 확정한다.
revoke insert, update on table public.contact_messages from anon, authenticated;

revoke insert (
  id, type, title, content, extra, email, user_id,
  page_url, page_label, attachment_urls, status,
  answer, answered_at, answered_by, admin_note, created_at, updated_at
), update (
  id, type, title, content, extra, email, user_id,
  page_url, page_label, attachment_urls, status,
  answer, answered_at, answered_by, admin_note, created_at, updated_at
) on table public.contact_messages from anon, authenticated;


-- ── 4) 실제로 쓰는 컬럼만 다시 부여 ─────────────────────────
-- INSERT — createContactMessage 가 보내는 9개. 비로그인 문의가 있으므로 anon 에도 준다.
--   status·answer·admin_note·answered_* 가 없으므로 "가짜 답변" 을 만들 수 없다.
--   id·created_at·updated_at 은 기본값이 채운다.
grant insert (
  type, title, content, extra, email, user_id,
  page_url, page_label, attachment_urls
) on table public.contact_messages to anon, authenticated;

-- UPDATE — updateContactMessage(관리자 화면)가 보내는 5개.
--   "관리자만"은 계속 RLS(contact_admin_all)가 담당한다.
--   여기서는 어떤 컬럼을 건드릴 수 있는지만 제한한다.
--   type·title·content·email·user_id 가 빠지므로 접수 내용 자체는 고칠 수 없다.
grant update (
  status, answer, answered_at, answered_by, admin_note
) on table public.contact_messages to authenticated;


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]  ※ 에디터가 마지막 문장 결과만 보여주므로 한 문장으로 묶었다
-- ============================================================
-- select '1. 테이블 권한' as 구분, (grantee || ' : ' || privilege_type)::text as 값
-- from information_schema.role_table_grants
-- where table_schema='public' and table_name='contact_messages'
--   and grantee in ('anon','authenticated')
-- union all
-- select '2. INSERT 허용 컬럼', (grantee || ' : ' || column_name)::text
-- from information_schema.column_privileges
-- where table_schema='public' and table_name='contact_messages'
--   and grantee in ('anon','authenticated') and privilege_type='INSERT'
-- union all
-- select '3. UPDATE 허용 컬럼', (grantee || ' : ' || column_name)::text
-- from information_schema.column_privileges
-- where table_schema='public' and table_name='contact_messages'
--   and grantee in ('anon','authenticated') and privilege_type='UPDATE'
-- union all
-- select '4. 정책', (policyname || ' [' || cmd || '] check=' || coalesce(with_check,'-'))::text
-- from pg_policies where schemaname='public' and tablename='contact_messages'
-- order by 1, 2;
--
-- 기대:
--   1. anon : SELECT / authenticated : SELECT   (2줄)
--   2. anon 9개 + authenticated 9개 = 18줄
--      (attachment_urls, content, email, extra, page_label, page_url, title, type, user_id)
--   3. authenticated 5개만 (admin_note, answer, answered_at, answered_by, status)
--   4. contact_insert_any 의 check 가 (user_id IS NULL OR user_id = auth.uid()) 로 바뀜


-- ============================================================
-- [권한 우회 테스트]  각 블록을 한 덩어리로 선택해서 실행
-- ============================================================
-- -- (가) 가짜 답변이 달린 문의 삽입 — 막혀야 한다
-- begin;
-- set local role authenticated;
-- insert into public.contact_messages (type, title, content, email, answer, status)
-- values ('general', 'x', 'x', 'a@b.c', '운영진 답변입니다', 'done');
-- rollback;
--   → 42501 permission denied  (answer·status 컬럼 권한이 없다)
--   ※ Supabase 가 붙이는 HINT 는 따르지 말 것.
--
-- -- (나) 정상 접수는 통과해야 한다
-- begin;
-- set local role anon;
-- insert into public.contact_messages (type, title, content, email)
-- values ('general', '권한 테스트', '테스트', 'test@example.com');
-- rollback;
--   → 정상 삽입 (rollback 되므로 데이터는 남지 않는다)
--
-- -- (다) 접수 내용 위조 — 막혀야 한다
-- begin;
-- set local role authenticated;
-- update public.contact_messages set content = 'x'
--  where id = '00000000-0000-0000-0000-000000000000';
-- rollback;
--   → 42501 permission denied
--
-- -- (라) 관리자 처리 컬럼은 통과해야 한다 — 권한 오류 없이 0 rows
-- begin;
-- set local role authenticated;
-- update public.contact_messages set status = 'done'
--  where id = '00000000-0000-0000-0000-000000000000';
-- rollback;
--   → 에러 없이 "0 rows" (권한은 통과하고 RLS 의 관리자 조건에서 걸러진 것)


-- ============================================================
-- [회귀 테스트]
--   비로그인으로:
--    1. /contact 문의 폼 제출 → 접수되는지  ← anon INSERT 가 살아있는지
--   로그인으로:
--    2. 문의 폼 제출 → 접수되고 '내 문의'에 뜨는지
--    3. 제휴 문의(/support/partnership) 제출 → 접수되는지
--    4. 첨부파일 있는 문의 제출 → attachment_urls 가 저장되는지
--   관리자로:
--    5. 문의 관리 탭 → 목록·상세가 보이는지
--    6. 상태 변경 · 답변 저장 · 내부 메모 저장
--    7. 사이드바 문의 배지 숫자


-- ============================================================
-- [롤백]
-- ============================================================
-- drop policy if exists contact_insert_any on public.contact_messages;
-- create policy contact_insert_any on public.contact_messages
--   for insert with check (true);      -- ⚠️ 남의 이름으로 문의를 넣을 수 있는 상태
-- -- grant insert, update, delete on table public.contact_messages to anon, authenticated;
-- select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [후속 과제]
-- 🔴 admin_note 가 문의자에게 읽힌다. contact_select_own 이 본인 문의를 전 컬럼
--    허용하기 때문이다. 관리자 조회(getAllContactMessages)가 select('*') 로
--    authenticated 권한을 쓰고 있어서, admin_note 의 SELECT 를 회수하면 관리자
--    화면도 같이 막힌다. 관리자 조회를 security definer RPC 로 옮기고 나서
--    회수해야 한다 — 문의 관리 화면 재작업과 함께 처리한다.
-- - answered_by 를 클라이언트가 넘긴다(updateContactMessage). RLS 가 관리자만
--   통과시키므로 외부인은 못 쓰지만, 관리자가 다른 관리자 id 를 적을 수는 있다.
--   BEFORE UPDATE 트리거로 auth.uid() 를 강제하면 깔끔하다.
-- - 첨부파일이 공개 버킷(contact-files)에 올라가고 getPublicUrl 을 쓴다.
--   URL 만 알면 누구나 열 수 있다. 오류 신고 스크린샷에 개인정보가 담길 수 있다.
--   서명 URL(signed URL)로 바꾸는 것을 검토할 것.
-- ============================================================
