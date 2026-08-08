-- 타쿠로드 실제 도보 경로(ORS) + 건물 가는 길/출구 안내
-- Supabase SQL Editor에서 실행하세요.

-- 1) 루트 실제 도보 경로 저장 (ORS 결과 캐시/재사용)
create table if not exists public.route_paths (
  route_id      uuid primary key references public.routes(id) on delete cascade,
  provider      text        not null,               -- 'ors-foot-walking'
  waypoint_hash text        not null,               -- 좌표+순서 해시 (변경 감지)
  geometry      jsonb       not null,               -- [[lng,lat], ...] LineString 좌표
  distance_m    integer,                            -- 실제 도보 거리(m)
  duration_min  integer,                            -- 실제 도보 시간(분)
  attribution   text,                               -- 출처 표기 문구
  calculated_at timestamptz not null default now()
);

alter table public.route_paths enable row level security;

-- 읽기: 누구나 허용 (경로선 표시용). 루트 공개 여부는 routes 쪽에서 이미 제어.
drop policy if exists "route_paths_read" on public.route_paths;
create policy "route_paths_read" on public.route_paths for select using (true);

-- 쓰기 정책 없음 → anon/authenticated 는 insert/update 불가.
-- 저장은 백엔드( /api/route-path )가 Service Role 로 수행하며 RLS를 우회함.

-- 2) 건물(place) 단위 '가는 길/출구 안내'
alter table public.places add column if not exists access_note text;
comment on column public.places.access_note is '가는 길/출구 안내 (예: 수원역 4번 출구 도보 2분, 지하상가 경유). 건물 단위 공유.';
