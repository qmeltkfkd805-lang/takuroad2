-- ============================================================
-- 샵 "층별 매장 구성" — 같은 건물 여러 층의 본점·1호점·2호점을 한눈에
--
--   shops.branches jsonb = [
--     { "floor": "2층", "name": "본점", "room": "136호", "items": ["피규어","가챠","굿즈"] },
--     { "floor": "9층", "name": "1호점", "items": ["가챠","카드가챠"] }
--   ]
--   샵은 하나로 두고(지도 핀 1개), 층별 정보만 목록으로 가진다.
--
--   shops 는 컬럼 단위 GRANT 를 쓴다(shops_write_privileges.sql).
--   새 컬럼은 insert·update 권한을 따로 줘야 등록·수정 화면에서 저장된다.
-- ============================================================

alter table public.shops
  add column if not exists branches jsonb not null default '[]'::jsonb;

alter table public.shops drop constraint if exists shops_branches_is_array;
alter table public.shops
  add constraint shops_branches_is_array
  check (jsonb_typeof(branches) = 'array' and jsonb_array_length(branches) <= 20);

grant insert (branches), update (branches) on public.shops to authenticated;

select pg_notify('pgrst', 'reload schema');


-- ============================================================
-- [적용 후 검증] — 읽기 전용
-- ============================================================
-- select column_name,
--        has_column_privilege('authenticated','public.shops',column_name,'INSERT') as ins,
--        has_column_privilege('authenticated','public.shops',column_name,'UPDATE') as upd
--   from information_schema.columns
--  where table_schema='public' and table_name='shops' and column_name='branches';
-- 기대: branches | true | true


-- ============================================================
-- [롤백]
-- ============================================================
-- revoke insert (branches), update (branches) on public.shops from authenticated;
-- alter table public.shops drop constraint if exists shops_branches_is_array;
-- alter table public.shops drop column if exists branches;
-- select pg_notify('pgrst', 'reload schema');
-- ============================================================
