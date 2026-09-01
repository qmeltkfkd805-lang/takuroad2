-- 여러 지점에서 하는 같은 이벤트 묶기 (events.series_key)
--
-- 왜 RPC인가:
--   events의 UPDATE 정책은 작성자·관리자만 허용한다. 그런데 "지점만 다른 같은 이벤트"는
--   보통 서로 다른 사람이 등록한다. 묶으려면 상대방 행의 series_key 하나를 채워야 하므로,
--   그 컬럼 하나만 건드리는 SECURITY DEFINER 함수를 따로 둔다.
--   (events 자체의 UPDATE 정책은 그대로 둔다 — 여기서 완화하지 않는다)
--
-- 선행: migrations/event_series_key.sql (series_key 컬럼)

create or replace function public.link_event_series(p_event_ids uuid[], p_key text)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_key text;
  v_n   int;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;

  v_n := coalesce(array_length(p_event_ids, 1), 0);
  if v_n = 0 then return null; end if;
  if v_n > 20 then
    raise exception '한 번에 20개까지만 묶을 수 있습니다.' using errcode = '22023';
  end if;

  -- 이미 키가 있는 이벤트가 섞여 있으면 그 키를 따른다 (기존 묶음에 합류)
  select e.series_key into v_key
    from public.events e
   where e.id = any(p_event_ids)
     and e.series_key is not null
   order by e.created_at
   limit 1;

  v_key := coalesce(v_key, nullif(btrim(p_key), ''));
  if v_key is null then
    raise exception '묶음 키가 비어 있습니다.' using errcode = '22023';
  end if;
  v_key := left(v_key, 60);

  update public.events
     set series_key = v_key
   where id = any(p_event_ids)
     and series_key is distinct from v_key;

  return v_key;
end
$$;

revoke all on function public.link_event_series(uuid[], text) from public, anon;
grant execute on function public.link_event_series(uuid[], text) to authenticated;

comment on function public.link_event_series(uuid[], text) is
  '같은 이벤트의 여러 지점을 series_key로 묶는다. 로그인 사용자만, 이 컬럼만 갱신.';

select pg_notify('pgrst', 'reload schema');
