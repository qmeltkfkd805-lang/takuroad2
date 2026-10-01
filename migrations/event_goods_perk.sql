-- 이벤트 메뉴·굿즈에 '특전'(perk) 종류 추가
-- Supabase SQL Editor 에서 한 번 실행하세요. 여러 번 실행해도 안전합니다.
-- kind 칸이 enum 이든 text + check 제약이든 둘 다 처리합니다. (event_goods, event_goods_history)

do $$
declare
  t text;
  typ text;
  c record;
begin
  foreach t in array array['event_goods', 'event_goods_history'] loop
    if to_regclass('public.' || t) is null then continue; end if;

    select case when a.atttypid = 'text'::regtype or a.atttypid = 'varchar'::regtype then null
                else format_type(a.atttypid, null) end
      into typ
    from pg_attribute a
    where a.attrelid = ('public.' || t)::regclass and a.attname = 'kind' and not a.attisdropped;

    if typ is not null and exists (select 1 from pg_type where oid = typ::regtype and typtype = 'e') then
      -- enum 이면 값 추가
      if not exists (select 1 from pg_enum where enumtypid = typ::regtype and enumlabel = 'perk') then
        execute format('alter type %s add value %L', typ, 'perk');
      end if;
    else
      -- text 면 kind 를 검사하는 check 제약을 새로 만든다
      for c in
        select conname from pg_constraint
        where conrelid = ('public.' || t)::regclass and contype = 'c'
          and pg_get_constraintdef(oid) ilike '%kind%'
      loop
        execute format('alter table public.%I drop constraint %I', t, c.conname);
      end loop;
      execute format(
        'alter table public.%I add constraint %I check (kind is null or kind in (''perk'', ''menu'', ''goods''))',
        t, t || '_kind_check');
    end if;
  end loop;
end $$;

-- 확인용: 지금 kind 에 들어 있는 값
select kind, count(*) from public.event_goods group by kind order by kind;
