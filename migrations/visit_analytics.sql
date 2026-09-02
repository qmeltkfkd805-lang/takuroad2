-- 방문 경로 분석 — visit_logs에 이미 쌓이는 데이터를 관리자 화면에서 보기 위한 조회 함수들.
--
-- visit_logs 컬럼: user_id, session_id, path, referrer, user_agent, created_at
-- 새로 저장하는 건 없다. 읽기 전용 집계만 추가한다.
--
-- 권한: 전부 관리자만 (profiles.role = 'admin'). signup_source.sql과 같은 패턴.

-- ── 0) 조회 성능용 인덱스 ─────────────────────────────────────────
create index if not exists visit_logs_created_at_idx on public.visit_logs (created_at desc);
create index if not exists visit_logs_session_time_idx on public.visit_logs (session_id, created_at);


-- ── 0-1) 조회 기간의 시작 시각 ────────────────────────────────────
-- days > 0  : 지금부터 N일 전까지 (기존 동작)
-- days <= 0 : "오늘" — 한국 시간 자정부터. 서버가 UTC라 그냥 날짜를 자르면 하루가 밀린다.
create or replace function public.visit_window_start(days int)
returns timestamptz
language sql
stable
as $$
  select case
    when coalesce(days, 30) <= 0
      then (date_trunc('day', (now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul')
    else now() - make_interval(days => days)
  end;
$$;

comment on function public.visit_window_start(int) is
  '방문 통계 조회 시작 시각. days<=0이면 한국 시간 오늘 자정.';


-- ── 1) 경로 정규화 ────────────────────────────────────────────────
-- /event/00cf81a6-... 처럼 실제 주소가 그대로 쌓이면 페이지 순위가 이벤트 수만큼 흩어진다.
-- 동적 구간을 :id / :slug 로 묶어서 "이벤트 상세" 하나로 세기 위한 함수.
-- ⚠️ 정적 경로(/event/new 등)가 동적 구간과 모양이 같으므로 먼저 걸러낸다.
create or replace function public.normalize_visit_path(p text)
returns text
language sql
immutable
as $$
  select case
    -- 정적 경로 — 그대로 둔다
    when v in ('/event/new', '/event/submit', '/work/new', '/shop/new', '/shop/claim',
               '/route/new', '/community/write', '/profile/exhibit/new', '/profile/goods/new')
      then v

    when v ~ '^/shop/claim/[^/]+$'           then '/shop/claim/:slug'
    when v ~ '^/event/[^/]+'                 then regexp_replace(v, '^/event/[^/]+', '/event/:id')
    when v ~ '^/shop/[^/]+'                  then regexp_replace(v, '^/shop/[^/]+', '/shop/:slug')
    when v ~ '^/work/[^/]+'                  then regexp_replace(v, '^/work/[^/]+', '/work/:slug')
    when v ~ '^/route/[^/]+'                 then regexp_replace(v, '^/route/[^/]+', '/route/:token')
    when v ~ '^/profile/goods/[^/]+'         then regexp_replace(v, '^/profile/goods/[^/]+', '/profile/goods/:id')
    when v ~ '^/profile/collections/[^/]+'   then '/profile/collections/:workId'
    when v ~ '^/profile/exhibit/[^/]+'       then '/profile/exhibit/:id'
    when v ~ '^/exhibit/[^/]+/[^/]+'         then '/exhibit/:nickname/:id'
    when v ~ '^/exhibit/[^/]+'               then '/exhibit/:nickname'
    when v ~ '^/community/[^/]+'             then '/community/:id'
    when v ~ '^/tag/[^/]+'                   then '/tag/:slug'
    when v ~ '^/place/[^/]+'                 then '/place/:slug'
    when v ~ '^/user/[^/]+'                  then '/user/:nickname'
    else v
  end
  from (select coalesce(nullif(btrim(p), ''), '/') as v) s;
$$;

comment on function public.normalize_visit_path(text) is
  '방문 경로의 동적 구간을 :id/:slug로 묶는다. 페이지별 순위 집계용.';


-- ── 2) 페이지별 순위 ──────────────────────────────────────────────
-- grouped = true  : /event/:id 로 묶어서 "어떤 종류의 페이지가 인기인지"
-- grouped = false : 실제 주소 그대로 "어느 이벤트가 인기인지"
drop function if exists public.get_top_paths(int, boolean, int);

create function public.get_top_paths(days int default 30, grouped boolean default true, limit_n int default 30)
returns table (path text, pv bigint, uv bigint)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception '권한이 없습니다';
  end if;

  return query
  select (case when grouped then public.normalize_visit_path(v.path) else coalesce(v.path, '/') end)::text,
         count(*)::bigint,
         count(distinct v.session_id)::bigint
  from public.visit_logs v
  where v.created_at >= public.visit_window_start(days)
  group by 1
  order by 2 desc
  limit greatest(1, least(limit_n, 200));
end;
$$;

revoke all on function public.get_top_paths(int, boolean, int) from public, anon;
grant execute on function public.get_top_paths(int, boolean, int) to authenticated;


-- ── 3) 유입 경로 ──────────────────────────────────────────────────
-- 세션의 "첫 페이지"만 본다. SPA라 이후 이동은 referrer가 자기 사이트로 남아 의미가 없다.
-- 그래서 값은 세션 수(= 그 경로로 들어온 방문 수)다.
drop function if exists public.get_visit_referrers(int, int);

create function public.get_visit_referrers(days int default 30, limit_n int default 20)
returns table (source text, sessions bigint, landing_path text)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception '권한이 없습니다';
  end if;

  return query
  with firsts as (
    select distinct on (v.session_id)
           v.session_id, v.referrer, v.path
    from public.visit_logs v
    where v.created_at >= public.visit_window_start(days)
    order by v.session_id, v.created_at
  ),
  labeled as (
    select case
             when f.referrer is null or btrim(f.referrer) = ''  then '직접 방문'
             when f.referrer ~* 'takuroad'                      then '사이트 내부'
             when f.referrer ~* 'naver'                         then '네이버'
             when f.referrer ~* 'google'                        then '구글'
             when f.referrer ~* '(daum|kakao)'                  then '다음·카카오'
             when f.referrer ~* 'instagram'                     then '인스타그램'
             when f.referrer ~* '(twitter|//x\.com|t\.co)'      then 'X(트위터)'
             when f.referrer ~* 'youtube'                       then '유튜브'
             when f.referrer ~* 'facebook'                      then '페이스북'
             when f.referrer ~* '(tistory|velog|brunch|blog)'   then '블로그'
             when f.referrer ~* 'bing'                          then '빙'
             else coalesce(substring(f.referrer from '^https?://([^/]+)'), f.referrer)
           end as source,
           public.normalize_visit_path(f.path) as landing
    from firsts f
  )
  select l.source::text,
         count(*)::bigint,
         (mode() within group (order by l.landing))::text
  from labeled l
  group by 1
  order by 2 desc
  limit greatest(1, least(limit_n, 100));
end;
$$;

revoke all on function public.get_visit_referrers(int, int) from public, anon;
grant execute on function public.get_visit_referrers(int, int) to authenticated;


-- ── 4) 이탈 페이지 ────────────────────────────────────────────────
-- 세션의 "마지막 페이지". 한 페이지만 보고 나간 세션(직행 이탈)은 따로 센다.
drop function if exists public.get_exit_paths(int, int);

create function public.get_exit_paths(days int default 30, limit_n int default 30)
returns table (path text, exits bigint, bounces bigint)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception '권한이 없습니다';
  end if;

  return query
  with scoped as (
    select v.session_id, v.path, v.created_at
    from public.visit_logs v
    where v.created_at >= public.visit_window_start(days)
  ),
  sized as (
    select session_id, count(*) as n from scoped group by session_id
  ),
  lasts as (
    select distinct on (s.session_id) s.session_id, s.path
    from scoped s
    order by s.session_id, s.created_at desc
  )
  select public.normalize_visit_path(l.path)::text,
         count(*)::bigint,
         count(*) filter (where z.n = 1)::bigint
  from lasts l
  join sized z on z.session_id = l.session_id
  group by 1
  order by 2 desc
  limit greatest(1, least(limit_n, 200));
end;
$$;

revoke all on function public.get_exit_paths(int, int) from public, anon;
grant execute on function public.get_exit_paths(int, int) to authenticated;


-- ── 5) 최근 세션 목록 ─────────────────────────────────────────────
-- 방문자 한 명의 여정을 열어보기 위한 목록. 회원이면 닉네임까지.
drop function if exists public.get_recent_visit_sessions(int, int);

create function public.get_recent_visit_sessions(days int default 7, limit_n int default 50)
returns table (
  session_id  text,
  user_id     uuid,
  nickname    text,
  started_at  timestamptz,
  ended_at    timestamptz,
  page_count  bigint,
  entry_path  text,
  exit_path   text
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception '권한이 없습니다';
  end if;

  return query
  with scoped as (
    select v.session_id::text as sid, v.user_id, v.path, v.created_at
    from public.visit_logs v
    where v.created_at >= public.visit_window_start(days)
  ),
  agg as (
    select s.sid,
           min(s.created_at) as started_at,
           max(s.created_at) as ended_at,
           count(*)::bigint  as page_count,
           (array_agg(s.user_id) filter (where s.user_id is not null))[1] as uid
    from scoped s
    group by s.sid
    order by min(s.created_at) desc
    limit greatest(1, least(limit_n, 200))
  ),
  first_p as (
    select distinct on (s.sid) s.sid, s.path
    from scoped s join agg a on a.sid = s.sid
    order by s.sid, s.created_at
  ),
  last_p as (
    select distinct on (s.sid) s.sid, s.path
    from scoped s join agg a on a.sid = s.sid
    order by s.sid, s.created_at desc
  )
  select a.sid,
         a.uid,
         p.nickname::text,
         a.started_at,
         a.ended_at,
         a.page_count,
         f.path::text,
         l.path::text
  from agg a
  left join first_p f on f.sid = a.sid
  left join last_p  l on l.sid = a.sid
  left join public.profiles p on p.id = a.uid
  order by a.started_at desc;
end;
$$;

revoke all on function public.get_recent_visit_sessions(int, int) from public, anon;
grant execute on function public.get_recent_visit_sessions(int, int) to authenticated;


-- ── 6) 한 세션의 이동 경로 ────────────────────────────────────────
drop function if exists public.get_visit_session_path(text);

create function public.get_visit_session_path(p_session_id text)
returns table (path text, created_at timestamptz)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception '권한이 없습니다';
  end if;

  return query
  select coalesce(v.path, '/')::text, v.created_at
  from public.visit_logs v
  where v.session_id::text = p_session_id
  order by v.created_at
  limit 300;
end;
$$;

revoke all on function public.get_visit_session_path(text) from public, anon;
grant execute on function public.get_visit_session_path(text) to authenticated;


select pg_notify('pgrst', 'reload schema');
