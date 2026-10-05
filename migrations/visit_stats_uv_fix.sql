-- 대시보드 '오늘 방문자' 카드와 트래픽 그래프 '방문자' 숫자 맞추기
--
-- 원인: 둘 다 한국 날짜 기준이지만 세는 단위가 달랐다.
--   · get_visit_summary.today_uv  = 방문자 수 (count(distinct session_id))
--   · get_timeseries('visits')    = 페이지뷰 수 (count(*))  ← 그래프 이름은 '방문자'
--   봇 걸러내기 목록도 그래프에만 headless 가 있었다.
-- 고침: 그래프의 'visits' 도 방문자 수(distinct session_id)로 세고, 봇 목록을 둘이 같게.
-- 다른 지표(signups·checkins·searches·activity)는 그대로 행 수.
-- 읽기 전용 함수만 다시 만든다. 데이터는 바꾸지 않는다.

create or replace function public.get_timeseries(metric text, days integer)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  tbl text; q text; result json;
  bot_filter text := '';
  cnt_expr text := 'count(*)';
  kst constant text := $$(created_at at time zone 'Asia/Seoul')::date$$;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception 'admin only';
  end if;
  tbl := case metric
    when 'signups' then 'profiles'
    when 'checkins' then 'check_ins'
    when 'searches' then 'search_logs'
    when 'activity' then 'activity_logs'
    when 'visits' then 'visit_logs'
    else null end;
  if tbl is null then raise exception 'bad metric'; end if;

  if metric = 'visits' then
    bot_filter := $$ and coalesce(user_agent,'') !~* 'bot|crawl|spider|slurp|yeti|bingpreview|facebookexternalhit|mediapartners|headless' $$;
    cnt_expr := 'count(distinct session_id)';   -- 방문자 수 (요약 카드 today_uv 와 같은 기준)
  end if;

  q := format($q$
    select coalesce(json_agg(json_build_object('date', gs::date, 'count', coalesce(c.cnt, 0)) order by gs), '[]'::json)
    from generate_series(
      (now() at time zone 'Asia/Seoul')::date - (%s - 1),
      (now() at time zone 'Asia/Seoul')::date,
      interval '1 day'
    ) as gs
    left join (
      select %s as dd, %s as cnt
      from %I
      where (created_at at time zone 'Asia/Seoul')::date >= (now() at time zone 'Asia/Seoul')::date - (%s - 1)
        %s
      group by %s
    ) c on c.dd = gs::date
  $q$, days, kst, cnt_expr, tbl, days, bot_filter, kst);

  execute q into result;
  return coalesce(result, '[]'::json);
end $function$;


create or replace function public.get_visit_summary()
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  res json;
  kst_today date := (now() at time zone 'Asia/Seoul')::date;
  bot text := 'bot|crawl|spider|slurp|yeti|bingpreview|facebookexternalhit|mediapartners|headless';
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception 'admin only';
  end if;
  select json_build_object(
    'today_pv',     (select count(*)                   from visit_logs where (created_at at time zone 'Asia/Seoul')::date = kst_today     and coalesce(user_agent,'') !~* bot),
    'today_uv',     (select count(distinct session_id) from visit_logs where (created_at at time zone 'Asia/Seoul')::date = kst_today     and coalesce(user_agent,'') !~* bot),
    'yesterday_uv', (select count(distinct session_id) from visit_logs where (created_at at time zone 'Asia/Seoul')::date = kst_today - 1 and coalesce(user_agent,'') !~* bot),
    'top_path',     (select path from visit_logs where (created_at at time zone 'Asia/Seoul')::date = kst_today and coalesce(user_agent,'') !~* bot group by path order by count(*) desc limit 1)
  ) into res;
  return res;
end $function$;

select pg_notify('pgrst', 'reload schema');
