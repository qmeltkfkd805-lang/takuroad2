-- 스팟 간 이동 팁 — 해당 스팟에서 '다음 스팟까지' 이동에 대한 팁
-- Supabase SQL Editor에서 실행하세요.
alter table public.route_shops add column if not exists move_tip text;
comment on column public.route_shops.move_tip is '이 스팟에서 다음 스팟까지 이동 팁(예: 지하상가 경유가 빠름). 마지막 스팟은 미사용.';
