-- ============================================================
-- 관리자 회원 상세 > 최근 방문 (2026-10-13)
--
-- visit_logs(로그인 상태로 본 화면마다 한 줄, AppShell 의 logVisit)에서
-- 그 회원의 마지막 방문 시각 · 최근 30일 방문일/페이지뷰 · 최근 본 화면을 읽는다.
-- 새로 저장하는 건 없다. 읽기 전용, 관리자만. (signup_source.sql 과 같은 패턴)
-- ⚠️ localhost 방문과 봇은 원래 기록되지 않는다. 로그인 전에 본 화면은 user_id 가 없어 안 잡힌다.
-- ============================================================

create index if not exists visit_logs_user_time_idx
  on public.visit_logs (user_id, created_at desc) where user_id is not null;

create or replace function public.get_member_recent_visits(uid uuid, page_limit int default 20)
returns json
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $mrv$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception '권한이 없습니다' using errcode = '42501';
  end if;
  if page_limit is null or page_limit < 1 or page_limit > 100 then
    raise exception 'page_limit 은 1~100 이어야 합니다' using errcode = '22023';
  end if;

  return json_build_object(
    'last_at',   (select max(v.created_at) from public.visit_logs v where v.user_id = uid),
    'days_30',   (select count(distinct (v.created_at at time zone 'Asia/Seoul')::date)
                    from public.visit_logs v
                   where v.user_id = uid and v.created_at >= now() - interval '30 days'),
    'views_30',  (select count(*) from public.visit_logs v
                   where v.user_id = uid and v.created_at >= now() - interval '30 days'),
    'recent',    coalesce((select json_agg(json_build_object('path', r.path, 'at', r.created_at) order by r.created_at desc)
                             from (select v.path, v.created_at from public.visit_logs v
                                    where v.user_id = uid
                                    order by v.created_at desc
                                    limit page_limit) r), '[]'::json)
  );
end;
$mrv$;

revoke all on function public.get_member_recent_visits(uuid, int) from public, anon;
grant execute on function public.get_member_recent_visits(uuid, int) to authenticated;

select pg_notify('pgrst', 'reload schema');

-- [확인] 관리자 계정이 아닌 SQL Editor 에서는 auth.uid() 가 없어 '권한이 없습니다'가 나는 게 정상.
-- 함수 존재 확인 → 1행
-- select proname from pg_proc where proname = 'get_member_recent_visits' and pronamespace = 'public'::regnamespace;
