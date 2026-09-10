-- ============================================================
-- 활동 보상 서버 이전 — 4/4  권한 회수  [맨 마지막]
--
-- ⚠️ 절대 먼저 적용하지 말 것.
--    아래 조건이 전부 충족된 뒤에만 적용한다.
--      1. 모든 정상 activity_logs 쓰기가 /api/activity 로 이전됨
--      2. 배지 자동 평가가 /api/badges/evaluate 로 이전됨
--      3. 이벤트 제보 승인이 /api/admin/approve-submission 으로 이전됨
--      4. 관리자 재평가 정상 (완료, 검증됨)
--      5. 일일 목표·퀘스트 회귀 확인
--      6. GPS 루트 완주 보상 회귀 확인
--      7. 활동별 정상 보상 회귀 전부 통과
--      8. REST 직접 위조 테스트 통과
--    권한을 먼저 끊으면 사용자 활동 기록이 조용히 빠진다.
-- ============================================================


-- ============================================================
-- 1. activity_logs — 서버 전용 기록 테이블로
-- ============================================================
--   현재 상태
--     anon·authenticated 둘 다 테이블 단위 INSERT/UPDATE/DELETE 권한 보유
--     정책은 activity_logs_insert_own(user_id = auth.uid()) 과
--            activity_logs_select_own(user_id = auth.uid()) 둘뿐
--   실효 위험
--     UPDATE·DELETE 는 허용 정책이 없어 RLS 가 막고 있고,
--     anon 은 auth.uid() 가 null 이라 INSERT 정책이 false 다.
--     실제로 뚫려 있는 건 "로그인 사용자가 자기 행을 위조하는 것" 하나인데,
--     배지 조건이 이 테이블을 읽으므로 배지를 통째로 farm 할 수 있다.
--     type·related_id·snapshot 을 클라이언트가 정하기 때문이다.
--     (전국 탐험가는 snapshot.region 의 distinct 개수를 센다)
--
--   UPDATE·DELETE 는 앱 전체에서 호출부가 0건이다(연대기는 삭제하지 않는 설계).
--   서버에도 남기지 않는다.
revoke insert, update, delete on table public.activity_logs from public, anon, authenticated;

-- service_role 이 PUBLIC 경유로만 권한을 갖고 있었을 경우를 대비해 명시적으로 부여
grant select, insert on table public.activity_logs to service_role;

-- 사용자 본인 조회는 유지 (마이페이지 활동 기록·연대기)
-- activity_logs_select_own 정책은 그대로 둔다.
drop policy if exists activity_logs_insert_own on public.activity_logs;


-- ============================================================
-- 2. grant_exp — 내부 전용으로
-- ============================================================
--   모든 정상 지급이 서버 경로(record_activity_reward, admin_grant_exp,
--   claim_daily_*, run_fanart_selection, routeRun/rewardService)를 지나간 뒤에만.
--
--   definer 함수들은 소유자(postgres) 권한으로 실행되므로 영향받지 않는다.
--     admin_grant_exp / claim_daily_goal / claim_daily_quests /
--     run_fanart_selection / record_activity_reward
revoke execute on function
  public.grant_exp(uuid, integer, text, text, uuid, boolean, integer)
  from public, anon, authenticated;
grant execute on function
  public.grant_exp(uuid, integer, text, text, uuid, boolean, integer)
  to service_role;


-- ============================================================
-- 3. user_badge_tiers — 배지 자동 지급도 서버 전용으로
-- ============================================================
--   사용자가 원하는 badge_tier_id 를 직접 insert 할 수 있으면
--   서버가 조건을 계산하는 의미가 없다.
--   (user_id, badge_tier_id) 유니크 제약은 그대로 둔다.
revoke insert, update, delete on table public.user_badge_tiers from public, anon, authenticated;
grant select, insert on table public.user_badge_tiers to service_role;

-- 사용자·타인 프로필의 배지 조회는 유지한다 (select 정책은 공개다)


select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 위조 테스트]  일반 사용자 JWT 기준
-- ============================================================
-- begin; set local role authenticated;
-- set local request.jwt.claims = '{"sub":"<테스트계정>","role":"authenticated"}';
-- insert into public.activity_logs (user_id, type, related_id, snapshot)
-- values ('<테스트계정>','shop_visit','00000000-0000-0000-0000-000000000000','{"region":"홍대"}');
-- rollback;   -- → 42501 permission denied for table activity_logs
--
-- begin; set local role authenticated;
-- set local request.jwt.claims = '{"sub":"<테스트계정>","role":"authenticated"}';
-- select * from public.grant_exp('<테스트계정>', 99999, 'x');
-- rollback;   -- → 42501 permission denied for function grant_exp
--
-- begin; set local role authenticated;
-- set local request.jwt.claims = '{"sub":"<테스트계정>","role":"authenticated"}';
-- insert into public.user_badge_tiers (user_id, badge_tier_id)
-- values ('<테스트계정>','<아무 tier id>');
-- rollback;   -- → 42501 permission denied for table user_badge_tiers
--
-- -- 조회는 계속 되어야 한다
-- begin; set local role authenticated;
-- set local request.jwt.claims = '{"sub":"<테스트계정>","role":"authenticated"}';
-- select count(*) from public.activity_logs;      -- → 본인 행만 보임
-- select count(*) from public.user_badge_tiers;   -- → 공개 select 정책대로 보임
-- rollback;


-- ============================================================
-- [회귀 확인]  적용 직후 앱에서
-- ============================================================
--   1. 후기 작성       → 활동 기록 + EXP 10
--   2. 후기 사진 첨부   → 활동 기록 + EXP 3
--   3. 샵 등록(공개)    → 활동 기록 + EXP 15
--   4. 루트 제작       → 활동 기록 + EXP 15
--   5. 팬아트 업로드    → 활동 기록 + EXP 10
--   6. 샵 방문 기록     → 활동 기록만, EXP 0, 연대기에 표시됨
--   7. 이벤트 참여      → 활동 기록만, EXP 0
--   8. GPS 루트 완주    → 활동 기록 + EXP 15
--   9. 비GPS 루트 완주  → 완주 기록은 저장, 활동 기록·EXP 없음
--  10. 일일 목표·퀘스트  → 정상
--  11. 관리자 EXP 지급   → 정상 + 알림
--  12. 관리자 배지 재평가 → 정상 (배지 + 보너스 EXP)
--  13. 이벤트 제보 승인   → 제보자에게 EXP 15
--  14. 대표 팬아트 선정   → 작성자에게 EXP 50 (run_fanart_selection)
--  15. 레벨업 모달        → 정상
--  16. 비로그인 둘러보기   → 콘솔에 42501 없음


-- ============================================================
-- [롤백]
--   ⚠️ 되돌리면 배지 farm 과 임의 EXP 지급이 그대로 살아난다.
--      원인을 특정한 항목 하나만 임시로 되돌릴 것.
-- ============================================================
-- grant insert on table public.activity_logs to authenticated;
-- create policy activity_logs_insert_own on public.activity_logs
--   for insert to authenticated with check (user_id = auth.uid());
-- grant execute on function public.grant_exp(uuid, integer, text, text, uuid, boolean, integer) to authenticated;
-- grant insert on table public.user_badge_tiers to authenticated;
-- select pg_notify('pgrst', 'reload schema');
