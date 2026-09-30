-- 같은 샵이 여러 층에 있으면 층마다 따로 방문지·방문 체크 (예: 쿄우마샵 2층 / 3층 / 9층)
-- Supabase SQL Editor 에서 한 번 실행하세요. 여러 번 실행해도 안전합니다.
--
--   route_shops.stop_floor    : 이 방문지의 층 ("3층", "9층(1·2호점)" …). 한 층뿐이면 '' (빈 값)
--   route_progress.stop_floor : 방문 체크도 층별로 따로
--   기존 루트·기록은 전부 '' 로 채워져 지금과 똑같이 동작합니다.

-- 1) 칸 추가
alter table public.route_shops    add column if not exists stop_floor text not null default '';
alter table public.route_progress add column if not exists stop_floor text not null default '';

-- 2) "루트 + 샵" 하나만 허용하던 중복 막기를 풀기 (같은 샵을 층마다 담을 수 있게)
--    기본키는 건드리지 않습니다.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.route_shops'::regclass and contype = 'u'
  loop
    execute format('alter table public.route_shops drop constraint %I', c.conname);
  end loop;
  for c in
    select i.relname as idx from pg_index x
    join pg_class i on i.oid = x.indexrelid
    where x.indrelid = 'public.route_shops'::regclass and x.indisunique and not x.indisprimary
  loop
    execute format('drop index if exists public.%I', c.idx);
  end loop;
end $$;

-- route_shops 기본키가 (루트, 샵) 조합이면 층까지 넣은 기본키로 (id 칸이 기본키면 그대로)
do $$
declare pk text; has_shop boolean;
begin
  select c.conname,
         exists (select 1 from unnest(c.conkey) k join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k where a.attname = 'shop_id')
    into pk, has_shop
  from pg_constraint c
  where c.conrelid = 'public.route_shops'::regclass and c.contype = 'p';
  if pk is not null and has_shop then
    execute format('alter table public.route_shops drop constraint %I', pk);
    alter table public.route_shops add primary key (route_id, shop_id, stop_floor);
  end if;
end $$;

-- 3) 방문 체크 중복 막기를 "루트 + 사람 + 샵 + 층" 기준으로 바꾸기
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.route_progress'::regclass and contype = 'u'
  loop
    execute format('alter table public.route_progress drop constraint %I', c.conname);
  end loop;
  for c in
    select i.relname as idx from pg_index x
    join pg_class i on i.oid = x.indexrelid
    where x.indrelid = 'public.route_progress'::regclass and x.indisunique and not x.indisprimary
  loop
    execute format('drop index if exists public.%I', c.idx);
  end loop;
end $$;

-- 기본키가 (루트, 사람, 샵) 조합이면 층까지 넣은 기본키로 바꾸기 (id 칸이 기본키면 그대로)
do $$
declare pk text; has_shop boolean;
begin
  select c.conname,
         exists (select 1 from unnest(c.conkey) k join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k where a.attname = 'shop_id')
    into pk, has_shop
  from pg_constraint c
  where c.conrelid = 'public.route_progress'::regclass and c.contype = 'p';
  if pk is not null and has_shop then
    execute format('alter table public.route_progress drop constraint %I', pk);
    alter table public.route_progress add primary key (route_id, user_id, shop_id, stop_floor);
  end if;
end $$;

create unique index if not exists route_progress_stop_uq
  on public.route_progress (route_id, user_id, shop_id, stop_floor);

-- 확인용: 두 칸이 생겼는지
select table_name, column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and column_name = 'stop_floor'
  and table_name in ('route_shops', 'route_progress');
