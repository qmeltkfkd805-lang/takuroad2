-- 『루트 방문하기』 1차 — 진행 세션 / 세션 방문 / 검증 설정
-- 기존 route_progress, route_completions, EXP·배지 로직은 변경하지 않음(추가만).
-- Supabase SQL Editor에서 실행하세요.

-- 1) 진행 세션 (시작 시 체크포인트를 확정 저장)
create table if not exists public.route_sessions (
  id           uuid primary key default gen_random_uuid(),
  route_id     uuid not null references public.routes(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'active',      -- active|paused|ended_completed|ended_partial|abandoned
  checkpoints  jsonb not null default '[]'::jsonb,  -- 시작 시 확정된 체크포인트 스냅샷
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  confidence   text,                                -- high|medium|recorded (내부)
  field_ratio  numeric,                             -- 확인된 체크포인트 비율(내부)
  risk_flags   jsonb not null default '[]'::jsonb,  -- 서버 검증 위험신호(내부)
  finalized_at timestamptz,                         -- 종료 확정 처리 시각(멱등 가드)
  created_at   timestamptz not null default now()
);
create index if not exists route_sessions_user_route_idx on public.route_sessions (user_id, route_id, status);

alter table public.route_sessions enable row level security;
drop policy if exists route_sessions_own on public.route_sessions;
create policy route_sessions_own on public.route_sessions
  for select using (auth.uid() = user_id);
-- insert/update/delete 정책 없음 → 서버(Service Role)만 쓰기 가능

-- 2) 세션별 방문/확인 기록 (원본 GPS 미저장 — 계산값·누적 카운터만)
create table if not exists public.route_session_visits (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.route_sessions(id) on delete cascade,
  checkpoint_key    text not null,                  -- place:{placeId}:seq:{n} | shop:{shopId}
  shop_id           uuid references public.shops(id),
  status            text not null default 'pending',-- pending|proximity_verified|checkpoint_verified|qr_verified|manual_recorded|skipped
  verification_mode text,                           -- geo|building|manual|qr
  verified_at       timestamptz,
  distance_m        integer,                        -- 확인 시 체크포인트와의 거리(계산값)
  accuracy_m        integer,                        -- 위치 정확도(계산값)
  -- 누적 판정용 임시 상태(좌표 원본 아님). 세션 삭제 시 cascade로 함께 삭제됨.
  sample_count      integer not null default 0,
  in_range_since    timestamptz,
  last_ping_at      timestamptz,
  unique (session_id, checkpoint_key)
);

alter table public.route_session_visits enable row level security;
drop policy if exists rsv_own on public.route_session_visits;
create policy rsv_own on public.route_session_visits
  for select using (exists (
    select 1 from public.route_sessions s where s.id = session_id and s.user_id = auth.uid()
  ));
-- 쓰기 정책 없음 → 서버(Service Role)만

-- 3) 검증 설정 (운영 중 조절, 서버만 판정에 사용)
create table if not exists public.route_verify_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.route_verify_config enable row level security;
-- select/insert/update 정책 없음 → 오직 Service Role만 읽고 씀(클라이언트엔 API로 비민감값만 전달)

insert into public.route_verify_config (key, value) values
  ('checkpointRadiusM',        '100'),
  ('accuracyMaxM',             '80'),
  ('minSamples',               '2'),
  ('minDwellSec',              '20'),
  ('maxSpeedKmh',              '120'),
  ('sessionTtlHours',          '12'),
  ('fieldBonusRequiredRatio',  '0.6'),
  ('fieldBonusExp',            '5'),
  ('maxCheckpointCount',       '7'),
  ('minCheckpointDistanceM',   '150')
on conflict (key) do nothing;
