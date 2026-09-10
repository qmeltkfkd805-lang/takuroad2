-- ============================================================
-- 활동 보상 서버 이전 — 1/4  스키마
--
-- ⚠️ 아직 적용하지 말 것. 설계 확인 후 순서대로 적용한다.
--    이 파일은 컬럼과 인덱스만 추가한다. 동작을 바꾸지 않는다.
--    지금 적용해도 기존 코드는 그대로 돈다(새 컬럼을 아무도 안 쓴다).
--
-- 규모 (2026-09-10 기준)
--   activity_logs 97행 / exp_logs 108행 / route_completions 소량
--   → CONCURRENTLY 가 필요 없다. 일반 CREATE INDEX 로 충분하고
--     잠금은 밀리초 단위다. 트랜잭션 안에서 다른 문장과 함께 돌려도 된다.
-- ============================================================


-- ============================================================
-- 1. activity_logs.source_id — 멱등 키
-- ============================================================
--   related_id 는 배지 집계 의미가 걸려 있어 건드릴 수 없다.
--     · review 는 related_id 가 "리뷰 대상(샵·이벤트) id" 다.
--       같은 샵에 후기를 여러 번 쓰면 activity_logs 행이 여러 개 정상 생긴다
--       (실제로 최대 12건 있다). 그래서 related_id 로는 멱등을 걸 수 없다.
--     · "리뷰어" 배지는 distinct ref_id 로 "서로 다른 대상 10곳"을 센다.
--       related_id 를 리뷰 id 로 바꾸면 이 의미가 깨진다.
--   → 원본 행의 PK 를 담는 별도 컬럼을 두고, 멱등은 이걸로 건다.
--
--   원본 PK 는 전부 uuid 로 확인했다 (reviews / review_images / event_reviews /
--   shops / routes / route_completions / community_posts / tags / check_ins /
--   event_visits / activity_logs / exp_logs / route_sessions, 모두 gen_random_uuid()).
--
--   기존 행은 null 로 둔다. backfill 하지 않는다.
alter table public.activity_logs
  add column if not exists source_id uuid;

comment on column public.activity_logs.source_id is
  '원본 행 PK. 보상 멱등 키. 기존 행은 null (backfill 안 함). 서버만 채운다.';

create unique index if not exists uq_activity_logs_source
  on public.activity_logs (user_id, type, source_id)
  where source_id is not null;


-- ============================================================
-- 2. exp_logs 멱등 인덱스
-- ============================================================
--   지금까지 중복 방지는 grant_exp 안의 "select exists → insert" 뿐이었다.
--   원자적이지 않아서 탭 두 개나 동시 요청이면 양쪽 다 "없음"으로 읽고
--   둘 다 넣는다. 현재 데이터에 중복이 0건인 것은 보장이 아니라 운이다.
--
--   related_id 가 null 인 것(daily_goal, quest_*, 관리자 지급)은 제외한다.
--   관리자 지급은 같은 사유로 여러 번 주는 게 정상이다.
--
-- ⚠️ 미래 주의 — work_progress
--   work_progress 는 reason='work_progress', related_id=work_id 로
--   마일스톤(25/50/75/100%)마다 한 번씩 들어가는 설계다(once 도 안 쓴다).
--   즉 같은 (user, reason, related_id) 가 정상적으로 4번 생길 수 있고
--   이 인덱스와 충돌한다.
--   지금은 호출 경로가 끊겨 있어(tagCollectionService.addTagToCollection 을
--   부르는 곳이 저장소 전체에 없다) 데이터가 0건이라 인덱스를 걸 수 있다.
--   되살릴 때는 reason 을 'work_progress_25' 처럼 마일스톤별로 나눌 것.
--   백로그에도 같은 내용을 남겨두었다.
create unique index if not exists uq_exp_logs_once
  on public.exp_logs (user_id, reason, related_id)
  where related_id is not null;


-- ============================================================
-- 3. route_completions.verification_source — GPS 완주 식별
-- ============================================================
--   현재 route_completions 는 id / route_id / user_id / completed_at 뿐이고
--   route_sessions(confidence, field_ratio, risk_flags, finalized_at)와 연결하는
--   컬럼도 없다. 기존 행이 GPS 검증 완주인지 브라우저 자기 주장인지
--   구분할 방법이 전혀 없다. 추측해서 backfill 하지 않는다.
--
--   완주 경로는 셋이다
--     A 체크인 연동  routeProgressService.ts:86   브라우저 insert
--     B 지도 완주 버튼 routeVisitService.ts:30     브라우저 insert
--     C GPS 세션     /api/route-session/end       서버(service_role)
--   앞으로 C 만 'gps_session' 을 기록하고 보상한다. A·B 는 null 로 남는다.
alter table public.route_completions
  add column if not exists verification_source text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.route_completions'::regclass
      and conname = 'route_completions_vsrc_chk'
  ) then
    alter table public.route_completions
      add constraint route_completions_vsrc_chk
      check (verification_source is null
             or verification_source in ('gps_session', 'checkin', 'manual'));
  end if;
end $$;

comment on column public.route_completions.verification_source is
  'gps_session = /api/route-session/end 가 검증한 완주. null = 기존 행 또는 브라우저 경로. 서버만 채운다.';

-- 브라우저가 이 컬럼을 임의로 채우지 못하게 한다.
--
-- ⚠️ PostgreSQL 컬럼 권한은 테이블 권한에 더해지는 방식이다.
--    테이블 단위 INSERT 가 살아 있으면 컬럼 단위 REVOKE 는 아무 효과가 없다.
--    반드시 "테이블 권한 회수 → 컬럼 권한 부여" 순서로 해야 한다.
--
--    권한이 PUBLIC 에 붙어 있을 수 있으므로 public 까지 회수한다.
--    service_role 이 PUBLIC 경유로만 권한을 갖고 있었을 경우를 대비해
--    회수 후 명시적으로 다시 부여한다.
revoke insert on table public.route_completions from public, anon, authenticated;
grant  insert (route_id, user_id) on table public.route_completions to authenticated;
grant  insert, select, update, delete on table public.route_completions to service_role;


-- ============================================================
-- [적용 후 확인]
-- ============================================================
-- select column_name, data_type from information_schema.columns
-- where table_schema='public' and table_name='activity_logs' and column_name='source_id';
--
-- select indexname, indexdef from pg_indexes
-- where schemaname='public' and indexname in ('uq_activity_logs_source','uq_exp_logs_once');
--
-- -- 브라우저가 verification_source 를 못 넣는지
-- begin;
-- set local role authenticated;
-- set local request.jwt.claims = '{"sub":"<테스트계정 id>","role":"authenticated"}';
-- insert into public.route_completions (route_id, user_id, verification_source)
-- values ('00000000-0000-0000-0000-000000000000','<테스트계정 id>','gps_session');
-- rollback;   -- → 42501 permission denied for column verification_source
--
-- -- 정상 완주 insert 는 계속 되어야 한다
-- begin;
-- set local role authenticated;
-- set local request.jwt.claims = '{"sub":"<테스트계정 id>","role":"authenticated"}';
-- insert into public.route_completions (route_id, user_id)
-- values ('<실제 루트 id>','<테스트계정 id>');
-- rollback;   -- → 성공


-- ============================================================
-- [롤백]
-- ============================================================
-- drop index if exists public.uq_activity_logs_source;
-- drop index if exists public.uq_exp_logs_once;
-- alter table public.route_completions drop constraint if exists route_completions_vsrc_chk;
-- alter table public.route_completions drop column if exists verification_source;
-- alter table public.activity_logs drop column if exists source_id;
-- revoke insert on table public.route_completions from authenticated;
-- grant insert on table public.route_completions to authenticated;
--   ⚠️ 컬럼 추가는 되돌려도 데이터 손실이 없다(전부 null 이다).
--      인덱스를 지우면 동시 요청 중복 방지가 다시 사라진다.
