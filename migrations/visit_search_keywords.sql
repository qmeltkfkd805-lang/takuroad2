-- 검색 유입 검색어 — 네이버·다음 등에서 "무슨 검색어로" 들어왔는지 관리자 화면에서 보기 위한 조회 함수.
--
-- visit_logs.referrer 에는 이미 document.referrer 전체 주소가 쌓이고 있다.
--   예) https://m.search.naver.com/search.naver?query=%EC%95%A0%EB%8B%88%EB%A9%94%EC%9D%B4%ED%8A%B8
-- 그 안의 검색어 파라미터(query / q / p)를 꺼내 디코딩해서 묶는다. 새로 저장하는 건 없다(읽기 전용).
--   → 지금까지 쌓인 기록에도 바로 적용된다.
--
-- ⚠️ 구글·빙은 보안 정책상 검색어를 주소에 안 남긴다(https://www.google.com/ 까지만 옴).
--    그런 방문은 keyword 가 null 로 나오고, 화면에선 "검색어 비공개"로 묶어 보여준다.
--    구글 검색어는 Google Search Console 에서만 볼 수 있다.
--
-- 권한: 관리자만 (profiles.role = 'admin'). visit_analytics.sql 과 같은 패턴.
-- 선행: visit_analytics.sql (visit_window_start 함수)


-- ── 1) URL 디코딩 (%EC%95%A0 → 애, + → 공백). 깨진 값이면 원문 그대로 ──
create or replace function public.url_decode_safe(s text)
returns text
language plpgsql
immutable
as $$
declare
  bin bytea := '';
  i   int := 1;
  n   int;
  ch  text;
begin
  if s is null then return null; end if;
  s := replace(s, '+', ' ');
  n := length(s);
  while i <= n loop
    ch := substr(s, i, 1);
    if ch = '%' and i + 2 <= n and substr(s, i + 1, 2) ~ '^[0-9A-Fa-f]{2}$' then
      bin := bin || decode(substr(s, i + 1, 2), 'hex');
      i := i + 3;
    else
      bin := bin || convert_to(ch, 'UTF8');
      i := i + 1;
    end if;
  end loop;
  return convert_from(bin, 'UTF8');
exception when others then
  return s;
end;
$$;

comment on function public.url_decode_safe(text) is
  'URL 퍼센트 인코딩을 UTF-8 글자로 푼다. 실패하면 원문 그대로.';


-- ── 2) referrer → (검색엔진, 검색어). 검색엔진이 아니면 engine = null ──
create or replace function public.parse_search_referrer(ref text, out engine text, out keyword text)
language plpgsql
immutable
as $$
declare
  host  text;
  param text;
  raw   text;
begin
  engine := null; keyword := null;
  if ref is null or btrim(ref) = '' then return; end if;
  host := lower(substring(ref from '^https?://([^/?#:]+)'));
  if host is null then return; end if;

  if host like '%search.naver.com'            then engine := '네이버';  param := 'query';
  elsif host like '%search.daum.net'          then engine := '다음';    param := 'q';
  elsif host ~ '(^|\.)google\.'               then engine := '구글';    param := 'q';
  elsif host ~ '(^|\.)bing\.com$'             then engine := '빙';      param := 'q';
  elsif host like '%search.zum.com'           then engine := '줌';      param := 'query';
  elsif host like '%search.nate.com'          then engine := '네이트';  param := 'q';
  elsif host ~ '(^|\.)search\.yahoo\.'        then engine := '야후';    param := 'p';
  elsif host ~ '(^|\.)duckduckgo\.com$'       then engine := '덕덕고';  param := 'q';
  else return;
  end if;

  raw := substring(ref from '[?&]' || param || '=([^&#]*)');
  keyword := nullif(lower(regexp_replace(btrim(public.url_decode_safe(raw)), '\s+', ' ', 'g')), '');
end;
$$;

comment on function public.parse_search_referrer(text) is
  '검색엔진 referrer 에서 엔진 이름과 검색어를 꺼낸다. 검색어를 안 주는 엔진(구글 등)은 keyword = null.';


-- ── 3) 검색어별 유입 ──────────────────────────────────────────────
-- 한 번의 유입 = (세션, referrer) 한 쌍. SPA라 같은 페이지 로드 안에서 이동해도 referrer 가 그대로라
-- 행마다 세면 페이지 수만큼 부풀기 때문에, 쌍의 첫 기록(= 도착한 페이지)만 센다.
drop function if exists public.get_search_keywords(int, int);

create function public.get_search_keywords(days int default 30, limit_n int default 100)
returns table (
  engine        text,
  keyword       text,
  visits        bigint,
  landing_path  text,
  last_at       timestamptz
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
  with landings as (
    select distinct on (v.session_id, v.referrer)
           v.referrer, v.path, v.created_at
    from public.visit_logs v
    where v.created_at >= public.visit_window_start(days)
      and v.referrer is not null
      and v.referrer ~* '(search\.naver|search\.daum|google\.|bing\.com|search\.zum|search\.nate|search\.yahoo|duckduckgo)'
    order by v.session_id, v.referrer, v.created_at
  ),
  parsed as (
    select (public.parse_search_referrer(l.referrer)).*, l.path, l.created_at
    from landings l
  )
  select p.engine::text,
         p.keyword::text,
         count(*)::bigint,
         (mode() within group (order by coalesce(p.path, '/')))::text,
         max(p.created_at)
  from parsed p
  where p.engine is not null
  group by p.engine, p.keyword
  order by 3 desc, 5 desc
  limit greatest(1, least(limit_n, 300));
end;
$$;

revoke all on function public.get_search_keywords(int, int) from public, anon;
grant execute on function public.get_search_keywords(int, int) to authenticated;


select pg_notify('pgrst', 'reload schema');
