-- 관리자 대시보드 '오늘 가입'을 한국 시간(KST) 0시 기준으로 세기
--
-- 문제: date_trunc('day', now()) 는 DB 시간대(UTC) 기준이라 '오늘'이 한국 시간 오전 9시에 시작했다.
--       그래서 한국 시간 0~9시에 가입한 사람은 '오늘 가입'에서 빠졌다. (예: 10/7 00:13 KST 가입 → 0명으로 표시)
-- 고침: new_members_today 한 줄만 한국 시간 0시부터 세도록 바꾼다. 나머지 숫자·권한 확인은 그대로.
-- 데이터는 건드리지 않는다. CREATE OR REPLACE 라 기존 실행 권한도 그대로 유지된다.

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions', 'pg_temp'
AS $function$
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception '관리자만 조회할 수 있습니다' using errcode = '42501';
  end if;

  return (
    select json_build_object(
      'works',             (select count(*) from tags),
      'shops',             (select count(*) from shops where status = 'active'),
      'events',            (select count(*) from events),
      'banners',           (select count(*) from featured_banners where is_active = true),
      'members',           (select count(*) from profiles),
      'favorites',         (select count(*) from user_favorite_tags),
      -- 한국 시간 오늘 0시부터
      'new_members_today', (select count(*) from profiles
                            where created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')),
      'shops_total',       (select count(*) from shops where status <> 'deleted'),
      'shops_active',      (select count(*) from shops where status = 'active'),
      'shops_temp',        (select count(*) from shops where status = 'temporary_closed'),
      'shops_closed',      (select count(*) from shops where status = 'closed'),
      'shops_official',    (select count(*) from shops where is_verified = true and status <> 'deleted')
    )
  );
end;
$function$;

-- [확인] 한국 시간 오늘 0시가 UTC로 몇 시인지 (오늘 날짜의 전날 15:00+00 이면 정상)
-- select date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
