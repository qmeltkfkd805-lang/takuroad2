-- ============================================================
-- shop_verify_requests 정리 — 쓰기 권한 + 거절 사유 전용 컬럼
--
-- 1) 권한: shops와 같은 문제가 남아 있다. anon·authenticated 모두 테이블 단위로
--    INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER를 갖고 있다.
--    RLS 정책이 UPDATE는 관리자만 통과시키고 DELETE는 정책 자체가 없어 막고 있지만,
--    TRUNCATE는 RLS를 무시하고 TRIGGER는 남의 UPDATE에 함수를 붙일 수 있다.
--    INSERT는 컬럼 제한이 없어 신청할 때 status='approved'를 직접 심을 수도 있다.
--    (소유권은 /api/admin/shop-verify가 service_role로만 옮기므로 승인 효과는 없지만,
--     내 인증 현황 화면에 '인증 완료'로 보이고 관리자 대기열에서는 사라진다)
--
-- 2) reject_reason: 지금은 note 하나를 신청 메모와 거절 사유가 같이 쓴다.
--    신청 시 '[사업자] … / 등록번호 …'가 들어가고, 거절할 때 사유를 적으면 덮어쓴다.
--    사유 없이 거절하면 신청 원문이 그대로 남아, 어떤 rejected 행의 note가
--    진짜 사유인지 구분할 방법이 없다. 그래서 화면에서는 '거절 사유'라고 못 쓰고
--    중립적으로 '안내 내용'이라고만 표시하고 있다. 컬럼을 나눠서 이걸 끝낸다.
--
-- ⚠️ 이번만 순서가 반대다 — **SQL을 먼저 돌리고 코드를 배포한다.**
--    컬럼 추가는 더하기만 하는 변경이라 지금 도는 코드에 아무 영향이 없다.
--    반대로 reject_reason을 읽는 코드가 먼저 나가면 컬럼이 없어서 조회가 깨진다.
--    기존 데이터는 backfill 하지 않는다 — note의 어느 쪽이 사유인지 알 수 없어서
--    옮기면 신청 메모를 거절 사유로 둔갑시키게 된다. 옛 행은 reject_reason이 NULL로
--    남고, 화면은 지금처럼 note를 '안내 내용'으로 보여준다.
-- ============================================================


-- ── 1) RLS를 우회하는 권한 회수 ─────────────────────────────
revoke truncate, references, trigger on table public.shop_verify_requests from anon, authenticated;

-- DELETE 정책이 아예 없어 RLS가 이미 막고 있다. 권한도 거둬 방어선을 겹친다.
revoke delete on table public.shop_verify_requests from anon, authenticated;

-- UPDATE: 승인·거절은 /api/admin/shop-verify가 service_role로 처리한다(2026-09-03 배포).
-- 클라이언트가 이 테이블을 UPDATE할 이유가 더는 없다.
revoke update on table public.shop_verify_requests from anon, authenticated;


-- ── 2) INSERT 허용 컬럼 ─────────────────────────────────────
-- 근거: shopService.requestShopVerify의 payload 그대로.
-- status는 주지 않는다 → 기본값 'pending'이 적용된다.
-- reviewed_by·reject_reason·created_at·updated_at도 서버 몫이다.
revoke insert on table public.shop_verify_requests from anon, authenticated;

grant insert (shop_id, user_id, note, evidence_url, extra)
  on public.shop_verify_requests to authenticated;
-- anon은 아무것도 주지 않는다. INSERT 정책도 user_id = auth.uid()라 어차피 막힌다.


-- ── 3) 거절 사유 전용 컬럼 ──────────────────────────────────
-- 기본값을 주지 않는다. NULL = "이 컬럼이 생기기 전 데이터이거나 사유가 적히지 않음".
alter table public.shop_verify_requests add column if not exists reject_reason text;

comment on column public.shop_verify_requests.reject_reason is
  '관리자가 거절할 때 적은 사유. note(신청 시 사업자 정보)와 섞지 않는다.';
comment on column public.shop_verify_requests.note is
  '신청자가 낸 메모(사업자 정보). 2026-09-03 이전에는 거절 사유가 여기 덮어써지기도 했다.';


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증]
-- ============================================================
-- -- 1) anon은 SELECT만, authenticated는 SELECT만 남아야 한다
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema='public' and table_name='shop_verify_requests'
--   and grantee in ('anon','authenticated')
-- order by grantee, privilege_type;
--
-- -- 2) INSERT는 5개 컬럼만 true, status는 false여야 한다
-- select column_name,
--        has_column_privilege('authenticated','public.shop_verify_requests',column_name,'INSERT') as ins
-- from information_schema.columns
-- where table_schema='public' and table_name='shop_verify_requests'
-- order by ordinal_position;
--
-- -- 3) 컬럼이 생겼는가 + 기존 행은 전부 NULL인가
-- select count(*) as total, count(reject_reason) as has_reason
-- from public.shop_verify_requests;


-- ============================================================
-- [회귀 테스트]
--   1. 일반 계정으로 사장님 인증 신청 → 정상 접수, status='pending'
--   2. 관리자 승인 → 소유권 이전, 요청 approved
--   3. 관리자 거절(사유 입력) → reject_reason에 저장, note는 신청 원문 그대로
--   4. 관리자 거절(사유 없이) → reject_reason NULL, note 그대로
--   5. 마이페이지 인증 현황 — reject_reason이 있으면 '거절 사유',
--      없고 note만 있으면 '안내 내용', 둘 다 없으면 안내 문장
--   6. 거절 후 재신청 → 폼이 지난 내용으로 채워지고 새 요청이 pending으로 들어감
-- ============================================================


-- ============================================================
-- [롤백] ⚠️ 권한 롤백은 취약한 상태로 되돌리는 것이다
-- ============================================================
-- alter table public.shop_verify_requests drop column if exists reject_reason;
-- revoke insert on public.shop_verify_requests from authenticated;
-- grant insert, update, delete, truncate, references, trigger
--   on table public.shop_verify_requests to authenticated;
-- grant insert, update, delete, truncate, references, trigger
--   on table public.shop_verify_requests to anon;
-- select pg_notify('pgrst', 'reload schema');
