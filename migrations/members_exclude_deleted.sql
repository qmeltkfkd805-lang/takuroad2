-- ============================================================
-- 관리자 회원 수·회원 목록에서 탈퇴한 회원 빼기 (2026-10-12)
--
-- 탈퇴하면 profiles 행이 '탈퇴한회원_xxxxxxxx' 껍데기(status='deleted')로 남는다
-- (글·댓글·루트를 살려두기 위해 — account_delete.sql). 그래서 회원 수에 같이 잡혔다.
--
-- 바꾸는 것 (지금 DB 에 있는 함수 본문을 읽어서 해당 부분만 고친다)
--   get_dashboard_stats : 'members'(전체 회원) · 'new_members_today'(오늘 가입) 에서 deleted 제외
--   get_admin_members   : 회원 목록·검색·총 건수에서 deleted 제외
-- 반환 형태·인자·권한은 그대로(create or replace). 데이터는 건드리지 않는다.
-- 고칠 자리를 정확히 못 찾으면 아무것도 안 바꾸고 오류로 멈춘다.
-- ============================================================

begin;

do $fix_stats$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.get_dashboard_stats()'::regprocedure) into v_def;

  -- 전체 회원
  if (select count(*) from regexp_matches(v_def, '\(select count\(\*\) from profiles\)', 'g')) <> 1 then
    raise exception 'get_dashboard_stats: 전체 회원 줄을 찾지 못했어요';
  end if;
  v_new := regexp_replace(v_def, '\(select count\(\*\) from profiles\)',
                          '(select count(*) from profiles where coalesce(status, ''active'') <> ''deleted'')');

  -- 오늘 가입
  if (select count(*) from regexp_matches(v_new, 'from profiles(\s+)where created_at', 'g')) <> 1 then
    raise exception 'get_dashboard_stats: 오늘 가입 줄을 찾지 못했어요';
  end if;
  v_new := regexp_replace(v_new, 'from profiles(\s+)where created_at',
                          'from profiles\1where coalesce(status, ''active'') <> ''deleted'' and created_at');

  execute v_new;
end
$fix_stats$;

do $fix_members$
declare
  v_def text;
begin
  select pg_get_functiondef('public.get_admin_members(text, int, int, text, text, text)'::regprocedure) into v_def;

  if (select count(*) from regexp_matches(v_def, 'where \(coalesce\(search, ''''\) = ''''', 'g')) <> 1 then
    raise exception 'get_admin_members: 검색 조건 줄을 찾지 못했어요';
  end if;

  execute regexp_replace(v_def, 'where \(coalesce\(search, ''''\) = ''''',
    'where coalesce(p.status, ''active'') <> ''deleted''
       and (coalesce(search, '''') = ''''');
end
$fix_members$;

commit;

select pg_notify('pgrst', 'reload schema');

-- [확인] 둘 다 true
-- select proname, prosrc like '%<> ''deleted''%' as 탈퇴제외
--   from pg_proc where pronamespace='public'::regnamespace
--    and proname in ('get_dashboard_stats','get_admin_members');
