-- 가입 유입 경로 — 회원이 어디서 들어와 가입했는지 기록
-- 1) profiles에 컬럼 추가 (기존 회원은 전부 null = "기록 없음")
alter table public.profiles
  add column if not exists signup_channel       text,
  add column if not exists signup_referrer      text,
  add column if not exists signup_landing_path  text,
  add column if not exists signup_utm_source    text,
  add column if not exists signup_utm_medium    text,
  add column if not exists signup_utm_campaign  text;

-- 2) 관리자 전용 조회 함수 (기존 get_member_detail은 건드리지 않는다)
--    본인 프로필 INSERT 때 값이 들어가고, 읽기는 관리자만.
drop function if exists public.get_member_signup_source(uuid);

create function public.get_member_signup_source(uid uuid)
returns table (
  signup_channel      text,
  signup_referrer     text,
  signup_landing_path text,
  signup_utm_source   text,
  signup_utm_medium   text,
  signup_utm_campaign text
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  -- 관리자만
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception '권한이 없습니다';
  end if;

  return query
  select p.signup_channel, p.signup_referrer, p.signup_landing_path,
         p.signup_utm_source, p.signup_utm_medium, p.signup_utm_campaign
  from public.profiles p
  where p.id = uid;
end;
$$;

revoke all on function public.get_member_signup_source(uuid) from public, anon;
grant execute on function public.get_member_signup_source(uuid) to authenticated;

-- 3) 채널별 가입 집계 (나중에 관리자 통계에 붙일 때 사용)
drop function if exists public.get_signup_sources(int);

create function public.get_signup_sources(days int default 30)
returns table (channel text, count bigint)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception '권한이 없습니다';
  end if;

  return query
  select coalesce(p.signup_channel, '기록 없음') as channel, count(*)::bigint
  from public.profiles p
  where p.created_at >= now() - make_interval(days => days)
  group by 1
  order by 2 desc;
end;
$$;

revoke all on function public.get_signup_sources(int) from public, anon;
grant execute on function public.get_signup_sources(int) to authenticated;

select pg_notify('pgrst', 'reload schema');
