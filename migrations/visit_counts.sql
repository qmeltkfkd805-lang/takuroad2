-- ============================================================
-- 다시 방문·다시 완주도 횟수로 남기기 (하루 1번까지)
--
-- 1) 샵 방문(check_ins)
--    예전: 샵마다 평생 1번 (user_id, shop_id) 유일
--    이제: 하루 1번 (user_id, shop_id, check_in_date) 유일 → 다른 날 또 가면 새 행 = +1
--    check_in_date 는 서버가 한국 날짜로 정한다(브라우저 값 무시)
--    기존 행은 그대로 둔다(삭제·수정 없음)
--
-- 2) 루트 완주 횟수(route_completion_runs) — 새 표
--    route_completions(완주 여부·검증·EXP·배지 기준)는 그대로 1행.
--    완주할 때마다(하루 1번) 여기 1행 → 완주 횟수 = 행 수
--    쓰기는 서버(service_role)만. 읽기는 본인만(공개 프로필은 서버가 권한 확인 후 읽는다)
--    기존 완주는 1회로 채운다(날짜는 활동 기록에서, 없으면 비움)
--
-- 경험치·배지는 바뀌지 않는다: 루트 EXP 는 여전히 처음 GPS 완주 1번, 샵 방문 EXP 는 0
-- ============================================================


-- ── 1. 샵 방문: 하루 1번 ──────────────────────────────────
-- (user_id, shop_id) 유일 제약/인덱스를 찾아서 지운다 (이름을 몰라도 되게)
do $$
declare r record;
begin
  for r in
    select c.conname
      from pg_constraint c
     where c.conrelid = 'public.check_ins'::regclass and c.contype = 'u'
       and (select array_agg(a.attname::text order by a.attname)
              from unnest(c.conkey) k join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k)
           = array['shop_id','user_id']
  loop
    execute format('alter table public.check_ins drop constraint %I', r.conname);
    raise notice 'dropped constraint %', r.conname;
  end loop;

  for r in
    select i.indexrelid::regclass::text as idx
      from pg_index i
     where i.indrelid = 'public.check_ins'::regclass and i.indisunique and not i.indisprimary
       and (select array_agg(a.attname::text order by a.attname)
              from unnest(i.indkey) k join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k)
           = array['shop_id','user_id']
  loop
    execute format('drop index %s', r.idx);
    raise notice 'dropped index %', r.idx;
  end loop;
end $$;

-- 방문 날짜는 서버가 한국 날짜로
create or replace function public.check_ins_set_kst_date()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  new.check_in_date := (now() at time zone 'Asia/Seoul')::date;
  return new;
end $$;

drop trigger if exists check_ins_set_kst_date on public.check_ins;
create trigger check_ins_set_kst_date
  before insert on public.check_ins
  for each row execute function public.check_ins_set_kst_date();

revoke all on function public.check_ins_set_kst_date() from public, anon, authenticated;

-- 같은 날 같은 샵은 한 번만
create unique index if not exists check_ins_user_shop_day_uniq
  on public.check_ins (user_id, shop_id, check_in_date);


-- ── 2. 루트 완주 횟수 ─────────────────────────────────────
create table if not exists public.route_completion_runs (
  id         uuid primary key default gen_random_uuid(),
  route_id   uuid not null references public.routes(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  run_date   date,                                  -- 한국 날짜. 옛 완주는 날짜를 모르면 null
  verified   text not null default 'manual' check (verified in ('gps', 'manual')),
  created_at timestamptz not null default now()
);
create unique index if not exists route_completion_runs_day_uniq
  on public.route_completion_runs (route_id, user_id, run_date);
create index if not exists route_completion_runs_user_idx
  on public.route_completion_runs (user_id, route_id);

alter table public.route_completion_runs enable row level security;
revoke all on public.route_completion_runs from public, anon, authenticated;
grant select on public.route_completion_runs to authenticated;

drop policy if exists rcr_select_own on public.route_completion_runs;
create policy rcr_select_own on public.route_completion_runs
  for select to authenticated using (user_id = auth.uid());

-- 기존 완주 = 1회 (이미 채웠으면 건너뜀)
insert into public.route_completion_runs (route_id, user_id, run_date, verified)
select c.route_id, c.user_id,
       (select (coalesce(a.occurred_at, a.created_at) at time zone 'Asia/Seoul')::date
          from public.activity_logs a
         where a.user_id = c.user_id and a.type = 'route_completed' and a.source_id = c.id
         order by a.created_at limit 1),
       case when c.verification_source = 'gps_session' then 'gps' else 'manual' end
  from public.route_completions c
 where not exists (select 1 from public.route_completion_runs r where r.route_id = c.route_id and r.user_id = c.user_id);

select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증] — 읽기 전용
-- ============================================================
-- select '1.방문 유일' 구분, string_agg(indexrelid::regclass::text, ', ') 값 from pg_index where indrelid='public.check_ins'::regclass and indisunique
-- union all select '2.완주 기록', (select count(*) from public.route_completions)::text || ' / 횟수표 ' || (select count(*) from public.route_completion_runs)::text;
-- 기대: 1 에 check_ins_user_shop_day_uniq 가 있고 (user_id,shop_id)만 묶는 것은 없음 / 2 = 두 숫자가 같음


-- ============================================================
-- [롤백] — 같은 샵 여러 날 방문 행이 생겼으면 1번 복구 전에 정리가 필요하다
-- ============================================================
-- drop table if exists public.route_completion_runs;
-- drop index if exists public.check_ins_user_shop_day_uniq;
-- drop trigger if exists check_ins_set_kst_date on public.check_ins;
-- drop function if exists public.check_ins_set_kst_date();
-- (예전 유일 제약 복구) alter table public.check_ins add constraint check_ins_user_shop_key unique (user_id, shop_id);
-- select pg_notify('pgrst', 'reload schema');
-- ============================================================
