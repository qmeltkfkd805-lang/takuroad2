-- ============================================================
-- 다녀온 사람이 있는 이벤트는 "삭제" 대신 "숨김" (연대기 보호)
--
-- 왜
--   events 를 지우면 event_visits(다녀왔어요)·event_visit_photos(사진)가 ON DELETE CASCADE 로
--   같이 사라져서, 다녀온 사람들의 연대기 링크·사진·참여 수가 깨진다.
--
-- 규칙
--   - 삭제 요청이 와도 event_visits 가 1건이라도 있으면 실제로 지우지 않고 deleted_at 만 찍는다.
--     (BEFORE DELETE 트리거 — 화면 삭제 버튼·관리자 도구 등 어느 경로든 같다)
--   - 아무도 안 다녀온 이벤트는 지금처럼 진짜 삭제.
--   - 숨긴 이벤트는 작성자·관리자·그 이벤트를 다녀온 사람만 읽을 수 있다(SELECT 정책).
--     → 다른 사람에겐 목록·지도·검색 어디서도 안 보이고, 다녀온 사람은 연대기에서 상세를 열 수 있다.
--   - deleted_at 은 일반 사용자가 직접 못 바꾼다(수정 정책이 "로그인 누구나"라서 별도 가드).
--     트리거 내부·관리자·SQL 편집기(auth.uid() 없음)만 바꿀 수 있다. 되살리기 = deleted_at 을 null 로.
--
-- 사전 확인(2026-09-28): 이벤트 조회 정책 "이벤트 조회 공개" = true,
--   수정 정책 events_update_any_authed = true, 삭제 = 작성자 또는 관리자.
-- ============================================================


-- ── 1. 숨김 표시 칸 ───────────────────────────────────────
alter table public.events add column if not exists deleted_at timestamptz;

create index if not exists events_deleted_at_idx
  on public.events (deleted_at) where deleted_at is not null;


-- ── 2. 삭제 → 다녀온 사람이 있으면 숨김으로 ──────────────
-- SECURITY DEFINER: event_visits 는 RLS 로 본인 것만 보이므로, 전체 존재 여부는 정의자 권한으로 본다.
create or replace function public.events_soft_delete_if_visited()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if exists (select 1 from public.event_visits v where v.event_id = old.id) then
    update public.events set deleted_at = coalesce(deleted_at, now()) where id = old.id;
    return null;   -- 실제 삭제는 취소 (다녀온 기록·사진 보존)
  end if;
  return old;
end $$;

drop trigger if exists events_soft_delete_if_visited on public.events;
create trigger events_soft_delete_if_visited
  before delete on public.events
  for each row execute function public.events_soft_delete_if_visited();

revoke all on function public.events_soft_delete_if_visited() from public, anon, authenticated;


-- ── 3. deleted_at 은 아무나 못 바꾸게 ─────────────────────
create or replace function public.events_guard_deleted_at()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.deleted_at is distinct from old.deleted_at
     and pg_trigger_depth() <= 1                      -- 2번 트리거 안에서 온 변경은 허용
     and auth.uid() is not null                        -- SQL 편집기·서비스 키는 허용
     and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  then
    raise exception '이벤트 삭제 상태는 직접 바꿀 수 없어요';
  end if;
  return new;
end $$;

drop trigger if exists events_guard_deleted_at on public.events;
create trigger events_guard_deleted_at
  before update on public.events
  for each row execute function public.events_guard_deleted_at();

revoke all on function public.events_guard_deleted_at() from public, anon, authenticated;


-- ── 4. 숨긴 이벤트는 작성자·관리자·다녀온 사람만 읽기 ──
drop policy if exists "이벤트 조회 공개" on public.events;
create policy "이벤트 조회 공개" on public.events
  for select
  using (
    deleted_at is null
    or created_by = auth.uid()
    or exists (select 1 from public.event_visits v where v.event_id = events.id and v.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증] — 읽기 전용
-- ============================================================
-- select '1.칸' as 구분, count(*)::text as 값 from information_schema.columns
--  where table_schema='public' and table_name='events' and column_name='deleted_at'
-- union all
-- select '2.트리거', string_agg(trigger_name || ' ' || action_timing || ' ' || event_manipulation, ', ')
--   from information_schema.triggers where event_object_schema='public' and event_object_table='events'
-- union all
-- select '3.조회정책', coalesce(qual, '-') from pg_policies
--  where schemaname='public' and tablename='events' and cmd='SELECT';
-- 기대: 1 = 1 / 2 에 events_soft_delete_if_visited BEFORE DELETE, events_guard_deleted_at BEFORE UPDATE
--       3 = deleted_at IS NULL OR ... 로 시작


-- ============================================================
-- [숨긴 이벤트 보기 / 되살리기] — SQL 편집기에서
-- ============================================================
-- select id, title, deleted_at from public.events where deleted_at is not null order by deleted_at desc;
-- update public.events set deleted_at = null where id = '<이벤트 id>';


-- ============================================================
-- [롤백] — 숨겨져 있던 이벤트는 다시 모두에게 보인다
-- ============================================================
-- drop trigger if exists events_soft_delete_if_visited on public.events;
-- drop trigger if exists events_guard_deleted_at on public.events;
-- drop function if exists public.events_soft_delete_if_visited();
-- drop function if exists public.events_guard_deleted_at();
-- drop policy if exists "이벤트 조회 공개" on public.events;
-- create policy "이벤트 조회 공개" on public.events for select using (true);
-- select pg_notify('pgrst', 'reload schema');
-- (deleted_at 칸은 남겨둬도 무해)
-- ============================================================
