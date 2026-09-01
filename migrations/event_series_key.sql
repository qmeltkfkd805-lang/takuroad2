-- 여러 지점에서 하는 하나의 이벤트를 묶기 위한 그룹 키
--
-- 문제: "AMNESIA WORLD Gratte"처럼 같은 이벤트가 홍대점·잠실점에서 열리면
--       events 행이 지점 수만큼 생겨서 목록에 같은 포스터가 여러 장 뜬다.
-- 방식: 같은 이벤트의 지점들에 같은 series_key를 넣는다(예: 'amnesia-world-gratte-2026').
--       목록에서는 키로 묶어 대표 1장 + "N개 지점" 배지, 지도·상세는 지금처럼 지점별로 둔다.
--       비어 있으면(null) 지금까지와 똑같이 단독 이벤트로 동작한다.

alter table public.events
  add column if not exists series_key text;

create index if not exists events_series_key_idx
  on public.events (series_key)
  where series_key is not null;

comment on column public.events.series_key is
  '여러 지점에서 하는 같은 이벤트를 묶는 키. 같은 값이면 목록에서 하나로 접힌다. 단독 이벤트는 null.';

select pg_notify('pgrst', 'reload schema');

-- ── 기존 이벤트에 키 부여 (제목을 보고 직접 정하세요) ──
-- 아래는 예시입니다. 먼저 select로 확인한 뒤 update 하세요.
--
-- select id, title, place_name, start_date, end_date from public.events
--  where title ilike '%AMNESIA WORLD%' order by created_at;
--
-- update public.events set series_key = 'amnesia-world-gratte-2026'
--  where title ilike '%AMNESIA WORLD Gratte%';
--
-- update public.events set series_key = 'yaksa-animate-collab-2026'
--  where title ilike '%약사의 혼잣말%' and title ilike '%애니메이트%';
