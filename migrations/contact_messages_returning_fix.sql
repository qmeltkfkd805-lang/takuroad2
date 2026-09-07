-- ============================================================
-- contact_messages — 비로그인 문의 접수 복구 (id INSERT 권한)
--
-- contact_messages_privileges.sql 의 후속. 권한 정리와는 별개의 오래된 버그다.
--
-- 문제:
--   createContactMessage 가 .insert(...).select('id').single() 로 접수번호를
--   돌려받는다. INSERT ... RETURNING 은 SELECT 정책의 적용을 받는데,
--   contact_select_own 이 (auth.uid() = user_id) 다.
--   비로그인 문의는 auth.uid() 도 user_id 도 null 이고 null = null 은 참이 아니라
--   방금 넣은 자기 행을 못 읽는다 →
--     42501  new row violates row-level security policy for table "contact_messages"
--   INSERT 자체는 통과하는데 RETURNING 단계에서 문장 전체가 실패한다.
--
-- ✅ 사전 확인 (2026-09-03)
--   select (user_id is null) as 비로그인, count(*) from contact_messages group by 1;
--     → false : 12   (true 는 0줄)
--   비로그인 문의가 **한 번도 접수된 적이 없다.** 오늘 처음 테스트해서 드러났다.
--   contact_messages_privileges.sql 은 SELECT 정책도 SELECT 권한도 건드리지 않았으므로
--   이 버그는 그 이전부터 있던 것이다.
--
-- 해법:
--   비로그인 행을 읽을 수 있게 SELECT 정책을 여는 것은 답이 아니다 —
--   "user_id is null 이면 누구나 조회" 가 되어 모든 비로그인 문의가 공개된다.
--   대신 클라이언트가 uuid 를 먼저 만들어 넣는다. id 를 이미 알고 있으니
--   RETURNING 이 필요 없고, 접수번호(성공 화면의 # 앞 8자리)도 그대로 보여준다.
--
-- ⚠️ 순서가 반대다. 이번에는 **SQL 을 먼저** 적용한다.
--   코드가 id 를 실어 보내는데 권한이 없으면 42501 로 모든 문의 접수가 깨진다.
--   반대로 권한을 먼저 주면, id 를 안 보내는 지금 코드는 그대로 잘 돈다
--   (컬럼 기본값이 채운다). 그래서 SQL → 배포 순서여야 안전하다.
--
--   id 를 클라이언트가 정하게 해도 위험하지 않다. PK 라 중복이면 그냥 실패하고,
--   uuid v4 충돌 확률은 무시할 수 있다. 다른 컬럼과 달리 의미를 담지 않는다.
-- ============================================================

grant insert (id) on table public.contact_messages to anon, authenticated;

select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- select grantee, column_name
-- from information_schema.column_privileges
-- where table_schema='public' and table_name='contact_messages'
--   and privilege_type='INSERT' and grantee in ('anon','authenticated')
-- order by grantee, column_name;
-- -- 기대: anon 10개 + authenticated 10개 = 20줄 (기존 9개 + id)


-- ============================================================
-- [회귀 테스트]  ※ 코드 배포 후에 확인한다
--   1. 비로그인으로 문의 제출 → 접수되고 접수번호가 보이는지  ← 이번 수정의 목적
--   2. 로그인으로 문의 제출 → 접수되고 '내 문의'에 뜨는지
--   3. 제휴 문의(/support/partnership) 제출 → 접수번호가 보이는지
--   4. 첨부파일 있는 문의 제출
--   5. 관리자 문의 관리 탭에 새 문의가 뜨는지
--
--   SQL 만 적용하고 배포 전이라면: 기존 코드는 id 를 안 보내므로 로그인 문의는
--   계속 정상이고, 비로그인 문의는 여전히 실패한다(배포하면 고쳐진다).


-- ============================================================
-- [롤백]
-- ============================================================
-- revoke insert (id) on table public.contact_messages from anon, authenticated;
-- -- ⚠️ 코드를 배포한 뒤 이걸 되돌리면 모든 문의 접수가 깨진다.
-- --    코드를 먼저 되돌린 다음에만 실행할 것.
-- select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [후속 과제]
-- - 같은 패턴(.insert().select().single())을 쓰면서 SELECT 정책이 좁은 테이블이
--   더 있는지 훑어볼 것. RETURNING 이 SELECT 정책을 탄다는 걸 놓치기 쉽다.
-- - 비로그인 문의는 접수 후 사용자가 조회할 방법이 접수번호뿐이다.
--   조회 화면을 만들 거라면 이메일 + 접수번호 조합을 확인하는 RPC 가 필요하다.
-- ============================================================
