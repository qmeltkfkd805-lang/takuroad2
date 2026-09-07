-- ============================================================
-- contact_messages — 문의는 로그인한 사용자만
--
-- 왜 이렇게 바꾸나:
--   비로그인 문의는 **답변을 전달할 경로가 없다.**
--     · 코드베이스에 메일 발송이 없다(Resend·SendGrid·SMTP·Edge Function 어느 것도 없고
--       푸터의 mailto 링크 하나뿐이다).
--     · '내 문의'(getMyContactMessages)는 user_id 로 조회하므로 비로그인은 열 수 없다.
--   그런데 접수 성공 화면은 "평균 1~3일 안에 답변 드릴게요" 라고 약속한다.
--   지킬 수 없는 약속을 하느니 접수를 받지 않는 편이 정직하다.
--
--   (참고로 비로그인 접수는 지금까지 한 번도 성공한 적이 없다.
--    contact_messages_returning_fix.sql 참고 — INSERT ... RETURNING 이
--    SELECT 정책에 막혀 42501 로 실패해 왔다. 12건 전부 로그인 사용자 문의다.)
--
-- 바뀌는 것:
--   1) contact_insert_any 정책에서 'user_id is null' 허용을 뺀다.
--   2) anon 의 INSERT 권한을 회수한다. 정책과 권한 두 겹으로 막는다.
--
-- ⚠️ 순서: **코드를 먼저 배포하고** 이 SQL 을 적용한다.
--   SQL 을 먼저 적용해도 실제로 깨지는 것은 없다(비로그인 접수는 원래 실패했다).
--   다만 코드가 먼저 나가면 비로그인 사용자는 폼 대신 로그인 안내를 보게 되어,
--   에러 대신 안내를 만난다. 순서를 지키는 편이 사용자 경험이 낫다.
--
-- ✅ 사전 확인 (2026-09-03)
--   ContactForm / PartnerForm 에 로그인 게이트를 넣었다(!user 면 폼 대신 안내).
--   createContactMessage 도 user 가 없으면 즉시 실패하고, user_id 를 반드시 채운다.
--   로그인 사용자의 접수 경로는 그대로다 — user_id = auth.uid() 를 만족한다.
-- ============================================================


-- ── 1) 정책에서 비로그인 허용 제거 ──────────────────────────
drop policy if exists contact_insert_any on public.contact_messages;

create policy contact_insert_own on public.contact_messages
  for insert
  with check (user_id = auth.uid());


-- ── 2) anon 의 INSERT 권한 회수 ─────────────────────────────
-- 정책만으로도 막히지만 방어선을 하나 더 겹친다.
-- anon 의 SELECT 는 남긴다 — contact_select_own 이 어차피 0건을 돌려준다.
revoke insert on table public.contact_messages from anon;
revoke insert (
  id, type, title, content, extra, email, user_id,
  page_url, page_label, attachment_urls
) on table public.contact_messages from anon;


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- select '1. INSERT 허용 컬럼' as 구분, (grantee || ' : ' || column_name)::text as 값
-- from information_schema.column_privileges
-- where table_schema='public' and table_name='contact_messages'
--   and privilege_type='INSERT' and grantee in ('anon','authenticated')
-- union all
-- select '2. 정책', (policyname || ' [' || cmd || '] check=' || coalesce(with_check,'-'))::text
-- from pg_policies where schemaname='public' and tablename='contact_messages'
-- order by 1, 2;
--
-- 기대:
--   1. authenticated 10줄만 (anon 은 한 줄도 없어야 한다)
--   2. contact_admin_all [ALL] / contact_select_own [SELECT] /
--      contact_insert_own [INSERT] check=(user_id = auth.uid())
--      ← contact_insert_any 는 사라졌을 것


-- ============================================================
-- [권한 우회 테스트]  각 블록을 한 덩어리로 선택해서 실행
-- ============================================================
-- -- (가) 비로그인 접수 — 막혀야 한다
-- begin;
-- set local role anon;
-- insert into public.contact_messages (type, title, content, email)
-- values ('general', 'x', 'x', 'a@b.c');
-- rollback;
--   → 42501 permission denied
--   ※ Supabase 가 붙이는 HINT 는 따르지 말 것.


-- ============================================================
-- [회귀 테스트]  ※ 코드 배포 후
--   1. 비로그인으로 /contact → 폼 대신 '로그인이 필요해요' 안내가 보이는지
--   2. 비로그인으로 /support/partnership → 같은 안내
--   3. 로그인 후 문의 제출 → 접수번호가 나오는지
--   4. '내 문의'에 뜨는지
--   5. 첨부파일 있는 문의 제출
--   6. 관리자 문의 관리 탭에 새 문의가 뜨는지


-- ============================================================
-- [롤백]
-- ============================================================
-- drop policy if exists contact_insert_own on public.contact_messages;
-- create policy contact_insert_any on public.contact_messages
--   for insert with check (user_id is null or user_id = auth.uid());
-- grant insert (
--   id, type, title, content, extra, email, user_id,
--   page_url, page_label, attachment_urls
-- ) on table public.contact_messages to anon;
-- select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [후속 과제]
-- - 나중에 비로그인 문의를 다시 받으려면 답변 경로부터 만들어야 한다.
--   (a) 메일 발송(Resend 등) — 도메인 인증·비용이 붙는다
--   (b) 접수번호 + 이메일로 조회하는 화면 — 확인용 RPC 가 필요하다
--   둘 중 하나가 준비되기 전에는 롤백하지 말 것.
-- - 로그인 문의도 답변이 달렸을 때 알림이 가지 않는다.
--   답변 알림 트리거가 다음 작업이다.
-- ============================================================
